import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, MemberLevelConfig, PointLog } from '../../entities/user.entity';
import { OrderMessage } from '../../entities/system.entity';
import { Coupon } from '../../entities/shop.entity';
import { JwtUser } from '../../common/auth.guard';
import { fmtTime, fmtDate } from '../../common/utils';

const LEVEL_NAMES = ['普通会员', '银卡会员', '金卡会员', '钻石会员'];

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(MemberLevelConfig) private readonly levelRepo: Repository<MemberLevelConfig>,
    @InjectRepository(PointLog) private readonly pointLogRepo: Repository<PointLog>,
    @InjectRepository(OrderMessage) private readonly msgRepo: Repository<OrderMessage>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
  ) {}

  private async requireUser(uid: number): Promise<User> {
    const u = await this.userRepo.findOne({ where: { id: uid, deleted_at: null } });
    if (!u) throw new Error('用户不存在或已注销');
    return u;
  }

  toPublicUser(u: User): any {
    const level = u.member_level ?? 0;
    return {
      id: u.id,
      nickname: u.nickname,
      phone: u.phone,
      avatar: u.avatar || '',
      memberLevel: level,
      memberLevelName: LEVEL_NAMES[level] || LEVEL_NAMES[0],
      points: u.points ?? 0,
      cumulativePoints: u.cumulative_points ?? 0,
      balance: Number(u.balance || 0),
      birthday: u.birthday ? fmtDate(u.birthday) : null,
      createdAt: fmtTime(u.created_at),
    };
  }

  /** GET /api/user/info */
  async userInfo(uid: number): Promise<any> {
    const u = await this.requireUser(uid);
    return this.toPublicUser(u);
  }

  /** POST /api/user/update { nickname?, phone?, birthday? } */
  async updateUser(uid: number, body: { nickname?: string; phone?: string; birthday?: string }): Promise<any> {
    const u = await this.requireUser(uid);
    if (body.nickname !== undefined) u.nickname = body.nickname;
    if (body.phone !== undefined) u.phone = body.phone;
    if (body.birthday !== undefined) u.birthday = body.birthday ? new Date(body.birthday) : u.birthday;
    await this.userRepo.save(u);
    return this.toPublicUser(u);
  }

  /** GET /api/member/info */
  async memberInfo(uid: number): Promise<any> {
    const u = await this.requireUser(uid);
    const level = u.member_level ?? 0;
    const levels = await this.levelRepo.find({ where: { enabled: 1 }, order: { level: 'ASC' } });
    const curLevel = levels.find((l) => l.level === level);
    const nextLevel = levels.find((l) => l.level > level);
    const couponsCount = await this.couponRepo.count({
      where: { user_id: uid, status: 'UNUSED' },
    });
    return {
      level,
      levelName: curLevel?.name || LEVEL_NAMES[level] || LEVEL_NAMES[0],
      points: u.points ?? 0,
      balance: Number(u.balance || 0),
      coupons: couponsCount,
      growth: {
        current: u.cumulative_points ?? 0,
        next: nextLevel?.min_cumulative_points ?? u.cumulative_points ?? 0,
        rate: nextLevel
          ? Math.min(1, ((u.cumulative_points ?? 0) - (curLevel?.min_cumulative_points ?? 0)) / Math.max(1, nextLevel.min_cumulative_points - (curLevel?.min_cumulative_points ?? 0)))
          : 1,
      },
      benefits: curLevel?.benefits_json || [],
    };
  }

  /** GET /api/member/points -> { list } */
  async pointLogs(uid: number, limit = 50): Promise<{ list: any[] }> {
    const rows = await this.pointLogRepo.find({
      where: { user_id: uid },
      order: { created_at: 'DESC' },
      take: limit,
    });
    const list = rows.map((r) => ({
      id: r.id,
      desc: (r.remark || r.ref_biz_type || '积分变动') + (r.change_type === 'EARN' ? ' +' + r.points + ' 积分' : r.change_type === 'SPEND' ? ' -' + r.points + ' 积分' : ''),
      change: (r.direction > 0 ? '+' : '-') + r.points,
      time: fmtTime(r.created_at),
      type: r.direction > 0 ? 'in' : 'out',
      bizType: r.ref_biz_type,
    }));
    return { list };
  }

  /** GET /api/user/address/default：一期默认返回门店地址，后续扩展收货地址表 */
  async defaultAddress(): Promise<any> {
    return {
      name: '拼豆手工店·前台',
      phone: '400-888-0000',
      detail: '上海市 · 门店自提点（详见 /api/store/info 门店地址）',
    };
  }

  /** GET /api/notifications -> { list }（由订单消息聚合，一期简化为静态+订单系统消息） */
  async notifications(uid: number): Promise<{ list: any[] }> {
    const msgs = await this.msgRepo.find({
      where: { sender_type: 'STAFF', is_deleted: 0 },
      order: { created_at: 'DESC' },
      take: 20,
    });
    const list: any[] = msgs.map((m) => ({
      id: m.id,
      type: 'progress',
      title: m.message_type === 'SYSTEM' ? '订单系统通知' : '店家回复',
      content: m.content,
      time: fmtTime(m.created_at),
      unread: m.is_read_by_user === 0,
      bizType: m.biz_type,
      orderId: m.order_id,
    }));
    if (!list.length) {
      list.push({
        id: 0,
        type: 'promo',
        title: '欢迎来到拼豆手工店',
        content: '新人可输入兑换码 PD8888 领取 10 元优惠券，快来体验来图定制吧！',
        time: fmtTime(new Date()),
        unread: true,
      });
    }
    return { list };
  }

  /** 积分抵扣：为用户增减积分并写流水 */
  async changePoints(
    uid: number,
    changeType: 'EARN' | 'SPEND' | 'EXPIRE' | 'ADJUST',
    points: number,
    opts: { refBizType?: string; refOrderNo?: string; remark?: string } = {},
  ): Promise<number> {
    const u = await this.requireUser(uid);
    const before = u.points ?? 0;
    const direction = changeType === 'SPEND' || changeType === 'EXPIRE' ? -1 : 1;
    const after = Math.max(0, before + direction * points);
    u.points = after;
    if (direction > 0) u.cumulative_points = (u.cumulative_points ?? 0) + points;
    await this.userRepo.save(u);
    await this.pointLogRepo.save(
      this.pointLogRepo.create({
        user_id: uid,
        change_type: changeType,
        points,
        direction,
        before_points: before,
        after_points: after,
        ref_biz_type: opts.refBizType,
        ref_order_no: opts.refOrderNo,
        remark: opts.remark || changeType,
      }),
    );
    return u.points;
  }
}