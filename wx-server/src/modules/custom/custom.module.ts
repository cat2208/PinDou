import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomController } from './custom.controller';
import { CustomService } from './custom.service';
import { CustomOrder, CustomOrderQc, StoreOrder, StoreOrderItem } from '../../entities/order.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { AccessoryOrder, OrderMessage, PaymentRecord } from '../../entities/system.entity';
import { User } from '../../entities/user.entity';
import { Staff } from '../../entities/store.entity';
import { PatternModule } from '../pattern/pattern.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomOrder,
      CustomOrderQc,
      StoreOrder,
      StoreOrderItem,
      PricingConfig,
      OrderMessage,
      PaymentRecord,
      AccessoryOrder,
      User,
      Staff,
    ]),
    PatternModule,
  ],
  controllers: [CustomController],
  providers: [CustomService],
  exports: [CustomService],
})
export class CustomModule {}