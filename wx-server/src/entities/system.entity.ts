import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_record')
export class PaymentRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  out_trade_no: string;

  @Column({ length: 64, nullable: true })
  transaction_id: string;

  @Column({ type: 'enum', enum: ['CUSTOM_DEPOSIT', 'CUSTOM_BALANCE', 'STORE_SETTLE', 'ACCESSORY', 'MALL', 'COUPON_BUY', 'REFUND'] })
  biz_type: 'CUSTOM_DEPOSIT' | 'CUSTOM_BALANCE' | 'STORE_SETTLE' | 'ACCESSORY' | 'MALL' | 'COUPON_BUY' | 'REFUND';

  @Column()
  biz_id: number;

  @Column({ nullable: true })
  user_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: ['UNPAID', 'PAID', 'REFUND', 'CLOSED'], default: 'UNPAID' })
  status: 'UNPAID' | 'PAID' | 'REFUND' | 'CLOSED';

  @Column({ type: 'datetime', nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['STAFF', 'ADMIN', 'SYSTEM'] })
  operator_type: 'STAFF' | 'ADMIN' | 'SYSTEM';

  @Column()
  operator_id: number;

  @Column({ length: 64, default: '' })
  operator_name: string;

  @Column({ length: 64 })
  action: string;

  @Column({ length: 64, default: '' })
  target_type: string;

  @Column({ nullable: true })
  target_id: number;

  @Column({ type: 'json', nullable: true })
  before_value: any;

  @Column({ type: 'json', nullable: true })
  after_value: any;

  @Column({ length: 45, default: '' })
  ip_address: string;

  @Column({ length: 512, default: '' })
  user_agent: string;

  @Column({ length: 512, default: '' })
  remark: string;

  @Column({ type: 'tinyint', default: 0 })
  is_wx_alert_sent: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('order_message')
@Index(['biz_type', 'order_id'])
export class OrderMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['CUSTOM_ORDER', 'STORE_ORDER'] })
  biz_type: 'CUSTOM_ORDER' | 'STORE_ORDER';

  @Column()
  order_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['USER', 'STAFF'] })
  sender_type: 'USER' | 'STAFF';

  @Column()
  sender_id: number;

  @Column({ length: 64, default: '' })
  sender_name: string;

  @Column({ type: 'enum', enum: ['TEXT', 'IMAGE', 'SYSTEM'], default: 'TEXT' })
  message_type: 'TEXT' | 'IMAGE' | 'SYSTEM';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  images_json: any;

  @Column({ type: 'tinyint', default: 0 })
  is_read_by_user: number;

  @Column({ type: 'tinyint', default: 0 })
  is_read_by_staff: number;

  @Column({ type: 'tinyint', default: 0 })
  is_deleted: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('finance_check_diff')
export class FinanceCheckDiff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'date' })
  check_date: string;

  @Column({ length: 64, nullable: true })
  out_trade_no: string;

  @Column({ length: 64, nullable: true })
  transaction_id: string;

  @Column({ type: 'enum', enum: ['ONLY_WX', 'ONLY_SYS', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH'] })
  diff_type: 'ONLY_WX' | 'ONLY_SYS' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  wx_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  sys_amount: string;

  @Column({ length: 32, nullable: true })
  wx_status: string;

  @Column({ length: 32, nullable: true })
  sys_status: string;

  @Column({ type: 'enum', enum: ['UNHANDLED', 'HANDLED', 'IGNORE'], default: 'UNHANDLED' })
  handle_status: 'UNHANDLED' | 'HANDLED' | 'IGNORE';

  @Column({ length: 512, default: '' })
  handle_remark: string;

  @Column({ nullable: true })
  handle_staff_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('accessory_order')
export class AccessoryOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, unique: true })
  order_no: string;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['MALL', 'STORE_ADD', 'REDEEM'], default: 'MALL' })
  scene: 'MALL' | 'STORE_ADD' | 'REDEEM';

  @Column({ nullable: true })
  related_store_order_id: number;

  @Column({ type: 'json' })
  items_json: any;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_shipping: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points_deduct: string;

  @Column({ type: 'int', default: 0 })
  points_used: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  member_discount: string;

  @Column({ type: 'enum', enum: ['UNPAID', 'PAID', 'REFUND'], default: 'UNPAID' })
  pay_status: 'UNPAID' | 'PAID' | 'REFUND';

  @Column({ type: 'enum', enum: ['CREATED', 'PAID', 'DONE', 'CANCELLED'], default: 'CREATED' })
  status: 'CREATED' | 'PAID' | 'DONE' | 'CANCELLED';

  @CreateDateColumn()
  created_at: Date;
}

@Entity('iot_seat_device')
export class IotSeatDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  store_id: number;

  @Column()
  seat_id: number;

  @Column({ length: 64, unique: true })
  device_sn: string;

  @Column({ length: 64, default: '' })
  device_name: string;

  @Column({ type: 'enum', enum: ['ONLINE', 'OFFLINE', 'FAULT'], default: 'OFFLINE' })
  status: 'ONLINE' | 'OFFLINE' | 'FAULT';

  @Column({ type: 'datetime', nullable: true })
  last_online_at: Date;

  @Column({ type: 'json', nullable: true })
  last_light_command: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}