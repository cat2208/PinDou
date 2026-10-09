import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Staff, Store } from '../../entities/store.entity';
import { JwtUser } from '../../common/auth.guard';

export interface LoginResult {
  token: string;
  userInfo?: any;
  staffInfo?: any;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  /** 微信小程序登录：mock 模式直接使用固定 openid，生产模式待接入 code2session */
  async wxLogin(code: string): Promise<LoginResult> {
    const mock = this.cfg.get<string>('WX_MOCK_LOGIN', 'true') === 'true';
    let openid: string;
    if (mock) {
      openid = 'mock-openid-' + (code ? this.hashCode(code) % 1000 : 1);
      openid = openid.padEnd(15, '0'); // mock-openid-000 ~ mock-openid-999
      if (openid === 'mock-openid-000') openid = 'mock-openid-001';
    } else {
      // 生产：调用微信 jscode2session（需配置 WX_APPID / WX_SECRET）
      openid = await this.exchangeCode(code);
    }

    let user = await this.userRepo.findOne({ where: { openid } });
    if (!user) {
      user = this.userRepo.create({
        openid,
        nickname: '拼豆新朋友',
        member_level: 0,
        points: 0,
        cumulative_points: 0,
        balance: '0',
      });
      user = await this.userRepo.save(user);
      this.logger.log(`[auth] 新用户注册 openid=${openid} id=${user.id}`);
    }

    const payload: JwtUser = { uid: user.id, type: 'USER' };
    const token = this.jwt.sign(payload);
    return { token, userInfo: this.toPublicUser(user) };
  }

  /** 店员端登录：username + password（供后续管理端/收银端使用） */
  async staffLogin(username: string, password: string): Promise<LoginResult> {
    const staff = await this.staffRepo.findOne({ where: { username } });
    if (!staff || !staff.enabled) throw new Error('账号不存在或已停用');
    const ok = bcrypt.compareSync(password, staff.password_hash || '');
    if (!ok) throw new Error('用户名或密码错误');
    const payload: JwtUser = {
      uid: staff.id,
      type: 'STAFF',
      role: staff.role as JwtUser['role'],
      storeId: staff.store_id ?? undefined,
      nickname: staff.real_name,
    };
    const token = this.jwt.sign(payload);
    return {
      token,
      staffInfo: {
        id: staff.id,
        username: staff.username,
        realName: staff.real_name,
        role: staff.role,
        storeId: staff.store_id,
      },
    };
  }

  private async exchangeCode(code: string): Promise<string> {
    throw new Error('未配置微信 AppID/Secret，请设置 WX_MOCK_LOGIN=false 并部署真实 code2session 服务');
  }

  /** 出参脱敏的用户信息（前端字段） */
  toPublicUser(u: User): any {
    return {
      id: u.id,
      openid: u.openid,
      nickname: u.nickname,
      phone: u.phone,
      avatar: u.avatar || '',
      memberLevel: u.member_level,
      memberLevelName: u.member_level === 0 ? '普通会员' : u.member_level === 1 ? '银卡会员' : u.member_level === 2 ? '金卡会员' : '钻石会员',
      points: u.points,
      cumulativePoints: u.cumulative_points,
      balance: Number(u.balance || 0),
      birthday: u.birthday,
      createdAt: u.created_at,
    };
  }

  private hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
}