import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomOrder, CustomOrderQc, StoreOrder, StoreOrderItem } from '../../entities/order.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { AccessoryOrder, OrderMessage, PaymentRecord } from '../../entities/system.entity';
import { User } from '../../entities/user.entity';
import { JwtUser } from '../../common/auth.guard';
import { genNo, fmtTime, dayAdd } from '../../common/utils';
import { PatternService } from '../pattern/pattern.service';

/** 尺寸阶梯价（元/件），与前端 preview.js 一致；真实价格以定价配置计算豆数成本价 */
const SIZE_STEPS: Array<{ size: string; w: number; h: number; price: number; days: number }> = [
  { size: '25×25cm', w: 25, h: 25, price: 39, days: 3 },
  { size: '25×35cm', w: 25, h: 35, price: 49, days: 3 },
  { size: '35×35cm', w: 35, h: 35, price: 59, days: 4 },
  { size: '45×45cm', w: 45, h: 45, price: 79, days: 5 },
  { size: '75×105cm', w: 75, h: 105, price: 139, days: 7 },
];

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待处理',
  ACCEPTED: '已接单',
  COLORING: '制豆中',
  ASSEMBLING: '拼装中',
  IRONING: '熨烫中',
  QC_PENDING: '质检中',
  QC_PASSED: '质检通过',
  DONE: '已完成',
  SHIPPED: '已发货',
  DELIVERED: '待确认',
  CONFIRMED: '已完成',
  CANCELLED: '已取消',
};

@Injectable()
export class CustomService {
constructor(
    @InjectRepository(CustomOrder) private readonly coRepo: Repository<CustomOrder>,
    @InjectRepository(CustomOrderQc) private readonly qcRepo: Repository<CustomOrderQc>,
    @InjectRepository(StoreOrder) private readonly soRepo: Repository<StoreOrder>,
    @InjectRepository(StoreOrderItem) private readonly soiRepo: Repository<StoreOrderItem>,
    @InjectRepository(PricingConfig) private readonly pricingRepo: Repository<PricingConfig>,
    @InjectRepository(OrderMessage) private readonly msgRepo: Repository<OrderMessage>,
@InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(AccessoryOrder) private readonly aoRepo: Repository<AccessoryOrder>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly patternService: PatternService,
  ) {}

  /** 豆价参数（元/颗、人工基价），从 pricing_config 读取；默认值兜底 */
  private async beanPriceConfig() {
    try {
      const row = (await this.pricingRepo.find({ order: { id: 'ASC' }, take: 1 }))[0];
      if (!row) return { bean: 0.012, base: 25, labor: 0.006 };
      return {
        bean: Number(row.bean_unit_price ?? 0.012),
        base: 25,
        labor: Number(row.labor_price_normal ?? 0.014) * 0.45,
      };
    } catch {
      return { bean: 0.012, base: 25, labor: 0.006 };
    }
  }

  /**
   * 按拼豆图纸精确报价：total_beans × 豆单价 + 网格面积人工费 + 基价。
   * patternId 缺失时回退尺寸阶梯价。
   */
  async quoteWithPattern(pattern: { totalBeans: number; colorCount: number; sizeCm: { w: number; h: number } } | null, size: string) {
    if (!pattern) return null;
    const cfg = await this.beanPriceConfig();
    const area = Math.max(1, Math.round((pattern.sizeCm.w * pattern.sizeCm.h) / 25)); // 面积系数（25cm²=1）
    const beanCost = pattern.totalBeans * cfg.bean;
    const laborCost = pattern.totalBeans * cfg.labor;
    const unitPrice = Math.max(20, Math.round((beanCost + laborCost + cfg.base * area) / 5) * 5);
    return { unitPrice, rawUnitPrice: unitPrice, beanPricePer: cfg.bean, totalBeans: pattern.totalBeans };
  }

