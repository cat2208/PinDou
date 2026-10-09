import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OpsService } from './ops.service';
import { Roles, CurrentUser, JwtUser } from '../../common/auth.guard';

/** PC 运营管理后台：OWNER / MANAGER 角色可访问 */
@Controller('admin/ops')
@Roles('OWNER', 'MANAGER')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  /** GET /api/admin/ops/overview 仪表盘概览 + 近 7 日趋势 */
  @Get('overview')
  overview() {
    return this.ops.overview();
  }

  /** GET /api/admin/ops/products 商品列表 */
  @Get('products')
  products(
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ops.products(category, keyword, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  /** POST /api/admin/ops/products 新建商品 */
  @Post('products')
  createProduct(@Body() body: any) {
    return this.ops.createProduct(body);
  }

  /** PUT /api/admin/ops/products/:id 更新商品（含上下架） */
  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.ops.updateProduct(Number(id), body);
  }

  /** GET /api/admin/ops/inventory 库存列表（低库存优先） */
  @Get('inventory')
  inventory(@Query('keyword') keyword?: string) {
    return this.ops.inventory(keyword);
  }

  /** POST /api/admin/ops/inventory/:id/restock 入库/出库调整 */
  @Post('inventory/:id/restock')
  restock(@Param('id') id: string, @CurrentUser() staff: JwtUser, @Body() body: any) {
    return this.ops.restock(Number(id), staff, body);
  }

  /** GET /api/admin/ops/coupons 券列表 */
  @Get('coupons')
  coupons(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ops.coupons(status, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  /** POST /api/admin/ops/coupons 发放券 */
  @Post('coupons')
  createCoupon(@Body() body: any) {
    return this.ops.createCoupon(body);
  }

  /** PUT /api/admin/ops/coupons/:id 编辑券 */
  @Put('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() body: any) {
    return this.ops.updateCoupon(Number(id), body);
  }

  /** GET /api/admin/ops/pricing 运营定价（含拼豆参数） */
  @Get('pricing')
  pricing() {
    return this.ops.pricing();
  }

  /** PUT /api/admin/ops/pricing 更新运营定价 */
  @Put('pricing')
  updatePricing(@CurrentUser() staff: JwtUser, @Body() body: any) {
    return this.ops.updatePricing(body, staff);
  }

  /** GET /api/admin/ops/members 会员列表 */
  @Get('members')
  members(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ops.members(keyword, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  /** GET /api/admin/ops/member-levels 会员等级配置 */
  @Get('member-levels')
  memberLevels() {
    return this.ops.memberLevels();
  }

  /** PUT /api/admin/ops/member-levels/:id 更新等级配置 */
  @Put('member-levels/:id')
  updateMemberLevel(@Param('id') id: string, @Body() body: any) {
    return this.ops.updateMemberLevel(Number(id), body);
  }

  // ---------------------------------------------------------------
  // 收银台（V2：到店拼豆统一结账）
  // ---------------------------------------------------------------
  /** GET /api/admin/ops/cashier/orders 收银台订单列表（PENDING 待收款 / TIMING 计时中 / 不传=全部未结账） */
  @Get('cashier/orders')
  cashierOrders(@Query('status') status?: string) {
    return this.ops.cashierOrders(status);
  }

  /** POST /api/admin/ops/cashier/:orderId/pay 完成收款 { couponId?, discountAmount?, payMethod? } */
  @Post('cashier/:orderId/pay')
  cashierPay(@CurrentUser() staff: JwtUser, @Param('orderId') orderId: string, @Body() body: any) {
    return this.ops.cashierPay(staff, Number(orderId), body);
  }

  /** PUT /api/admin/ops/cashier/:orderId/price 后台修改订单价格 { totalFee } */
  @Put('cashier/:orderId/price')
  cashierUpdatePrice(@CurrentUser() staff: JwtUser, @Param('orderId') orderId: string, @Body() body: any) {
    return this.ops.cashierUpdatePrice(staff, Number(orderId), body);
  }

  /** GET /api/admin/ops/cashier/coupons?keyword= 可用优惠券（收银台选券） */
  @Get('cashier/coupons')
  cashierCoupons(@Query('keyword') keyword?: string) {
    return this.ops.cashierCoupons(keyword);
  }

  /** GET /api/admin/ops/cashier/income 收入统计分项（计时/商品/定制 × 今日/本月/累计/近7日） */
  @Get('cashier/income')
  cashierIncome() {
    return this.ops.cashierIncome();
  }
}