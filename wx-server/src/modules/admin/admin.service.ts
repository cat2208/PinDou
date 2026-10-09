import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CustomOrder, CustomOrderQc, StoreOrder } from '../../entities/order.entity';
import { OrderMessage, AuditLog, PaymentRecord } from '../../entities/system.entity';
import { Staff } from '../../entities/store.entity';
import { User } from '../../entities/user.entity';
import { JwtUser } from '../../common/auth.guard';
import { fmtTime } from '../../common/utils';

/** 店员端可见的状态流转动作 */
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['COLORING', 'CANCELLED'],
  COLORING: ['ASSEMBLING'],
  ASSEMBLING: ['IRONING'],
  IRONING: ['QC_PENDING'],
  QC_PENDING: ['QC_PASSED'],
  QC_PASSED: ['DONE'],
  DONE: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

const STATUS_CN: Record<string, string> = {
  PENDING: '待接单', ACCEPTED: '已接单', COLORING: '制豆中', ASSEMBLING: '拼装中',
  IRONING: '熨烫中', QC_PENDING: '质检中', QC_PASSED: '质检通过', DONE: '已完成',
  SHIPPED: '已发货', DELIVERED: '待确认', CONFIRMED: '已完成', CANCELLED: '已取消',
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(CustomOrder) private readonly coRepo: Repository<CustomOrder>,
    @InjectRepository(CustomOrderQc) private readonly qcRepo: Repository<CustomOrderQc>,
    @InjectRepository(StoreOrder) private readonly soRepo: Repository<StoreOrder>,
    @InjectRepository(OrderMessage) private readonly msgRepo: Repository<OrderMessage>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** GET /api/admin/orders 店员端定制订单列表 */
  async orders(status?: string, page = 1, pageSize = 20) {
    const qb = this.coRepo.createQueryBuilder('o').orderBy('o.created_at', 'DESC');
    if (status && status !== 'ALL') qb.andWhere('o.status = :st', { st: status });
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return {
      list: rows.map((o) => ({
        id: o.id,
        orderNo: o.order_no,
        userId: o.user_id,
        image: o.image_url,
        patternUrl: o.pattern_url,
        totalBeans: o.total_beans,
        colorCount: o.color_count,
        width: o.width,
        height: o.height,
        contact: o.contact,
        status: o.status,
        statusText: STATUS_CN[o.status] || o.status,
        totalPrice: Number(o.total_price || 0),
        deposit: Number(o.deposit || 0),
        createdAt: fmtTime(o.created_at),
        updatedAt: fmtTime(o.updated_at),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** GET /api/admin/orders/:id 店员端订单详情 */
  async orderDetail(id: number) {
    const o = await this.coRepo.findOne({ where: { id } });
    if (!o) throw new Error('订单不存在');
    const user = o.user_id ? await this.userRepo.findOne({ where: { id: o.user_id } }) : null;
    const qcRows = await this.qcRepo.find({ where: { custom_order_id: o.id }, order: { id: 'ASC' } });
    return {
      id: o.id,
      orderNo: o.order_no,
      user: user ? { id: user.id, nickname: user.nickname, phone: user.phone } : { id: o.user_id },
      image: o.image_url,
      patternUrl: o.pattern_url,
      width: o.width,
      height: o.height,
      totalBeans: o.total_beans,
      colorCount: o.color_count,
      style: o.style,
      difficulty: o.difficulty,
      ironType: o.iron_type,
      colors: Array.isArray(o.colors_json) ? o.colors_json : (o.colors_json && Array.isArray(o.colors_json.colors) ? o.colors_json.colors : []),
      priceBreakdown: {
        bean: Number(o.price_bean || 0),
        labor: Number(o.price_labor || 0),
        iron: Number(o.price_iron || 0),
        accessory: Number(o.price_accessory || 0),
        shipping: Number(o.price_shipping || 0),
        total: Number(o.total_price || 0),
        deposit: Number(o.deposit || 0),
      },
      contact: o.contact,
      address: o.address,
      remark: o.remark,
      status: o.status,
      statusText: STATUS_CN[o.status] || o.status,
      createdAt: fmtTime(o.created_at),
      updatedAt: fmtTime(o.updated_at),
      qcRecords: qcRows.map((q) => ({
        id: q.id,
        result: q.result,
        failReason: q.fail_reason,
        reworkTarget: q.rework_target,
        staffName: q.qc_staff_name,
        images: q.qc_images || [],
        remark: q.remark,
        time: fmtTime(q.created_at),
      })),
    };
  }

  /** POST /api/admin/orders/:id/status 流转状态 { to, trackingCompany?, trackingNo?, failReason? } */
  async advanceOrder(id: number, staff: JwtUser, body: { to?: string; trackingCompany?: string; trackingNo?: string; failReason?: string }) {
    const o = await this.coRepo.findOne({ where: { id } });
    if (!o) throw new Error('订单不存在');
    const to = body?.to || '';
    const allowed = NEXT_STATUS[o.status] || [];
    if (!allowed.includes(to)) {
      throw new Error(`当前状态（${STATUS_CN[o.status] || o.status}）不能流转到 ${to}`);
    }
    const before = o.status;
    const staffInfo = await this.staffRepo.findOne({ where: { id: staff.uid } });

    // 处理 QC 记录
    if (to === 'QC_PASSED' || to === 'QC_PENDING' || to === 'QC_PASSED') {
      // 质检记录在 FAIL 时写 failReason
    }
    if (to === 'QC_PASSED' && body?.failReason) {
      // 视为质检不通过回退制豆
      o.status = 'COLORING';
      await this.coRepo.save(o);
      await this.qcRepo.save(
        this.qcRepo.create({
          custom_order_id: o.id,
          store_id: o.store_id ?? null,
          qc_staff_id: staff.uid,
          qc_staff_name: staffInfo?.real_name || staffInfo?.username || '',
          result: 'FAIL',
          fail_reason: body.failReason,
          rework_target: 'COLORING',
          qc_images: [],
          remark: '质检不通过，退回制豆',
        }),
      );
      await this.audit(o, before, 'QC_FAIL', staff, `质检不通过：${body.failReason}`);
      await this.sendStaffMessage(o, `质检未通过：${body.failReason}，已退回制豆环节`);
      return { id: o.id, status: o.status, statusText: STATUS_CN[o.status] };
    }

    if (to === 'QC_PENDING') {
      await this.qcRepo.save(
        this.qcRepo.create({
          custom_order_id: o.id,
          store_id: o.store_id ?? null,
          qc_staff_id: staff.uid,
          qc_staff_name: staffInfo?.real_name || staffInfo?.username || '',
          result: 'PASS',
          qc_images: [],
          remark: '提交质检',
        }),
      );
    }

    o.status = to as any;
    if (to === 'ACCEPTED') {
      o.assigned_staff_id = staff.uid;
    }
    if (to === 'SHIPPED') {
      o.tracking_company = body?.trackingCompany || o.tracking_company;
      o.tracking_no = body?.trackingNo || o.tracking_no;
      o.shipped_at = new Date();
      if (!o.tracking_no) throw new Error('发货需要填写运单号');
    }
    await this.coRepo.save(o);
    await this.audit(o, before, 'ADVANCE_' + to, staff, `状态流转 ${STATUS_CN[before]} → ${STATUS_CN[to]}`);
    await this.sendStaffMessage(o, `您的订单进度更新：${STATUS_CN[to]}`);
    return { id: o.id, status: o.status, statusText: STATUS_CN[o.status] || o.status };
  }

  /** GET /api/admin/stats 经营统计概览 */
  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [customTotal, pendingQc, staffTotal, storeTotal] = await Promise.all([
      this.coRepo.count(),
      this.coRepo.count({ where: { status: 'QC_PENDING' } }),
      this.staffRepo.count({ where: { enabled: 1 } }),
      this.soRepo.count(),
    ]);
    const paidRows = await this.payRepo.find({ where: { status: 'PAID' } });
    const todayRows = paidRows.filter((p) => p.paid_at && p.paid_at >= today);
    const sum = (rows: PaymentRecord[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    return {
      todayOrderCount: customTotal + storeTotal,
      todayRevenue: Math.round(sum(todayRows) * 100) / 100,
      totalRevenue: Math.round(sum(paidRows) * 100) / 100,
      pendingQc,
      customTotal,
      staffTotal,
      storeTotal,
    };
  }

  /** GET /api/admin/staff 店员列表 */
  async staffList() {
    const rows = await this.staffRepo.find({ order: { id: 'ASC' } });
    return {
      list: rows.map((s) => ({
        id: s.id,
        username: s.username,
        realName: s.real_name,
        role: s.role,
        storeId: s.store_id,
        enabled: s.enabled,
      })),
    };
  }

  private async audit(o: CustomOrder, before: string, action: string, staff: JwtUser, remark: string) {
    await this.auditRepo.save(
      this.auditRepo.create({
        store_id: o.store_id ?? null,
        operator_type: 'STAFF',
        operator_id: staff.uid,
        operator_name: staff.nickname || String(staff.uid),
        action,
        target_type: 'CUSTOM_ORDER',
        target_id: o.id,
        before_value: { status: before },
        after_value: { status: o.status },
        remark,
      }),
    );
  }

  private async sendStaffMessage(o: CustomOrder, content: string) {
    await this.msgRepo.save(
      this.msgRepo.create({
        biz_type: 'CUSTOM_ORDER',
        order_id: o.id,
        store_id: o.store_id ?? null,
        sender_type: 'STAFF',
        sender_id: 0,
        sender_name: '门店',
        message_type: 'SYSTEM',
        content,
      }),
    );
    o.last_message_at = new Date();
    await this.coRepo.save(o);
  }
}