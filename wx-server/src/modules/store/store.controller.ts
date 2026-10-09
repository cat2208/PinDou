import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StoreService } from './store.service';
import { CurrentUser, JwtUser, Public, Roles } from '../../common/auth.guard';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /** GET /api/store/info 门店信息（免登录） */
  @Public()
  @Get('info')
  info() {
    return this.storeService.info();
  }

  /** GET /api/store/packages 套餐列表（免登录） */
  @Public()
  @Get('packages')
  packages() {
    return this.storeService.packages();
  }

  /** GET /api/store/seats 座位列表（免登录） */
  @Public()
  @Get('seats')
  seats(@Query('available') available?: string) {
    return this.storeService.seats(available);
  }

  /** POST /api/store/sessions 顾客扫码/输座位号开台（登录） */
  @Post('sessions')
  startSession(@CurrentUser() user: JwtUser, @Body() body: { seatNo?: string; seatToken?: string; packageId?: number }) {
    return this.storeService.startSession(user.uid, body);
  }

  /** POST /api/store/sessions/assist 老板/店员帮顾客开台（店员端，可选绑定会员） */
  @Roles('STAFF', 'MANAGER', 'OWNER')
  @Post('sessions/assist')
  assistStart(@CurrentUser() user: JwtUser, @Body() body: { seatNo?: string; seatToken?: string; packageId?: number; userId?: number }) {
    return this.storeService.assistStart(user, body);
  }

  /** GET /api/store/sessions/:orderId 本桌实时状态与账单（登录） */
  @Get('sessions/:orderId')
  sessionDetail(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.storeService.sessionDetail(user.uid, orderId);
  }

  /** POST /api/store/sessions/:orderId/accessories 本桌加购配件（登录） */
  @Post('sessions/:orderId/accessories')
  addAccessories(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string, @Body() body: { items?: Array<{ productId: number | string; qty?: number }> }) {
    return this.storeService.addAccessories(user.uid, orderId, body);
  }

  /** POST /api/store/sessions/:orderId/end 结束计时 → 待收款账单（登录） */
  @Post('sessions/:orderId/end')
  endSession(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.storeService.endSession(user.uid, orderId);
  }
}