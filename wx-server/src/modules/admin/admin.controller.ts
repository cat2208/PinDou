import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CurrentUser, JwtUser, Roles } from '../../common/auth.guard';

@Controller('admin')
@Roles('STAFF', 'MANAGER', 'OWNER')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /api/admin/orders 定制订单列表（店员端） */
  @Get('orders')
  orders(@Query('status') status?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.adminService.orders(status, Number(page) || 1, Number(pageSize) || 20);
  }

  /** GET /api/admin/orders/:id 订单详情（店员端） */
  @Get('orders/:id')
  orderDetail(@Param('id') id: string) {
    return this.adminService.orderDetail(Number(id));
  }

  /** POST /api/admin/orders/:id/status 状态流转（店员端） */
  @Post('orders/:id/status')
  advanceOrder(@CurrentUser() staff: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.adminService.advanceOrder(Number(id), staff, body);
  }

  /** GET /api/admin/stats 经营统计（店员端） */
  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  /** GET /api/admin/staff 店员列表（店员端） */
  @Get('staff')
  staffList() {
    return this.adminService.staffList();
  }
}