import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CustomService } from './custom.service';
import { CurrentUser, JwtUser, Public } from '../../common/auth.guard';

@Controller()
export class CustomController {
  constructor(private readonly customService: CustomService) {}

  /** POST /api/custom/quote 定制报价（未登录可预览） */
  @Public()
  @Post('custom/quote')
  quote(@Body() body: { size?: string; qty?: number; patternId?: string; totalBeans?: number; colorCount?: number; sizeCm?: any }) {
    return this.customService.quote(body);
  }

  /** POST /api/custom/orders 创建定制订单 */
  @Post('custom/orders')
  createOrder(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.customService.create(user.uid, body);
  }

  /** GET /api/custom/orders 我的定制订单 */
  @Get('custom/orders')
  myCustomOrders(@CurrentUser() user: JwtUser, @Query('status') status = '') {
    return this.customService.myCustomOrders(user.uid, status);
  }

  /** GET /api/orders 统一订单列表（定制+商城），查询参数 status */
  @Get('orders')
  unifiedOrders(@CurrentUser() user: JwtUser, @Query('status') status = '') {
    return this.customService.unifiedOrders(user.uid, status);
  }

  /** GET /api/orders/:id 订单详情 */
  @Get('orders/:id')
  orderDetail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customService.orderDetail(user.uid, id);
  }

  /** POST /api/orders/:id/confirm 确认收货 */
  @Post('orders/:id/confirm')
  confirmReceived(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customService.confirmReceived(user.uid, id);
  }

  /** POST /api/orders/:id/cancel 取消订单 */
  @Post('orders/:id/cancel')
  cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customService.cancel(user.uid, id);
  }
}