  /** POST /api/custom/quote { size, qty, patternId? } -> 报价（带图纸精确价，无图纸走阶梯价） */
  async quote(body: { size?: string; qty?: number; patternId?: string; totalBeans?: number; colorCount?: number; sizeCm?: any }) {
    const size = body?.size || '25×25cm';
    const qty = Number(body?.qty) || 1;
    const step = SIZE_STEPS.find((s) => s.size === size);
    const unitPrice = step ? step.price : this.estimatePrice(size);
    const deliveryDay = step ? step.days : 4;
    let patternQuote: any = null;
    // 携带 patternId 时按真实图纸豆数报价
    if (body?.patternId) {
      const cached = this.patternService.readCached(body.patternId);
      if (cached) {
        patternQuote = await this.quoteWithPattern(
          { totalBeans: cached.totalBeans, colorCount: cached.colorCount, sizeCm: cached.sizeCm },
          size,
        );
      }
    } else if (body?.totalBeans) {
      const sizeCm = body?.sizeCm || { w: 25, h: 25 };
      patternQuote = await this.quoteWithPattern(
        { totalBeans: Number(body.totalBeans), colorCount: Number(body.colorCount) || 0, sizeCm },
        size,
      );
    }
    const finalUnit = patternQuote ? patternQuote.unitPrice : unitPrice;
    return {
      unitPrice: qty >= 3 ? +(finalUnit * (1 - 0.05)).toFixed(2) : finalUnit,
      rawUnitPrice: finalUnit,
      deliveryDay,
      totalPrice: +(qty >= 3 ? finalUnit * qty * 0.95 : finalUnit * qty).toFixed(2),
      currency: 'CNY',
      pattern: patternQuote
        ? { totalBeans: patternQuote.totalBeans, beanPricePer: patternQuote.beanPricePer }
        : null,
    };
  }

  /** 解析 '25×25cm' 尺寸，返回宽高 cm */
  private parseSize(size: string): { w: number; h: number } {
    const m = /(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:cm)?/i.exec(size || '');
    if (!m) return { w: 25, h: 25 };
    return { w: Number(m[1]), h: Number(m[2]) };
  }

  private estimatePrice(size: string): number {
    const { w, h } = this.parseSize(size);
    const beans = Math.round((w / 0.26) * (h / 0.26));
    const p = beans * 0.0015 + beans * 0.014;
    return Math.max(20, Math.round(p / 5) * 5);
  }

/** POST /api/custom/orders 创建定制订单（沙箱支付直接标记已支付） */
  async create(uid: number, body: any) {
    const { qty, remark, contact, phone, amountFen, address } = {
      qty: Number(body?.qty) || 1,
      remark: body?.remark || '',
      contact: body?.contact || '',
      phone: body?.phone || '',
      amountFen: Number(body?.amountFen) || 0,
      address: body?.address || '',
    };
    const size = body?.size || '25×25cm';
    const { w, h } = this.parseSize(size);
    const image = body?.image || '';
    if (!image) throw new Error('请先上传定制图片');
    if (!contact.trim()) throw new Error('请填写联系人');
    if (!/^1\d{10}$/.test(phone)) throw new Error('请填写正确手机号');

    // 拼豆图纸参数（小程序来图定制走 pattern 流程时携带）
    let pattern: any = null;
    if (body?.patternId) {
      const cached = this.patternService.readCached(body.patternId);
      if (cached) pattern = cached;
    } else if (body?.totalBeans) {
      pattern = {
        totalBeans: Number(body.totalBeans),
        colorCount: Number(body.colorCount) || 0,
        colors: body?.colorsJson || body?.colors || [],
        style: body?.style || 'CARTOON',
        gridWidth: Number(body?.gridWidth) || 0,
        gridHeight: Number(body?.gridHeight) || 0,
        beadSize: Number(body?.beadSize) || 5,
        patternUrl: body?.patternUrl || '',
      };
    }

    const step = SIZE_STEPS.find((s) => s.size === size);
    let unitPrice = step ? step.price : this.estimatePrice(size);
    let totalAmount = amountFen > 0 ? amountFen / 100 : unitPrice * qty;
    // 有图纸时按图纸精确报价（用户已确认过金额则尊重其 amountFen）
    if (pattern && !(amountFen > 0)) {
      const sizeCm = { w: pattern.sizeCm?.w || w, h: pattern.sizeCm?.h || h };
      const pq = await this.quoteWithPattern(
        { totalBeans: pattern.totalBeans, colorCount: pattern.colorCount, sizeCm },
        size,
      );
      if (pq) unitPrice = pq.unitPrice;
      totalAmount = unitPrice * qty;
    }
    const totalPrice = +totalAmount.toFixed(2);
    const deposit = +((totalPrice * 0.5).toFixed(2));

    // 价格拆分：豆材 = 图纸豆数 × 豆单价；人工吸收基价/取整差额，保证拆分合计 = 总价
    let priceBean = '0';
    let priceLabor = '0';
    if (pattern && pattern.totalBeans) {
      const cfg = await this.beanPriceConfig();
      const beanCost = +(pattern.totalBeans * cfg.bean).toFixed(2);
      priceBean = String(beanCost);
      priceLabor = String(Math.max(0, +(totalPrice - beanCost).toFixed(2)));
    }

    // 图谱信息入库：pattern_url 存拼豆预览图；colors_json 存完整图纸参数（网格/豆规格/配豆清单）
    const colorsJson = pattern
      ? JSON.stringify({
          beadSize: pattern.beadSize || 5,
          gridWidth: pattern.gridWidth || 0,
          gridHeight: pattern.gridHeight || 0,
          sizeCm: pattern.sizeCm || null,
          colors: Array.isArray(pattern.colors)
            ? pattern.colors.map((c: any) => ({ code: c.code, hex: c.hex, count: c.count, packs: c.packs }))
            : [],
        })
      : null;

    const order = this.coRepo.create({
      order_no: genNo('PD'),
      user_id: uid,
      image_url: image,
      pattern_url: pattern?.patternUrl || body?.patternUrl || null,
      width: w,
      height: h,
      total_beans: pattern ? pattern.totalBeans : Math.round((w / 0.26) * (h / 0.26) * qty),
      color_count: pattern ? pattern.colorCount : 12,
      colors_json: colorsJson as any,
      style: (pattern?.style || 'CARTOON') as any,
      difficulty: 'NORMAL',
      iron_type: 'NORMAL',
      price_bean: priceBean,
      price_labor: priceLabor,
      price_iron: '0',
      price_accessory: '0',
      price_shipping: '0',
      total_price: String(totalPrice),
      deposit: String(deposit),
      deposit_paid: 1,
      points_deduct: '0',
      points_used: 0,
      member_discount: '0',
      nickname: contact,
      contact,
      expected_time: dayAdd(step ? step.days : 4),
      address,
      remark,
      status: 'PENDING',
    });
    const saved = await this.coRepo.save(order);

    // 沙箱支付成功记录
    await this.payRepo.save(
      this.payRepo.create({
        out_trade_no: 'PAY' + saved.order_no,
        biz_type: 'CUSTOM_DEPOSIT',
        biz_id: saved.id,
        user_id: uid,
        amount: String(deposit),
        status: 'PAID',
        paid_at: new Date(),
      }),
    );

    // 系统消息：下单成功
    await this.addSystemMessage(saved.id, 'CUSTOM_ORDER', `您的定制订单 ${saved.order_no} 已提交，门店确认后开始制作，预计 ${step ? step.days : 4} 天内完成。`);

    return this.toOrderDetail(saved, [['订单已提交', fmtTime(saved.created_at)]]);
  }

