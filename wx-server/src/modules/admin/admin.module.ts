import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { CustomOrder, CustomOrderQc } from '../../entities/order.entity';
import { StoreOrder, StoreOrderItem } from '../../entities/order.entity';
import { OrderMessage, AuditLog, PaymentRecord } from '../../entities/system.entity';
import { Staff } from '../../entities/store.entity';
import { Store } from '../../entities/store.entity';
import { Seat, Package } from '../../entities/store.entity';
import { User, MemberLevelConfig, PointLog } from '../../entities/user.entity';
import { Coupon, CouponRedeemLog, PricingConfig } from '../../entities/shop.entity';
import { Product, Inventory, InventoryLog } from '../../entities/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomOrder,
      CustomOrderQc,
      StoreOrder,
      StoreOrderItem,
      OrderMessage,
      AuditLog,
      PaymentRecord,
      Staff,
      Store,
      Seat,
      Package,
      User,
      MemberLevelConfig,
      PointLog,
      Coupon,
      CouponRedeemLog,
      PricingConfig,
      Product,
      Inventory,
      InventoryLog,
    ]),
  ],
  controllers: [AdminController, OpsController],
  providers: [AdminService, OpsService],
  exports: [AdminService],
})
export class AdminModule {}