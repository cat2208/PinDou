import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Product, Inventory, InventoryLog } from '../../entities/content.entity';
import { Coupon, CouponRedeemLog, PricingConfig } from '../../entities/shop.entity';
import { User, MemberLevelConfig } from '../../entities/user.entity';
import { PaymentRecord, AuditLog } from '../../entities/system.entity';
import { CustomOrder, StoreOrder, StoreOrderItem } from '../../entities/order.entity';
import { Seat, Package } from '../../entities/store.entity';
import { fmtTime, genNo } from '../../common/utils';
import { JwtUser } from '../../common/auth.guard';

/**
 * 运营管理后台服务（PC 端）：定价配置 / 商品 / 库存 / 优惠券 / 会员 / 仪表盘
 * 仅 OWNER / MANAGER 角色可访问（controller 层 @Roles 控制）
 */
@Injectable()
export class OpsService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Inventory) private readonly invRepo: Repository<Inventory>,
    @InjectRepository(InventoryLog) private readonly invLogRepo: Repository<InventoryLog>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(PricingConfig) private readonly pricingRepo: Repository<PricingConfig>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(MemberLevelConfig) private readonly levelRepo: Repository<MemberLevelConfig>,
    @InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(CustomOrder) private readonly coRepo: Repository<CustomOrder>,
    @InjectRepository(StoreOrder) private readonly soRepo: Repository<StoreOrder>,
    @InjectRepository(StoreOrderItem) private readonly soiRepo: Repository<StoreOrderItem>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    @InjectRepository(Package) private readonly pkgRepo: Repository<Package>,
    @InjectRepository(CouponRedeemLog) private readonly redeemLogRepo: Repository<CouponRedeemLog>,
  ) {}

  // ---------------------------------------------------------------
  // 仪表盘
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/overview 经营概览 + 近 7 日趋势 */
  async overview() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const paidRows = await this.payRepo.find({ where: { status: 'PAID' } });
    const sum = (rows: PaymentRecord[]) =>
      Math.round(rows.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;

    const todayPaid = paidRows.filter((p) => p.paid_at && p.paid_at >= dayStart);
    const [pendingCount, qcPending, lowStock, customToday, storeToday] = await Promise.all([
      this.coRepo.count({ where: { status: 'PENDING' } }),
      this.coRepo.count({ where: { status: 'QC_PENDING' } }),
      this.invRepo
        .createQueryBuilder('i')
        .where('i.quantity <= i.alert_threshold')
        .getCount(),
      this.coRepo.count({ where: { created_at: Between(dayStart, new Date()) } }),
      this.soRepo.count({ where: { created_at: Between(dayStart, new Date()) } }),
    ]);

    // 近 7 日销售额（按支付时间）
    const trend: { date: string; amount: number; orderCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dayStart.getTime() - i * 86400000);
      const next = new Date(d.getTime() + 86400000);
      const rows = paidRows.filter((p) => p.paid_at && p.paid_at >= d && p.paid_at < next);
      trend.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        amount: sum(rows),
        orderCount: rows.length,
      });
    }

    return {
      todayOrderCount: customToday + storeToday,
      todayRevenue: sum(todayPaid),
      totalRevenue: sum(paidRows),
      pendingCount,
      qcPending,
      lowStock,
      customTotal: await this.coRepo.count(),
      storeTotal: await this.soRepo.count(),
      memberTotal: await this.userRepo.count(),
      trend,
    };
  }

  // ---------------------------------------------------------------
  // 商品管理
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/products?category=&keyword=&page=&pageSize= */
  async products(category?: string, keyword?: string, page = 1, pageSize = 20) {
    const qb = this.productRepo.createQueryBuilder('p').orderBy('p.id', 'DESC');
    if (category && category !== 'ALL') qb.andWhere('p.category = :c', { c: category });
    if (keyword) {
      qb.andWhere('(p.title LIKE :k OR p.sku LIKE :k)', { k: `%${keyword}%` });
    }
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return {
      list: rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        category: p.category,
        title: p.title,
        cover: p.cover,
        price: Number(p.price || 0),
        stock: p.stock,
        beanCount: p.bean_count,
        enabled: p.enabled,
        createdAt: fmtTime(p.created_at),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** POST /api/admin/ops/products 新建商品 */
  async createProduct(body: any) {
    const sku = String(body?.sku || '').trim();
    if (!sku) throw new Error('SKU 必填');
    const exist = await this.productRepo.findOne({ where: { sku } });
    if (exist) throw new Error('SKU 已存在');
    const row = this.productRepo.create({
      sku,
      store_id: body?.storeId ? Number(body.storeId) : null,
      category: body?.category || 'FINISHED',
      title: String(body?.title || '').trim() || sku,
      cover: String(body?.cover || ''),
      tags: String(body?.tags || ''),
      price: String(body?.price ?? 0),
      stock: Number(body?.stock) || 0,
      bean_count: body?.beanCount ? Number(body.beanCount) : null,
      description: body?.description || null,
      enabled: body?.enabled === undefined ? 1 : body?.enabled ? 1 : 0,
    });
    const saved = await this.productRepo.save(row);
    return { id: saved.id };
  }

  /** PUT /api/admin/ops/products/:id 更新商品（含上下架） */
  async updateProduct(id: number, body: any) {
    const row = await this.productRepo.findOne({ where: { id } });
    if (!row) throw new Error('商品不存在');
    if (body.sku !== undefined && String(body.sku).trim() !== row.sku) {
      const exist = await this.productRepo.findOne({ where: { sku: String(body.sku).trim() } });
      if (exist && exist.id !== id) throw new Error('SKU 已存在');
    }
    const fields: any = {};
    if (body.sku !== undefined) fields.sku = String(body.sku).trim();
    if (body.category !== undefined) fields.category = body.category;
    if (body.title !== undefined) fields.title = String(body.title).trim();
    if (body.cover !== undefined) fields.cover = String(body.cover);
    if (body.price !== undefined) fields.price = String(body.price);
    if (body.stock !== undefined) fields.stock = Math.max(0, Number(body.stock) || 0);
    if (body.beanCount !== undefined) fields.bean_count = body.beanCount ? Number(body.beanCount) : null;
    if (body.tags !== undefined) fields.tags = String(body.tags);
    if (body.description !== undefined) fields.description = body.description || null;
    if (body.enabled !== undefined) fields.enabled = body.enabled ? 1 : 0;
    Object.assign(row, fields);
    await this.productRepo.save(row);
    return { id: row.id };
  }

  // ---------------------------------------------------------------
  // 库存
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/inventory?keyword= */
  async inventory(keyword?: string) {
    const qb = this.invRepo.createQueryBuilder('i').orderBy('i.quantity', 'ASC');
    if (keyword) qb.andWhere('(i.item_name LIKE :k OR i.item_code LIKE :k)', { k: `%${keyword}%` });
    const rows = await qb.getMany();
    return {
      list: rows.map((i) => ({
        id: i.id,
        itemType: i.item_type,
        itemName: i.item_name,
        itemCode: i.item_code,
        quantity: i.quantity,
        unit: i.unit,
        alertThreshold: i.alert_threshold,
        low: i.quantity <= i.alert_threshold,
        lastRestockAt: fmtTime(i.last_restock_at),
      })),
    };
  }

  /** POST /api/admin/ops/inventory/:id/restock 入库调整 { quantity, remark } */
  async restock(id: number, staff: JwtUser, body: { quantity?: number; remark?: string }) {
    const row = await this.invRepo.findOne({ where: { id } });
    if (!row) throw new Error('库存条目不存在');
    const qty = Math.round(Number(body?.quantity) || 0);
    if (qty === 0) throw new Error('入库数量必须非 0');
    const before = row.quantity;
    row.quantity = Math.max(0, before + qty);
    row.last_restock_at = qty > 0 ? new Date() : row.last_restock_at;
    await this.invRepo.save(row);
    await this.invLogRepo.save(
      this.invLogRepo.create({
        store_id: row.store_id,
        inventory_id: row.id,
        change_type: qty > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(qty),
        direction: qty > 0 ? 1 : -1,
        before_quantity: before,
        after_quantity: row.quantity,
        ref_order_no: null,
        operator_id: staff.uid,
        remark: body?.remark || '',
      }),
    );
    return { id: row.id, quantity: row.quantity };
  }

  // ---------------------------------------------------------------
  // 优惠券
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/coupons?status=&page=&pageSize= 券列表（含归属用户昵称） */
  async coupons(status?: string, page = 1, pageSize = 20) {
    const qb = this.couponRepo.createQueryBuilder('c').orderBy('c.id', 'DESC');
    if (status && status !== 'ALL') qb.andWhere('c.status = :s', { s: status });
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    const userIds = [...new Set(rows.filter((r) => r.user_id).map((r) => r.user_id))];
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.nickname || u.openid]));
    return {
      list: rows.map((c) => ({
        id: c.id,
        code: c.code,
        userId: c.user_id,
        userName: c.user_id ? userMap.get(c.user_id) || String(c.user_id) : '（可兑换）',
        couponType: c.coupon_type,
        source: c.source,
        faceValue: c.face_value === null ? null : Number(c.face_value),
        discountRate: c.discount_rate === null ? null : Number(c.discount_rate),
        status: c.status,
        usedCount: c.used_count,
        totalCount: c.total_count,
        expireAt: fmtTime(c.expire_at),
        createdAt: fmtTime(c.created_at),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** POST /api/admin/ops/coupons 发放券 */
  async createCoupon(body: any) {
    const code = String(body?.code || '').trim();
    if (!code) throw new Error('券码必填');
    const exist = await this.couponRepo.findOne({ where: { code } });
    if (exist) throw new Error('券码已存在');
    const row = this.couponRepo.create({
      code,
      user_id: body?.userId ? Number(body.userId) : null,
      coupon_type: body?.couponType || 'DISCOUNT',
      source: body?.source || 'SYSTEM',
      face_value: body?.faceValue !== undefined && body.faceValue !== null ? String(body.faceValue) : null,
      discount_rate: body?.discountRate !== undefined && body.discountRate !== null ? String(body.discountRate) : null,
      status: body?.status || 'UNUSED',
      total_count: Number(body?.totalCount) || 1,
      expire_at: body?.expireAt ? new Date(body.expireAt) : null,
    });
    const saved = await this.couponRepo.save(row);
    return { id: saved.id };
  }

  /** PUT /api/admin/ops/coupons/:id 编辑券（状态/有效期） */
  async updateCoupon(id: number, body: any) {
    const row = await this.couponRepo.findOne({ where: { id } });
    if (!row) throw new Error('券不存在');
    if (body.status !== undefined) row.status = body.status;
    if (body.totalCount !== undefined) row.total_count = Number(body.totalCount) || 1;
    if (body.expireAt !== undefined && body.expireAt !== null) row.expire_at = new Date(body.expireAt);
    if (body.faceValue !== undefined) row.face_value = body.faceValue === null ? null : String(body.faceValue);
    if (body.discountRate !== undefined) row.discount_rate = body.discountRate === null ? null : String(body.discountRate);
    await this.couponRepo.save(row);
    return { id: row.id };
  }

  // ---------------------------------------------------------------
  // 运营定价（含拼豆定价参数）
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/pricing 读取全局定价（store_id IS NULL），不存在则建默认行 */
  async pricing() {
    let row = await this.pricingRepo.findOne({ where: { store_id: IsNull() } });
    if (!row) {
      row = await this.pricingRepo.save(this.pricingRepo.create({ store_id: null }));
    }
    return {
      beanUnitPrice: Number(row.bean_unit_price),
      laborPriceNormal: Number(row.labor_price_normal),
      laborPriceComplex: Number(row.labor_price_complex),
      colorThreshold: row.color_threshold,
      ironGlitterMin: Number(row.iron_glitter_min),
      ironGlitterMax: Number(row.iron_glitter_max),
      accessoryKeychain: Number(row.accessory_keychain),
      accessoryFridgeMagnet: Number(row.accessory_fridge_magnet),
      accessoryFrame: Number(row.accessory_frame),
      accessoryNoHoleDouble: Number(row.accessory_no_hole_double),
      shippingFee: Number(row.shipping_fee),
      freeShippingThreshold: Number(row.free_shipping_threshold),
      cancelFreeHours: row.cancel_free_hours,
      depositRatio: Number(row.deposit_ratio),
      inventoryDeductStrategy: row.inventory_deduct_strategy,
      pointsPerYuan: row.points_per_yuan,
      pointsToYuanRate: row.points_to_yuan_rate,
      pointsDeductMaxRatio: Number(row.points_deduct_max_ratio),
      birthdayDoublePoints: row.birthday_double_points,
      pointsExpireMonths: row.points_expire_months,
      autoConfirmDays: row.auto_confirm_days,
      updatedAt: fmtTime(row.updated_at),
    };
  }

  /** PUT /api/admin/ops/pricing 更新全局定价 */
  async updatePricing(body: any, staff: JwtUser) {
    let row = await this.pricingRepo.findOne({ where: { store_id: IsNull() } });
    if (!row) row = this.pricingRepo.create({ store_id: null as any });
    const dec = (v: any, d: string) => (v === undefined || v === null || v === '' ? d : String(v));
    const int = (v: any, d: number) => (v === undefined || v === null || v === '' ? d : Math.round(Number(v)));
    row.bean_unit_price = dec(body.beanUnitPrice, row.bean_unit_price);
    row.labor_price_normal = dec(body.laborPriceNormal, row.labor_price_normal);
    row.labor_price_complex = dec(body.laborPriceComplex, row.labor_price_complex);
    row.color_threshold = int(body.colorThreshold, row.color_threshold);
    row.iron_glitter_min = dec(body.ironGlitterMin, row.iron_glitter_min);
    row.iron_glitter_max = dec(body.ironGlitterMax, row.iron_glitter_max);
    row.accessory_keychain = dec(body.accessoryKeychain, row.accessory_keychain);
    row.accessory_fridge_magnet = dec(body.accessoryFridgeMagnet, row.accessory_fridge_magnet);
    row.accessory_frame = dec(body.accessoryFrame, row.accessory_frame);
    row.accessory_no_hole_double = dec(body.accessoryNoHoleDouble, row.accessory_no_hole_double);
    row.shipping_fee = dec(body.shippingFee, row.shipping_fee);
    row.free_shipping_threshold = dec(body.freeShippingThreshold, row.free_shipping_threshold);
    row.cancel_free_hours = int(body.cancelFreeHours, row.cancel_free_hours);
    row.deposit_ratio = dec(body.depositRatio, row.deposit_ratio);
    if (body.inventoryDeductStrategy !== undefined) row.inventory_deduct_strategy = body.inventoryDeductStrategy;
    row.points_per_yuan = int(body.pointsPerYuan, row.points_per_yuan);
    row.points_to_yuan_rate = int(body.pointsToYuanRate, row.points_to_yuan_rate);
    row.points_deduct_max_ratio = dec(body.pointsDeductMaxRatio, row.points_deduct_max_ratio);
    row.birthday_double_points = body.birthdayDoublePoints === undefined ? row.birthday_double_points : body.birthdayDoublePoints ? 1 : 0;
    row.points_expire_months = int(body.pointsExpireMonths, row.points_expire_months);
    row.auto_confirm_days = int(body.autoConfirmDays, row.auto_confirm_days);
    await this.pricingRepo.save(row);
    await this.auditRepo.save(
      this.auditRepo.create({
        store_id: null,
        operator_type: 'STAFF',
        operator_id: staff.uid,
        operator_name: staff.nickname || String(staff.uid),
        action: 'UPDATE_PRICING',
        target_type: 'PRICING_CONFIG',
        target_id: row.id,
        before_value: null,
        after_value: null,
        remark: 'PC 后台更新运营定价',
      }),
    );
    return { id: row.id };
  }

  // ---------------------------------------------------------------
  // 会员
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/members?keyword=&page=&pageSize= 会员列表 */
  async members(keyword?: string, page = 1, pageSize = 20) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.id', 'DESC');
    if (keyword) {
      qb.andWhere('(u.nickname LIKE :k OR u.phone LIKE :k OR u.openid LIKE :k)', { k: `%${keyword}%` });
    }
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return {
      list: rows.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        phone: u.phone,
        avatar: u.avatar,
        memberLevel: u.member_level,
        points: u.points,
        cumulativePoints: u.cumulative_points,
        balance: Number(u.balance || 0),
        createdAt: fmtTime(u.created_at),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** GET /api/admin/ops/member-levels 会员等级配置 */
  async memberLevels() {
    const rows = await this.levelRepo.find({ order: { level: 'ASC' } });
    return {
      list: rows.map((l) => ({
        id: l.id,
        level: l.level,
        name: l.name,
        minCumulativePoints: l.min_cumulative_points,
        discountRate: Number(l.discount_rate || 1),
        benefits: l.benefits_json || [],
        enabled: l.enabled,
      })),
    };
  }

  /** PUT /api/admin/ops/member-levels/:id 更新等级配置 */
  async updateMemberLevel(id: number, body: any) {
    const row = await this.levelRepo.findOne({ where: { id } });
    if (!row) throw new Error('等级不存在');
    if (body.name !== undefined) row.name = String(body.name);
    if (body.minCumulativePoints !== undefined) row.min_cumulative_points = Math.max(0, Number(body.minCumulativePoints) || 0);
    if (body.discountRate !== undefined) row.discount_rate = String(body.discountRate);
    if (body.benefits !== undefined) row.benefits_json = Array.isArray(body.benefits) ? body.benefits : [];
    if (body.enabled !== undefined) row.enabled = body.enabled ? 1 : 0;
    await this.levelRepo.save(row);
    return { id: row.id };
  }

  // ---------------------------------------------------------------
  // 收银台（V2：到店拼豆统一结账）
  // ---------------------------------------------------------------
  private r2(n: number) {
    return Math.round(n * 100) / 100;
  }

  /** GET /api/admin/ops/cashier/orders?status= 收银台订单列表
   *  status=PENDING 待收款（COMPLETED）；status=TIMING 计时中；不传返回全部未结账订单 */
  async cashierOrders(status?: string) {
    const qb = this.soRepo.createQueryBuilder('o').orderBy('o.id', 'DESC');
    if (status === 'PENDING') qb.where('o.status = :s', { s: 'COMPLETED' });
    else if (status === 'TIMING') qb.where('o.status = :s', { s: 'TIMING' });
    else qb.where('o.status IN (:...s)', { s: ['TIMING', 'COMPLETED'] });
    const rows = await qb.getMany();
    const seatIds = [...new Set(rows.map((o) => o.seat_id))];
    const seatMap = new Map(
      seatIds.length ? (await this.seatRepo.find({ where: { id: In(seatIds) } })).map((s) => [s.id, s]) : [],
    );
    return {
      list: rows.map((o) => {
        const seat = seatMap.get(o.seat_id);
        const timingFee = Number(o.timing_fee || 0);
        const accessoryFee = Number(o.accessory_fee || 0);
        const totalFee = Number(o.total_fee || 0) > 0 ? Number(o.total_fee) : this.r2(timingFee + accessoryFee);
        return {
          orderId: o.id,
          orderNo: o.order_no,
          seatId: o.seat_id,
          seatNo: seat?.seat_no || '-',
          seatArea: seat?.area || '',
          status: o.status,
          timingType: o.timing_type,
          startAt: o.start_time ? fmtTime(o.start_time) : '',
          endAt: o.end_time ? fmtTime(o.end_time) : '',
          elapsedMinutes: this.sessionMinutes(o),
          overtimeMinutes: Number(o.overtime_minutes || 0),
          timingFee: this.r2(timingFee),
          accessoryFee: this.r2(accessoryFee),
          couponDeduction: this.r2(Number(o.coupon_deduction || 0)),
          totalFee: this.r2(totalFee),
          totalFeeText: `¥${this.r2(totalFee).toFixed(2)}`,
          createdAt: fmtTime(o.created_at),
        };
      }),
    };
  }

  /** 会话实际用时（分钟）：计时中按当前时间，已结束按 end-start */
  private sessionMinutes(o: StoreOrder) {
    if (!o.start_time) return 0;
    const end = o.end_time ? new Date(o.end_time).getTime() : Date.now();
    return Math.max(1, Math.ceil((end - new Date(o.start_time).getTime()) / 60000));
  }

  /** POST /api/admin/ops/cashier/:orderId/pay 完成收款
   *  body: { couponId?: number; discountAmount?: number; payMethod?: 'CASH'|'WECHAT' }
   *  流程：券抵扣/手动优惠 → 写 payment_record(STORE_SETTLE, PAID) → 订单 SETTLED → 座位 IDLE → 券核销日志 */
  async cashierPay(staff: JwtUser, orderId: number, body: any) {
    const order = await this.soRepo.findOne({ where: { id: orderId } });
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'COMPLETED') throw new Error('该订单不在待收款状态，无法收款');

    const totalFee = Number(order.total_fee || 0);
    let deduction = 0;
    let couponId: number | null = Number(body?.couponId) || null;
    let couponDeduct = 0;

    if (couponId) {
      const coupon = await this.couponRepo.findOne({ where: { id: couponId } });
      if (!coupon) throw new Error('优惠券不存在');
      if (coupon.status !== 'UNUSED') throw new Error('该券不可用（已使用/过期/收回）');
      if (coupon.expire_at && new Date(coupon.expire_at).getTime() < Date.now()) throw new Error('该券已过期');
      if (coupon.coupon_type === 'DISCOUNT') {
        const rate = Number(coupon.discount_rate ?? 1);
        couponDeduct = this.r2(totalFee * (1 - rate));
      } else {
        couponDeduct = this.r2(Math.min(Number(coupon.face_value || 0), totalFee));
      }
      deduction += couponDeduct;
    }

    const manual = Math.max(0, Number(body?.discountAmount) || 0);
    if (!couponId) deduction += manual;
    deduction = Math.min(deduction, totalFee);
    const settledFee = this.r2(totalFee - deduction);

    // 写支付记录
    await this.payRepo.save(
      this.payRepo.create({
        out_trade_no: `SE${genNo('')}`,
        biz_type: 'STORE_SETTLE',
        biz_id: order.id,
        user_id: order.user_id || null,
        store_id: order.store_id ?? null,
        amount: String(settledFee),
        status: 'PAID',
        paid_at: new Date(),
      }),
    );

    // 券核销
    if (couponId) {
      const coupon = await this.couponRepo.findOne({ where: { id: couponId } });
      if (coupon) {
        coupon.status = 'USED' as any;
        coupon.used_count = Math.max(0, Number(coupon.used_count || 0)) + 1;
        await this.couponRepo.save(coupon);
        await this.redeemLogRepo.save(
          this.redeemLogRepo.create({
            coupon_id: coupon.id,
            order_id: null,
            store_order_id: order.id,
            admin_id: staff.uid,
            action: 'USE',
            amount: String(couponDeduct),
            remark: `收银台收款核销（座位 ${order.seat_id}）`,
          }),
        );
      }
    }

    // 订单结账 + 座位释放
    order.status = 'SETTLED' as any;
    order.settled_fee = String(settledFee);
    order.coupon_deduction = String(couponDeduct);
    order.settled_at = new Date();
    order.settled_by_staff_id = staff.uid;
    if (couponId) order.coupon_id = couponId;
    await this.soRepo.save(order);

    const seat = await this.seatRepo.findOne({ where: { id: order.seat_id } });
    if (seat && seat.status !== 'IDLE') {
      seat.status = 'IDLE' as any;
      await this.seatRepo.save(seat);
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        store_id: order.store_id ?? null,
        operator_type: 'STAFF',
        operator_id: staff.uid,
        operator_name: staff.nickname || String(staff.uid),
        action: 'STORE_SETTLE',
        target_type: 'STORE_ORDER',
        target_id: order.id,
        before_value: null,
        after_value: { totalFee, couponDeduct, deduction, settledFee },
        remark: `收银台收款，实收 ¥${settledFee.toFixed(2)}`,
      }),
    );

    return {
      orderId: order.id,
      orderNo: order.order_no,
      totalFee: this.r2(totalFee),
      couponDeduct: this.r2(couponDeduct),
      discountAmount: this.r2(deduction - couponDeduct),
      deduction: this.r2(deduction),
      settledFee,
      settledFeeText: `¥${settledFee.toFixed(2)}`,
      status: 'SETTLED',
      message: '收款完成',
    };
  }

  /** PUT /api/admin/ops/cashier/:orderId/price 后台修改订单价格 { totalFee } */
  async cashierUpdatePrice(staff: JwtUser, orderId: number, body: any) {
    const order = await this.soRepo.findOne({ where: { id: orderId } });
    if (!order) throw new Error('订单不存在');
    if (order.status === 'SETTLED') throw new Error('已结账订单不可改价');
    const totalFee = Math.max(0, this.r2(Number(body?.totalFee) || 0));
    const before = Number(order.total_fee || 0);
    order.total_fee = String(totalFee);
    await this.soRepo.save(order);

    await this.auditRepo.save(
      this.auditRepo.create({
        store_id: order.store_id ?? null,
        operator_type: 'STAFF',
        operator_id: staff.uid,
        operator_name: staff.nickname || String(staff.uid),
        action: 'STORE_ORDER_PRICE',
        target_type: 'STORE_ORDER',
        target_id: order.id,
        before_value: { totalFee: before },
        after_value: { totalFee },
        remark: '收银台修改订单价格',
      }),
    );
    return { orderId: order.id, totalFee: this.r2(totalFee), message: '价格已更新' };
  }

  /** GET /api/admin/ops/cashier/coupons 可用于收银台的优惠券（UNUSED、未过期） */
  async cashierCoupons(keyword?: string) {
    const qb = this.couponRepo.createQueryBuilder('c').orderBy('c.id', 'DESC');
    if (keyword) qb.andWhere('c.code LIKE :k', { k: `%${String(keyword).trim()}%` });
    const rows = await qb.getMany();
    const now = Date.now();
    const usable = rows.filter(
      (c) => c.status === 'UNUSED' && (!c.expire_at || new Date(c.expire_at).getTime() >= now),
    );
    const typeText: Record<string, string> = {
      DURATION: '时长体验券',
      ACCESSORY: '配件抵扣券',
      MATERIAL: '材料包兑换券',
      DISCOUNT: '折扣券',
    };
    return {
      list: usable.map((c) => ({
        id: c.id,
        code: c.code,
        couponType: c.coupon_type,
        typeText: typeText[c.coupon_type] || c.coupon_type,
        value:
          c.coupon_type === 'DISCOUNT'
            ? `${Number(c.discount_rate || 0) * 10}折`
            : `¥${Number(c.face_value || 0).toFixed(2)}`,
        faceValue: c.face_value === null ? null : Number(c.face_value),
        discountRate: c.discount_rate === null ? null : Number(c.discount_rate),
        expireAt: c.expire_at ? fmtTime(c.expire_at) : '',
      })),
    };
  }

  /** GET /api/admin/ops/cashier/income 收入统计分项（计时/商品/定制 × 今日/近7日/累计） */
  async cashierIncome() {
    const paid = await this.payRepo.find({ where: { status: 'PAID' } });
    const r2 = this.r2;
    const sum = (rows: PaymentRecord[]) => r2(rows.reduce((s, r) => s + Number(r.amount || 0), 0));
    const classify = (rows: PaymentRecord[]) => {
      const timing = rows.filter((p) => p.biz_type === 'STORE_SETTLE');
      const goods = rows.filter((p) => p.biz_type === 'MALL' || p.biz_type === 'ACCESSORY');
      const custom = rows.filter((p) => p.biz_type === 'CUSTOM_DEPOSIT' || p.biz_type === 'CUSTOM_BALANCE');
      return {
        timing: sum(timing),
        goods: sum(goods),
        custom: sum(custom),
        total: sum(rows),
        orderCount: rows.length,
      };
    };

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = paid.filter((p) => p.paid_at && p.paid_at >= dayStart);
    const month = paid.filter((p) => p.paid_at && p.paid_at >= monthStart);

    const trend: { date: string; amount: number; orderCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dayStart.getTime() - i * 86400000);
      const next = new Date(d.getTime() + 86400000);
      const rows = paid.filter((p) => p.paid_at && p.paid_at >= d && p.paid_at < next);
      trend.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, amount: sum(rows), orderCount: rows.length });
    }

    return {
      today: classify(today),
      month: classify(month),
      total: classify(paid),
      trend,
    };
  }
}