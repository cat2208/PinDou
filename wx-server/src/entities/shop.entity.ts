import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pricing_config')
export class PricingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, comment: '所属门店，NULL 表示全局默认' })
  store_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.0015 })
  bean_unit_price: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.014 })
  labor_price_normal: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.020 })
  labor_price_complex: string;

  @Column({ type: 'int', default: 12 })
  color_threshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2.0 })
  iron_glitter_min: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5.0 })
  iron_glitter_max: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.0 })
  accessory_keychain: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.5 })
  accessory_fridge_magnet: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  accessory_frame: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.0 })
  accessory_no_hole_double: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 6.0 })
  shipping_fee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 60.0 })
  free_shipping_threshold: string;

  @Column({ type: 'int', default: 2 })
  cancel_free_hours: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.5 })
  deposit_ratio: string;

  @Column({ type: 'enum', enum: ['ON_ORDER_CONFIRM', 'ON_PRODUCE_START'], default: 'ON_ORDER_CONFIRM' })
  inventory_deduct_strategy: 'ON_ORDER_CONFIRM' | 'ON_PRODUCE_START';

  @Column({ type: 'int', default: 1 })
  points_per_yuan: number;

  @Column({ type: 'int', default: 100 })
  points_to_yuan_rate: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.3 })
  points_deduct_max_ratio: string;

  @Column({ type: 'tinyint', default: 1 })
  birthday_double_points: number;

  @Column({ type: 'int', default: 12 })
  points_expire_months: number;

  @Column({ type: 'int', default: 7 })
  auto_confirm_days: number;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('coupon')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  code: string;

  @Column({ nullable: true })
  user_id: number;

  @Column({ nullable: true })
  package_id: number;

  @Column({ type: 'enum', enum: ['DURATION', 'ACCESSORY', 'MATERIAL', 'DISCOUNT'] })
  coupon_type: 'DURATION' | 'ACCESSORY' | 'MATERIAL' | 'DISCOUNT';

  @Column({ type: 'enum', enum: ['BUY', 'GIFT', 'MEITUAN', 'DOUYIN', 'SYSTEM'] })
  source: 'BUY' | 'GIFT' | 'MEITUAN' | 'DOUYIN' | 'SYSTEM';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  face_value: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discount_rate: string;

  @Column({ length: 64, nullable: true })
  accessory_ref: string;

  @Column({ type: 'enum', enum: ['UNUSED', 'USED', 'EXPIRED', 'REVOKED'], default: 'UNUSED' })
  status: 'UNUSED' | 'USED' | 'EXPIRED' | 'REVOKED';

  @Column({ type: 'int', default: 0 })
  used_count: number;

  @Column({ type: 'int', default: 1 })
  total_count: number;

  @Column({ type: 'datetime', nullable: true })
  expire_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('coupon_redeem_log')
export class CouponRedeemLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  coupon_id: number;

  @Column({ nullable: true })
  order_id: number;

  @Column({ nullable: true })
  store_order_id: number;

  @Column()
  admin_id: number;

  @Column({ type: 'enum', enum: ['USE', 'REVOKE'] })
  action: 'USE' | 'REVOKE';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: string;

  @Column({ length: 255, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;
}