  /** GET /api/custom/orders 用户定制订单列表 */
  async myCustomOrders(uid: number, status = '') {
    const qb = this.coRepo.createQueryBuilder('o').where('o.user_id = :uid', { uid }).orderBy('o.created_at', 'DESC');
    if (status && status !== 'all') {
      const sts = status.split(',');
      qb.andWhere('o.status IN (:...sts)', { sts });
    }
    const rows = await qb.getMany();
    return {
      list: rows.map((o) => ({
        ...this.toOrderListItem(o),
        type: 'custom',
      })),
    };
  }

  /** GET /api/orders 统一订单列表（定制 + 商城，status 过滤） */
  async unifiedOrders(uid: number, status = '') {
const wantAll = !status || status === 'all' || status === '';
    const mapStatus = (s: string) => {
      // 支持逗号分隔的多状态组合（如 pending_payment,in_production,shipping）
      const parts = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
      const out: string[] = [];
      for (const p of parts) {
        if (/^(pending_payment|paid)$/.test(p)) out.push('PENDING', 'ACCEPTED');
        else if (/^in_production$/.test(p)) out.push('COLORING', 'ASSEMBLING', 'IRONING');
        else if (/^quality_checking$/.test(p)) out.push('QC_PENDING', 'QC_PASSED');
        else if (/^shipping$/.test(p)) out.push('SHIPPED', 'DELIVERED');
        else if (/^completed$/.test(p)) out.push('DONE', 'CONFIRMED');
      }
      return [...new Set(out)];
    };

const coQb = this.coRepo.createQueryBuilder('c').where('c.user_id = :uid', { uid }).orderBy('c.created_at', 'DESC');
    if (!wantAll) {
      coQb.andWhere('c.status IN (:...sts)', { sts: mapStatus(status) });
    }
    const customs = await coQb.getMany();

    // 到店体验订单（SS）：计时中/待收款归入"进行中"，已结账归入"已完成"
    const storeStatusMap = (s: string) => {
      if (/pending_payment|paid|in_production|quality_checking/.test(s)) return ['TIMING', 'COMPLETED'];
      if (/completed/.test(s)) return ['SETTLED'];
      return [];
    };
    const soQb = this.soRepo.createQueryBuilder('s').where('s.user_id = :uid', { uid }).orderBy('s.created_at', 'DESC');
    if (!wantAll) {
      const sts = storeStatusMap(status);
      soQb.andWhere('s.status IN (:...sts)', { sts: sts.length ? sts : ['__NONE__'] });
    }
    const stores = await soQb.getMany();
    // 商城订单（MM）：仅在"全部"tab 返回（一期商城沙箱直接支付，无物流状态流转）
    const aoQb = this.aoRepo.createQueryBuilder('a').where('a.user_id = :uid', { uid }).orderBy('a.created_at', 'DESC');
    const accessories = wantAll ? await aoQb.getMany() : [];

    const list: any[] = [
      ...customs.map((o) => ({ ...this.toOrderListItem(o), type: 'custom' })),
      ...stores.map((o) => ({ ...this.toStoreOrderListItem(o), type: 'store' })),
      ...accessories.map((o) => ({ ...this.toAccessoryListItem(o), type: 'mall' })),
    ];
    list.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    return { list };
  }

