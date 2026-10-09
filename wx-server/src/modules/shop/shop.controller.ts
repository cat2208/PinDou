import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ShopService } from './shop.service';
import { CurrentUser, JwtUser, Public } from '../../common/auth.guard';

@Controller()
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /** GET /api/products?category= 商品列表（免登录） */
  @Public()
  @Get('products')
  products(@Query('category') category?: string) {
    return this.shopService.products(category);
  }

  /** GET /api/products/:id 商品详情（免登录） */
  @Public()
  @Get('products/:id')
  productDetail(@Param('id') id: string) {
    return this.shopService.productDetail(Number(id));
  }

  /** POST /api/orders 商城下单（登录） */
  @Post('orders')
  createOrder(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.shopService.createOrder(user.uid, body);
  }
}