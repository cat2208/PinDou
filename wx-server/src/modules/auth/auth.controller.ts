import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingConfig } from '../../entities/shop.entity';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(PricingConfig) private readonly pricingRepo: Repository<PricingConfig>,
  ) {}

  /** 小程序登录：POST /api/user/login { code } -> { token, userInfo } */
  @Public()
  @Post('user/login')
  wxLogin(@Body() body: { code?: string }) {
    return this.auth.wxLogin(body?.code || '');
  }

  /** 店员端登录：POST /api/staff/login { username, password } */
  @Public()
  @Post('staff/login')
  staffLogin(@Body() body: { username: string; password: string }) {
    return this.auth.staffLogin(body?.username || '', body?.password || '');
  }

  /** 全局运营配置：GET /api/config/public（定价参数、会员规则等，前端 app.js 启动时拉取） */
  @Public()
  @Get('config/public')
  async publicConfig() {
    const rows = await this.pricingRepo.find({
      where: { store_id: null },
      order: { id: 'ASC' },
    });
    const p = rows[0] || (await this.pricingRepo.find())[0] || null;
    return {
      pricing: p
        ? {
            beanUnitPrice: Number(p.bean_unit_price),
            laborPriceNormal: Number(p.labor_price_normal),
            laborPriceComplex: Number(p.labor_price_complex),
            colorThreshold: p.color_threshold,
            ironGlitterMin: Number(p.iron_glitter_min),
            ironGlitterMax: Number(p.iron_glitter_max),
            shippingFee: Number(p.shipping_fee),
            freeShippingThreshold: Number(p.free_shipping_threshold),
            shippingByCategory: p.shipping_by_category && typeof p.shipping_by_category === 'object'
              ? p.shipping_by_category
              : {},
            depositRatio: Number(p.deposit_ratio),
            pointsPerYuan: p.points_per_yuan,
            pointsToYuanRate: p.points_to_yuan_rate,
            pointsDeductMaxRatio: Number(p.points_deduct_max_ratio),
            birthdayDoublePoints: p.birthday_double_points === 1,
            pointsExpireMonths: p.points_expire_months,
            autoConfirmDays: p.auto_confirm_days,
          }
        : null,
      // 会员等级名（供前端展示）
      memberLevels: [
        { level: 0, name: '普通会员' },
        { level: 1, name: '银卡会员' },
        { level: 2, name: '金卡会员' },
        { level: 3, name: '钻石会员' },
      ],
    };
  }
}