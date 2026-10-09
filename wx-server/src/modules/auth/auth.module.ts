import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../../entities/user.entity';
import { Staff, Store } from '../../entities/store.entity';
import { PricingConfig } from '../../entities/shop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Staff, Store, PricingConfig])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}