import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { Product, Inventory } from '../../entities/content.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { AccessoryOrder, PaymentRecord } from '../../entities/system.entity';
import { User } from '../../entities/user.entity';
import { Store } from '../../entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Inventory,
      PricingConfig,
      AccessoryOrder,
      PaymentRecord,
      User,
      Store,
    ]),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}