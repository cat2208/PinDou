import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { Store, Staff, Seat, Package, StaffShift } from '../../entities/store.entity';
import { StoreOrder, StoreOrderItem, StoreOrderEscapeRecord } from '../../entities/order.entity';
import { PaymentRecord, OrderMessage } from '../../entities/system.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { Product } from '../../entities/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      Staff,
      Seat,
      Package,
      StaffShift,
      StoreOrder,
      StoreOrderItem,
      StoreOrderEscapeRecord,
      PaymentRecord,
      OrderMessage,
      PricingConfig,
      Product,
    ]),
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}