  /** GET /api/orders/:id 订单详情（定制或商城） */
  async orderDetail(uid: number, id: string | number) {
    const numericOrNo = String(id);
    const isNo = /^(PD|SS|MM)\d{4,}/.test(numericOrNo);
    const co = isNo
      ? await this.coRepo.findOne({ where: { order_no: numericOrNo, user_id: uid } })
      : await this.coRepo.findOne({ where: { id: Number(id), user_id: uid } });
    if (co) return this.toOrderDetail(co);

const so = isNo
      ? await this.soRepo.findOne({ where: { order_no: numericOrNo, user_id: uid } })
      : await this.soRepo.findOne({ where: { id: Number(id), user_id: uid } });
    if (so) return this.toStoreOrderDetail(so, uid);

const ao = isNo
      ? await this.aoRepo.findOne({ where: { order_no: numericOrNo, user_id: uid } })
      : await this.aoRepo.findOne({ where: { id: Number(id), user_id: uid } });
    if (ao) return this.toAccessoryOrderDetail(ao);

    throw new Error('订单不存在');
  }

/** 确认收货 */
  async confirmReceived(uid: number, id: string | number) {
    const numericOrNo = String(id);
    const isNo = /^(PD|SS|MM)\d{4,}/.test(numericOrNo);
    const co = isNo
      ? await this.coRepo.findOne({ where: { order_no: numericOrNo, user_id: uid } })
      : await this.coRepo.findOne({ where: { id: Number(id), user_id: uid } });
    if (!co || co.user_id !== uid) throw new Error('订单不存在');
    if (co.status !== 'DELIVERED' && co.status !== 'SHIPPED') throw new Error('当前状态不可确认收货');
    co.status = 'CONFIRMED';
    co.confirmed_at = new Date();
    await this.coRepo.save(co);
    // 积分奖励：确认收货 + 金额等值积分
    await this.earnPoints(uid, 'EARN', co.total_price, co.order_no);
    await this.addSystemMessage(co.id, 'CUSTOM_ORDER', `订单 ${co.order_no} 已确认收货，欢迎再次光临！`);
    return this.toOrderDetail(co, [['已确认收货', fmtTime(new Date())]]);
  }

  /** 取消订单 */
  async cancel(uid: number, id: string | number) {
    const numericOrNo = String(id);
    const isNo = /^(PD|SS|MM)\d{4,}/.test(numericOrNo);
    const co = isNo
      ? await this.coRepo.findOne({ where: { order_no: numericOrNo, user_id: uid } })
      : await this.coRepo.findOne({ where: { id: Number(id), user_id: uid } });
    if (!co || co.user_id !== uid) throw new Error('订单不存在');
    if (!['PENDING', 'ACCEPTED'].includes(co.status)) throw new Error('当前状态不可取消');
    co.status = 'CANCELLED';
    await this.coRepo.save(co);
    await this.addSystemMessage(co.id, 'CUSTOM_ORDER', `订单 ${co.order_no} 已取消。`);
    return { id: co.id, status: 'CANCELLED' };
  }

/** 系统消息（下单/确认收货/取消时写入商家端收件箱） */
  private async addSystemMessage(orderId: number, bizType: 'CUSTOM_ORDER' | 'STORE_ORDER', content: string) {
    await this.msgRepo.save(
      this.msgRepo.create({
        biz_type: bizType,
        order_id: orderId,
        sender_type: 'STAFF',
        sender_id: 0,
        sender_name: '系统',
        message_type: 'SYSTEM',
        content,
      }),
    );
  }

