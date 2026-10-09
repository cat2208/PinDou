import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { RedisModule } from './common/redis.module';
import { JwtAuthGuard, RolesGuard } from './common/auth.guard';
import { TransformInterceptor } from './common/transform.interceptor';
import { AllExceptionsFilter } from './common/exception.filter';
import { User, MemberLevelConfig, PointLog } from './entities/user.entity';
import { Store, Staff, Seat, Package, StaffShift } from './entities/store.entity';
import { CustomOrder, CustomOrderQc, StoreOrder, StoreOrderItem, StoreOrderEscapeRecord } from './entities/order.entity';
import { PricingConfig, Coupon, CouponRedeemLog } from './entities/shop.entity';
import { Product, Inventory, InventoryLog, Gallery, ReviewSync } from './entities/content.entity';
import { PaymentRecord, AuditLog, OrderMessage, FinanceCheckDiff, AccessoryOrder, IotSeatDevice } from './entities/system.entity';

// 业务模块
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CustomModule } from './modules/custom/custom.module';
import { StoreModule } from './modules/store/store.module';
import { ShopModule } from './modules/shop/shop.module';
import { ContentModule } from './modules/content/content.module';
import { AdminModule } from './modules/admin/admin.module';
import { PatternModule } from './modules/pattern/pattern.module';

import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('DB_HOST', '127.0.0.1'),
        port: parseInt(cfg.get<string>('DB_PORT', '3306'), 10),
        username: cfg.get<string>('DB_USER', 'wx_app'),
        password: cfg.get<string>('DB_PASSWORD', ''),
        database: cfg.get<string>('DB_NAME', 'wx_shop'),
        charset: 'utf8mb4',
        entities: [
          User, MemberLevelConfig, PointLog,
          Store, Staff, Seat, Package, StaffShift,
          CustomOrder, CustomOrderQc, StoreOrder, StoreOrderItem, StoreOrderEscapeRecord,
          PricingConfig, Coupon, CouponRedeemLog,
          Product, Inventory, InventoryLog, Gallery, ReviewSync,
          PaymentRecord, AuditLog, OrderMessage, FinanceCheckDiff, AccessoryOrder, IotSeatDevice,
        ],
        synchronize: false,
        logging: false,
        timezone: '+08:00',
        extra: { connectionLimit: 20 },
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'pin_gong_wx_dev_secret'),
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
    }),
    RedisModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Staff]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // 站点图片资源（banner 等），URL 形如 /images/home/banner1.png
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public/images'),
      serveRoot: '/images',
    }),
    // PC 运营管理后台（原生单文件，无构建），URL 形如 /admin/index.html
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public/admin'),
      serveRoot: '/admin',
    }),
    AuthModule,
    UserModule,
    CustomModule,
    StoreModule,
    ShopModule,
    ContentModule,
    AdminModule,
    PatternModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    SeedService,
  ],
})
export class AppModule {}