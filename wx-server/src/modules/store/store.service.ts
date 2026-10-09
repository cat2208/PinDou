import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Store, Staff, Seat, Package } from '../../entities/store.entity';
import { StoreOrder, StoreOrderItem } from '../../entities/order.entity';
import { PaymentRecord, OrderMessage } from '../../entities/system.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { Product } from '../../entities/content.entity';
import { JwtUser } from '../../common/auth.guard';
import { genNo, fmtTime } from '../../common/utils';

const r2 = (n: number) => Math.round(n * 100) / 100;
const ACTIVE_STATUS = ['TIMING', 'COMPLETED'];

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    @InjectRepository(Package) private readonly pkgRepo: Repository<Package>,
    @InjectRepository(StoreOrder) private readonly soRepo: Repository<StoreOrder>,
    @InjectRepository(StoreOrderItem) private readonly soiRepo: Repository<StoreOrderItem>,
    @InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(OrderMessage) private readonly msgRepo: Repository<OrderMessage>,
    @InjectRepository(PricingConfig) private readonly pricingRepo: Repository<PricingConfig>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  /** GET /api/store/info 门店信息（默认门店 id 取 .env DEFAULT_STORE_ID=1） */
  async info() {
    const stores = await this.storeRepo.find({ where: { status: 'ACTIVE' }, order: { id: 'ASC' } });
    const store = stores[0];
    if (!store) throw new Error('门店数据未初始化，请先执行 seed');
    const config = await this.pricingRepo.findOne({ where: { store_id: store.id } });
    return {
      id: store.id,
      name: store.name,
      address: store.address,
      phone: store.contact_phone,
      businessHours: store.business_hours,
      latitude: store.latitude ? Number(store.latitude) : 31.2304,
      longitude: store.longitude ? Number(store.longitude) : 121.4737,
      status: store.status,
      notice: '到店请先在前台核销券码，DIY 过程中如有问题随时找店员帮忙。',
      pricing: {
        beanUnitPrice: Number(config?.bean_unit_price ?? 0.0015),
        laborPriceNormal: Number(config?.labor_price_normal ?? 0.014),
        laborPriceComplex: Number(config?.labor_price_complex ?? 0.02),
        colorThreshold: config?.color_threshold ?? 12,
        pointsPerYuan: config?.points_per_yuan ?? 1,
        shippingFee: Number(config?.shipping_fee ?? 6),
        freeShippingThreshold: Number(config?.free_shipping_threshold ?? 60),
      },
      store: {
        name: store.name,
        address: store.address,
        phone: store.contact_phone,
        businessHours: store.business_hours,
      },
    };
  }

  /** GET /api/store/packages 套餐列表 */
  async packages() {
    const rows = await this.pkgRepo.find({ where: { enabled: 1 }, order: { id: 'ASC' } });
    return {
      list: rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: Number(p.price),
        priceText: `¥${Number(p.price).toFixed(2)}`,
        durationMinutes: p.duration_minutes || null,
        hourlyUnitPrice: p.hourly_unit_price ? Number(p.hourly_unit_price) : null,
        deposit: Number(p.deposit ?? 0),
        description: p.description || '',
      })),
    };
  }

  /** GET /api/store/seats?available=1 座位列表（available=1 只返回空闲） */
  async seats(available?: string) {
    const qb = this.seatRepo.createQueryBuilder('s').orderBy('s.seat_no', 'ASC');
    if (available === '1' || available === 'true') qb.where('s.status = :st', { st: 'IDLE' });
    const rows = await qb.getMany();
    return {
      list: rows.map((s) => ({
        id: s.id,
        seatNo: s.seat_no,
        area: s.area,
        status: s.status,
        token: s.qrcode_token,
      })),
    };
  }

  /** 按座位号或二维码 token 定位座位 */
  private async resolveSeat(seatNo?: string, seatToken?: string): Promise<Seat | null> {
    const token = String(seatToken || '').trim();
    const no = String(seatNo || '').trim().toUpperCase();
    // 二维码内容兼容：纯 token / "seat=tok-A01" / 完整 URL 含 token 参数
    let realToken = token;
    const m = /(?:seat|token)=([A-Za-z0-9_-]+)/.exec(token);
    if (m) realToken = m[1];
    if (realToken) {
      const byToken = await this.seatRepo.findOne({ where: { qrcode_token: realToken } });
      if (byToken) return byToken;
    }
    if (no) return this.seatRepo.findOne({ where: { seat_no: no } });
    return null;
  }

  /** 创建开台订单（顾客扫码 / 老板帮开台共用） */
  private async openSession(userId: number, body: { seatNo?: string; seatToken?: string; packageId?: number }) {
    const seat = await this.resolveSeat(body?.seatNo, body?.seatToken);
    if (!seat) throw new Error('座位不存在，请核对座位号或扫描座位二维码');

    // 已有进行中的订单 → 直接返回本桌状态，避免重复开台
    const active = await this.soRepo.findOne({
      where: { seat_id: seat.id, status: In(ACTIVE_STATUS) },
      order: { id: 'DESC' },
    });
    if (active) {
      return { occupied: true, ...(await this.buildSessionDetail(active)) };
    }
    if (seat.status === 'RESERVED') throw new Error('该座位已预约，暂不可用');

    const pkg = body?.packageId ? await this.pkgRepo.findOne({ where: { id: body.packageId } }) : null;
    const startAt = new Date();
    seat.status = 'TIMING' as any;
    await this.seatRepo.save(seat);

    const order = this.soRepo.create({
      order_no: genNo('SS'),
      user_id: userId,
      seat_id: seat.id,
      store_id: seat.store_id ?? null,
      package_id: pkg?.id ?? 0,
      start_time: startAt,
      timing_type: (pkg?.type ?? 'HOURLY') as any,
      total_fee: '0',
      settled_fee: '0',
      status: 'TIMING',
    });
    const saved = await this.soRepo.save(order);

    let pkgName = '计时体验';
    if (pkg) {
      pkgName = pkg.name;
      await this.soiRepo.save(
        this.soiRepo.create({
          store_order_id: saved.id,
          item_type: 'TIMING',
          ref_id: pkg.id,
          name: pkg.name,
          quantity: 1,
          amount: pkg.price,
        }),
      );
    }

    await this.msgRepo
      .save(
        this.msgRepo.create({
          biz_type: 'STORE_ORDER',
          order_id: saved.id,
          sender_type: 'STAFF',
          sender_id: 0,
          sender_name: '系统',
          message_type: 'SYSTEM',
          content: `座位 ${seat.seat_no} 已开台（${pkgName}），计时已开始。`,
        }),
      )
      .catch(() => null);

    return {
      ...(await this.buildSessionDetail(saved)),
      occupied: false,
      startAt: fmtTime(startAt),
      packageName: pkgName,
      message: `座位 ${seat.seat_no} 开台成功，开始计时`,
    };
  }

  /** POST /api/store/sessions 顾客扫码/输座位号开台 */
  async startSession(uid: number, body: { seatNo?: string; seatToken?: string; packageId?: number }) {
    return this.openSession(uid, body);
  }

  /** POST /api/store/sessions/assist 老板/店员帮顾客开台（可选绑定用户） */
  async assistStart(staff: JwtUser, body: { seatNo?: string; seatToken?: string; packageId?: number; userId?: number }) {
    const userId = Number(body?.userId) > 0 ? Number(body.userId) : 0;
    if (Number(body?.userId) > 0) {
      const u = await this.soRepo.manager
        .query('SELECT id FROM `user` WHERE id = ? LIMIT 1', [userId])
        .catch(() => []);
      if (!Array.isArray(u) || u.length === 0) throw new Error('该用户不存在，请先确认会员信息');
    }
    return this.openSession(userId, body);
  }

  /** 本桌订单与账单明细（实时计时 / 已定格账单） */
  private async buildSessionDetail(order: StoreOrder) {
    const seat = await this.seatRepo.findOne({ where: { id: order.seat_id } });
    const pkg = order.package_id ? await this.pkgRepo.findOne({ where: { id: order.package_id } }) : null;
    const items = await this.soiRepo.find({ where: { store_order_id: order.id }, order: { id: 'ASC' } });

    let elapsedMinutes = 0;
    let timingFee = Number(order.timing_fee || 0);
    let overtimeMinutes = Number(order.overtime_minutes || 0);
    if (order.status === 'TIMING' && order.start_time) {
      elapsedMinutes = Math.max(1, Math.ceil((Date.now() - new Date(order.start_time).getTime()) / 60000));
      timingFee = this.calcTimingFee(elapsedMinutes, pkg).timingFee;
      overtimeMinutes = this.calcTimingFee(elapsedMinutes, pkg).overtimeMinutes;
    } else if (order.status === 'COMPLETED' && order.start_time && order.end_time) {
      elapsedMinutes = Math.max(1, Math.ceil((new Date(order.end_time).getTime() - new Date(order.start_time).getTime()) / 60000));
    }

    const accessoryFee = Number(order.accessory_fee || 0);
    const totalFee = r2(timingFee + accessoryFee);
    const pkgMinutes = pkg?.duration_minutes || null;
    const remainMinutes = order.status === 'TIMING' && pkgMinutes ? Math.max(0, pkgMinutes - elapsedMinutes) : 0;

    return {
      orderId: order.id,
      orderNo: order.order_no,
      seatNo: seat?.seat_no || '',
      seatArea: seat?.area || '',
      seatToken: seat?.qrcode_token || '',
      packageId: order.package_id,
      packageName: pkg?.name || '计时体验',
      timingType: order.timing_type,
      status: order.status,
      startAt: order.start_time ? fmtTime(order.start_time) : '',
      endAt: order.end_time ? fmtTime(order.end_time) : '',
      elapsedMinutes,
      packageMinutes: pkgMinutes,
      remainMinutes,
      overtimeMinutes,
      timingFee: r2(timingFee),
      timingFeeText: `¥${r2(timingFee).toFixed(2)}`,
      accessoryFee: r2(accessoryFee),
      accessoryFeeText: `¥${r2(accessoryFee).toFixed(2)}`,
      totalFee,
      totalFeeText: `¥${totalFee.toFixed(2)}`,
      deposit: Number(order.deposit || 0),
      settledFee: Number(order.settled_fee || 0),
      createdAt: fmtTime(order.created_at),
      items: items.map((i) => ({
        id: i.id,
        itemType: i.item_type,
        name: i.name,
        quantity: i.quantity,
        amount: Number(i.amount),
        amountText: `¥${Number(i.amount).toFixed(2)}`,
        direction: i.direction,
      })),
    };
  }

  /** GET /api/store/sessions/:orderId 本桌实时状态与账单 */
  async sessionDetail(uid: number, orderId: string | number) {
    const order = await this.ownOrder(uid, orderId);
    return this.buildSessionDetail(order);
  }

  /** POST /api/store/sessions/:orderId/accessories 本桌加购配件（未结账前可加） */
  async addAccessories(uid: number, orderId: string | number, body: { items?: Array<{ productId: number | string; qty?: number }> }) {
    const order = await this.ownOrder(uid, orderId);
    if (!ACTIVE_STATUS.includes(order.status)) throw new Error('该订单已结账，无法再加购');

    const items = (body?.items || []).filter((i) => i && i.productId);
    if (!items.length) throw new Error('请选择要加购的配件');

    const detail: any[] = [];
    let accessoryFee = Number(order.accessory_fee || 0);
    for (const it of items) {
      const p = await this.productRepo.findOne({ where: { id: Number(it.productId) } });
      if (!p || !p.enabled) throw new Error('部分配件已下架，请刷新后再试');
      const qty = Math.max(1, Number(it.qty) || 1);
      if (p.stock < qty) throw new Error(`「${p.title}」库存不足`);
      p.stock = Math.max(0, p.stock - qty);
      await this.productRepo.save(p);

      const amount = r2(Number(p.price) * qty);
      const row = await this.soiRepo.save(
        this.soiRepo.create({
          store_order_id: order.id,
          item_type: 'ACCESSORY',
          ref_id: p.id,
          name: p.title,
          quantity: qty,
          amount: String(amount),
        }),
      );
      accessoryFee = r2(accessoryFee + amount);
      detail.push({ id: row.id, name: p.title, quantity: qty, amount, amountText: `¥${amount.toFixed(2)}` });
    }

    order.accessory_fee = String(accessoryFee);
    order.total_fee = String(r2(Number(order.timing_fee || 0) + accessoryFee));
    await this.soRepo.save(order);

    const detailAll = await this.soiRepo.find({ where: { store_order_id: order.id }, order: { id: 'ASC' } });

    return {
      orderId: order.id,
      orderNo: order.order_no,
      message: '已加入本桌账单',
      added: detail,
      accessoryFee,
      accessoryFeeText: `¥${accessoryFee.toFixed(2)}`,
      items: detailAll.map((i) => ({
        id: i.id,
        itemType: i.item_type,
        name: i.name,
        quantity: i.quantity,
        amount: Number(i.amount),
        amountText: `¥${Number(i.amount).toFixed(2)}`,
        direction: i.direction,
      })),
    };
  }

  /** POST /api/store/sessions/:orderId/end 结束计时 → 生成待收款账单（服务端按实际用时计费） */
  async endSession(uid: number, orderId: string | number) {
    const order = await this.ownOrder(uid, orderId);
    if (order.status !== 'TIMING') throw new Error('该订单当前未在计时中，无需结束');

    const start = new Date(order.start_time).getTime();
    const minutes = Math.max(1, Math.ceil((Date.now() - start) / 60000));
    const pkg = order.package_id ? await this.pkgRepo.findOne({ where: { id: order.package_id } }) : null;
    const { timingFee, overtimeMinutes } = this.calcTimingFee(minutes, pkg);

    const endAt = new Date();
    order.end_time = endAt;
    order.overtime_minutes = overtimeMinutes;
    order.timing_fee = String(timingFee);
    order.total_fee = String(r2(timingFee + Number(order.accessory_fee || 0)));
    order.status = 'COMPLETED' as any;
    await this.soRepo.save(order);

    const seat = await this.seatRepo.findOne({ where: { id: order.seat_id } });
    if (seat) {
      seat.status = 'PENDING_SETTLE' as any;
      await this.seatRepo.save(seat);
    }

    await this.msgRepo
      .save(
        this.msgRepo.create({
          biz_type: 'STORE_ORDER',
          order_id: order.id,
          sender_type: 'STAFF',
          sender_id: 0,
          sender_name: '系统',
          message_type: 'SYSTEM',
          content: `座位 ${seat?.seat_no || ''} 计时结束，账单待前台收款。`,
        }),
      )
      .catch(() => null);

    return {
      ...(await this.buildSessionDetail(order)),
      message: `本次计时 ${minutes} 分钟，请到前台结账`,
    };
  }

  /** 计费：套餐内按套餐价；超套餐自动按小时单价补差价；无套餐/按时长套餐按实际用时×单价 */
  private calcTimingFee(minutes: number, pkg: Package | null): { timingFee: number; overtimeMinutes: number } {
    if (!pkg) {
      return { timingFee: r2((minutes / 60) * 10), overtimeMinutes: 0 };
    }
    const basePrice = Number(pkg.price || 0);
    const hourly = Number(pkg.hourly_unit_price ?? 10) || 10;
    const dur = pkg.duration_minutes;
    if (pkg.type === 'ALL_DAY') return { timingFee: basePrice, overtimeMinutes: 0 };
    if (!dur) {
      // HOURLY 等按时长套餐：实际用时 × 小时单价
      return { timingFee: r2((minutes / 60) * hourly), overtimeMinutes: 0 };
    }
    if (minutes <= dur) return { timingFee: basePrice, overtimeMinutes: 0 };
    const extra = minutes - dur;
    return { timingFee: r2(basePrice + (extra / 60) * hourly), overtimeMinutes: extra };
  }

  /** 校验订单归属：本人或游客桌（user_id=0，老板帮开台） */
  private async ownOrder(uid: number, orderId: string | number) {
    const order = await this.soRepo.findOne({ where: { id: Number(orderId) } });
    if (!order) throw new Error('订单不存在');
    if (order.user_id !== uid && order.user_id !== 0) throw new Error('无权操作该订单');
    return order;
  }

  /** 门店店员列表（供 admin 使用） */
  async listStaff() {
    return this.staffRepo.find({ order: { id: 'ASC' } });
  }

  }