  /** 消费积分奖励（确认收货时） */
  private async earnPoints(uid: number, changeType: 'EARN', amount: string | number, orderNo: string) {
    const u = await this.userRepo.findOne({ where: { id: uid } });
    if (!u) return;
    const pts = Math.floor(Number(amount));
    if (pts <= 0) return;
    u.points = (u.points ?? 0) + pts;
    u.cumulative_points = (u.cumulative_points ?? 0) + pts;
    await this.userRepo.save(u);
  }

  private toOrderListItem(o: CustomOrder): any {
    return {
      id: o.id,
      orderNo: o.order_no,
      status: this.toFrontStatus(o.status),
      statusText: STATUS_TEXT[o.status] || o.status,
      totalPrice: Number(o.total_price || 0),
      title: `来图定制 · ${o.width}×${o.height}cm`,
      image: o.image_url || '',
      qty: Math.max(1, Math.round(o.total_beans / Math.max(1, Math.round((o.width / 0.26) * (o.height / 0.26))))),
      createdAt: fmtTime(o.created_at),
      updatedAt: fmtTime(o.updated_at),
      contact: o.contact,
      phone: o.contact,
      express: o.tracking_no ? { company: o.tracking_company || '', no: o.tracking_no } : null,
    };
  }

  private toOrderDetail(o: CustomOrder, extraTimeline: Array<[string, string]> = []): any {
    return {
      id: o.id,
      orderNo: o.order_no,
      type: 'custom',
      status: this.toFrontStatus(o.status),
      statusText: STATUS_TEXT[o.status] || o.status,
      totalPrice: Number(o.total_price || 0),
      deposit: Number(o.deposit || 0),
      title: `来图定制 · ${o.width}×${o.height}cm`,
      image: o.image_url || '',
      width: o.width,
      height: o.height,
      colorCount: o.color_count,
      style: o.style,
      ironType: o.iron_type,
      remark: o.remark || '',
      contact: o.contact,
      phone: o.contact,
      address: o.address || '',
      nickname: o.nickname,
      createdAt: fmtTime(o.created_at),
      updatedAt: fmtTime(o.updated_at),
      expectedTime: o.expected_time ? fmtTime(o.expected_time) : '',
      shippedAt: o.shipped_at ? fmtTime(o.shipped_at) : '',
      express: o.tracking_no ? { company: o.tracking_company || '', no: o.tracking_no } : null,
      timeline: this.buildTimeline(o, extraTimeline),
    };
  }

private toStoreOrderListItem(o: StoreOrder): any {
    const stMap: Record<string, string> = {
      TIMING: '计时中', COMPLETED: '待收款', SETTLED: '已结账',
      CANCELLED: '已取消', PAID: '已支付', DONE: '已完成',
    };
    return {
      id: o.id,
      orderNo: o.order_no,
      status: this.toStoreFrontStatus(o.status),
      statusText: stMap[o.status] || o.status,
      totalPrice: Number(o.settled_fee || o.total_fee || 0),
      title: '到店 DIY 体验',
      image: '',
      qty: 1,
      createdAt: fmtTime(o.created_at),
    };
  }

  private toAccessoryListItem(o: AccessoryOrder): any {
    const items = Array.isArray(o.items_json) ? o.items_json : [];
    return {
      id: o.order_no,
      orderNo: o.order_no,
      status: o.status === 'PAID' ? 'paid' : o.status.toLowerCase(),
      statusText: o.status === 'PAID' ? '已支付' : o.status,
      totalPrice: Number(o.total_price || 0),
      title: items.length ? items[0].name : '商城商品',
      image: items.length ? items[0].cover || '' : '',
      qty: items.reduce((s, i) => s + Number(i.qty || 1), items.length || 1) || 1,
      createdAt: fmtTime(o.created_at),
    };
  }

