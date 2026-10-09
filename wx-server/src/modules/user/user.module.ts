import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, MemberLevelConfig, PointLog } from '../../entities/user.entity';
import { OrderMessage } from '../../entities/system.entity';
import { Coupon } from '../../entities/shop.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      MemberLevelConfig,
      PointLog,
      OrderMessage,
      Coupon,
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}