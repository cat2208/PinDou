import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('custom_order')
@Index('idx_assigned', ['assigned_staff_id'])
@Index('idx_user', ['user_id'])
export class CustomOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, unique: true })
  order_no: string;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ length: 512 })
  image_url: string;

  @Column({ length: 512, nullable: true })
  pattern_url: string;

  @Column({ type: 'int' })
  width: number;

  @Column({ type: 'int' })
  height: number;

  @Column({ type: 'int' })
  total_beans: number;

  @Column({ type: 'int' })
  color_count: number;

  @Column({ type: 'json', nullable: true })
  colors_json: any;

  @Column({ type: 'enum', enum: ['CARTOON', 'REALISTIC'], default: 'CARTOON' })
  style: 'CARTOON' | 'REALISTIC';

  @Column({ type: 'enum', enum: ['EASY', 'NORMAL', 'HARD'], default: 'NORMAL' })
  difficulty: 'EASY' | 'NORMAL' | 'HARD';

  @Column({ type: 'enum', enum: ['NORMAL', 'GLITTER', 'OTHER'], default: 'NORMAL' })
  iron_type: 'NORMAL' | 'GLITTER' | 'OTHER';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_bean: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_labor: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_iron: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_accessory: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_shipping: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_price: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deposit: string;

  @Column({ type: 'tinyint', default: 0 })
  deposit_paid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points_deduct: string;

  @Column({ type: 'int', default: 0 })
  points_used: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  member_discount: string;

  @Column({ type: 'json', nullable: true })
  accessories_json: any;

  @Column({ length: 64, default: '' })
  nickname: string;

  @Column({ length: 64, default: '' })
  contact: string;

  @Column({ type: 'datetime', nullable: true })
  expected_time: Date;

  @Column({ length: 512, default: '' })
  address: string;

  @Column({ length: 512, default: '' })
  remark: string;

  @Column({ nullable: true })
  assigned_staff_id: number;

  @Column({ type: 'datetime', nullable: true })
  last_message_at: Date;

  @Column({
    type: 'enum',
    enum: [
      'PENDING', 'ACCEPTED', 'COLORING', 'ASSEMBLING', 'IRONING',
      'QC_PENDING', 'QC_PASSED', 'DONE', 'SHIPPED', 'DELIVERED', 'CONFIRMED', 'CANCELLED',
    ],
    default: 'PENDING',
  })
  status: string;

  @Column({ length: 512, nullable: true })
  reject_reason: string;

  @Column({ type: 'datetime', nullable: true })
  reject_at: Date;

  @Column({ length: 64, nullable: true })
  tracking_company: string;

  @Column({ length: 64, nullable: true })
  tracking_no: string;

  @Column({ type: 'datetime', nullable: true })
  shipped_at: Date;

  @Column({ type: 'datetime', nullable: true })
  delivered_at: Date;

  @Column({ type: 'datetime', nullable: true })
  confirmed_at: Date;

  @Column({ type: 'tinyint', default: 0 })
  auto_confirmed: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('custom_order_qc')
@Index('idx_order', ['custom_order_id'])
@Index('idx_staff', ['qc_staff_id'])
export class CustomOrderQc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  custom_order_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column()
  qc_staff_id: number;

  @Column({ length: 64, default: '' })
  qc_staff_name: string;

  @Column({ type: 'enum', enum: ['PASS', 'FAIL'] })
  result: 'PASS' | 'FAIL';

  @Column({ length: 512, nullable: true })
  fail_reason: string;

  @Column({ type: 'enum', enum: ['COLORING', 'ASSEMBLING', 'IRONING'], nullable: true })
  rework_target: 'COLORING' | 'ASSEMBLING' | 'IRONING';

  @Column({ type: 'json' })
  qc_images: string[];

  @Column({ length: 512, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('store_order')
@Index('idx_user', ['user_id'])
export class StoreOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, unique: true })
  order_no: string;

  @Column()
  user_id: number;

  @Column()
  seat_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column()
  package_id: number;

  @Column({ nullable: true })
  coupon_id: number;

  @Column({ type: 'datetime', nullable: true })
  booking_time: Date;

  @Column({ type: 'datetime', nullable: true })
  book_start_time: Date;

  @Column({ type: 'datetime', nullable: true })
  book_end_time: Date;

  @Column({ type: 'datetime', nullable: true })
  start_time: Date;

  @Column({ type: 'datetime', nullable: true })
  end_time: Date;

  @Column({ type: 'int', default: 0 })
  pause_seconds: number;

  @Column({ type: 'enum', enum: ['HOURLY', 'THREE_HOUR', 'ALL_DAY'] })
  timing_type: 'HOURLY' | 'THREE_HOUR' | 'ALL_DAY';

  @Column({ type: 'datetime', nullable: true })
  coupon_countdown_end: Date;

  @Column({ type: 'int', default: 0 })
  overtime_minutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  timing_fee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  extra_fee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  accessory_fee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  coupon_deduction: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  thirdparty_deduction: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deposit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points_deduct: string;

  @Column({ type: 'int', default: 0 })
  points_used: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  member_discount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_fee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  settled_fee: string;

  @Column({ type: 'tinyint', default: 0 })
  is_escape: number;

  @Column({
    type: 'enum',
    enum: ['RESERVED', 'CHECKED_IN', 'TIMING', 'PAUSED', 'COMPLETED', 'SETTLED', 'CANCELLED'],
    default: 'RESERVED',
  })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  settled_at: Date;

  @Column({ nullable: true })
  settled_by_staff_id: number;

  @Column({ type: 'datetime', nullable: true })
  last_message_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('store_order_item')
export class StoreOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  store_order_id: number;

  @Column({
    type: 'enum',
    enum: ['TIMING', 'IRON', 'ACCESSORY', 'MATERIAL', 'COUPON', 'THIRDPARTY', 'DEPOSIT', 'MEMBER_DISCOUNT', 'POINTS_DEDUCT'],
  })
  item_type: string;

  @Column({ nullable: true })
  ref_id: number;

  @Column({ length: 64 })
  name: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: ['CHARGE', 'DEDUCT'], default: 'CHARGE' })
  direction: 'CHARGE' | 'DEDUCT';

  @CreateDateColumn()
  created_at: Date;
}

@Entity('store_order_escape_record')
export class StoreOrderEscapeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  store_order_id: number;

  @Column()
  store_id: number;

  @Column()
  staff_id: number;

  @Column({ type: 'datetime' })
  escape_time: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  escape_fee: string;

  @Column({ length: 512, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;
}