  private toAccessoryOrderDetail(o: AccessoryOrder): any {
    const items = Array.isArray(o.items_json) ? o.items_json : [];
    const total = Number(o.total_price || 0);
    return {
      id: o.order_no,
      orderNo: o.order_no,
      type: 'mall',
      status: o.status === 'PAID' ? 'paid' : o.status.toLowerCase(),
      statusText: o.status === 'PAID' ? '已支付' : o.status,
      totalPrice: total,
      title: items.length ? items[0].name : '商城商品',
      image: items.length ? items[0].cover || '' : '',
      qty: items.reduce((s, i) => s + Number(i.qty || 1), items.length || 1) || 1,
      items: items.map((i: any) => ({ name: i.name, qty: i.qty, amount: Number(i.amount || i.price || 0) })),
      createdAt: fmtTime(o.created_at),
      paidAt: o.pay_status === 'PAID' ? fmtTime(o.created_at) : '',
      timeline: [
        { time: fmtTime(o.created_at), text: '订单已提交' },
        ...(o.pay_status === 'PAID' ? [{ time: fmtTime(o.created_at), text: '支付成功' }] : []),
      ],
    };
  }

private async toStoreOrderDetail(o: StoreOrder, uid: number): Promise<any> {
    const items = await this.soiRepo.find({ where: { store_order_id: o.id } });
    const pay = await this.payRepo.findOne({ where: { biz_type: 'STORE_SETTLE', biz_id: o.id } });
    const stMap: Record<string, string> = {
      TIMING: '计时中', COMPLETED: '待收款', SETTLED: '已结账',
      CANCELLED: '已取消', PAID: '已支付', DONE: '已完成',
    };
    return {
      id: o.id,
      orderNo: o.order_no,
      type: 'store',
      status: this.toStoreFrontStatus(o.status),
      statusText: stMap[o.status] || o.status,
      totalPrice: Number(o.settled_fee || o.total_fee || 0),
      title: '到店 DIY 体验',
      image: '',
      qty: items.reduce((s, i) => s + i.quantity, 0) || 1,
      items: items.map((i) => ({ name: i.name, qty: i.quantity, amount: Number(i.amount || 0), amountText: `¥${Number(i.amount || 0).toFixed(2)}` })),
      createdAt: fmtTime(o.created_at),
      paidAt: pay?.paid_at ? fmtTime(pay.paid_at) : '',
      timeline: [
        { time: fmtTime(o.created_at), text: '订单已提交' },
        ...(pay?.paid_at ? [{ time: fmtTime(pay.paid_at), text: '支付成功' }] : []),
      ],
    };
  }

  private buildTimeline(o: CustomOrder, extra: Array<[string, string]>): Array<{ time: string; text: string }> {
    const t: Array<{ time: string; text: string }> = [{ time: fmtTime(o.created_at), text: '订单已提交' }];
    if (o.deposit_paid) t.push({ time: fmtTime(o.created_at), text: '定金已支付' });
    if (['ACCEPTED', 'COLORING', 'ASSEMBLING', 'IRONING', 'QC_PENDING', 'QC_PASSED', 'DONE', 'SHIPPED', 'DELIVERED', 'CONFIRMED'].includes(o.status)) {
      t.push({ time: fmtTime(o.updated_at), text: '门店已接单' });
    }
    if (o.shipped_at) t.push({ time: fmtTime(o.shipped_at), text: '已发货' });
    if (o.delivered_at) t.push({ time: fmtTime(o.delivered_at), text: '已送达' });
    if (o.confirmed_at) t.push({ time: fmtTime(o.confirmed_at), text: '已确认收货' });
    for (const [text, time] of extra) t.push({ time, text });
    return t;
  }

  private toFrontStatus(st: string): string {
    switch (st) {
      case 'PENDING': return 'pending_payment';
      case 'ACCEPTED': return 'paid';
      case 'COLORING':
      case 'ASSEMBLING':
      case 'IRONING': return 'in_production';
      case 'QC_PENDING':
      case 'QC_PASSED': return 'quality_checking';
      case 'DONE':
      case 'SHIPPED':
      case 'DELIVERED': return 'shipping';
      case 'CONFIRMED': return 'completed';
      case 'CANCELLED': return 'cancelled';
      default: return st;
    }
  }

private toStoreFrontStatus(st: string): string {
    switch (st) {
      case 'TIMING': return 'timing';
      case 'COMPLETED': return 'pending_settle';
      case 'SETTLED': return 'completed';
      case 'CANCELLED': return 'cancelled';
      case 'PAID': return 'paid';
      case 'DONE': return 'completed';
      default: return st;
    }
  }
}