import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('store')
export class Store {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 512, default: '' })
  address: string;

  @Column({ length: 20, default: '' })
  contact_phone: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string;

  @Column({ length: 128, default: '' })
  business_hours: string;

  @Column({ type: 'enum', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  username: string;

  @Column({ length: 255 })
  password_hash: string;

  @Column({ length: 64, default: '' })
  real_name: string;

  @Column({ type: 'enum', enum: ['STAFF', 'MANAGER', 'OWNER'], default: 'STAFF' })
  role: 'STAFF' | 'MANAGER' | 'OWNER';

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'tinyint', default: 1 })
  enabled: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('seat')
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ length: 16 })
  seat_no: string;

  @Column({ length: 32, default: '' })
  area: string;

  @Column({ type: 'enum', enum: ['IDLE', 'RESERVED', 'TIMING', 'PENDING_SETTLE'], default: 'IDLE' })
  status: 'IDLE' | 'RESERVED' | 'TIMING' | 'PENDING_SETTLE';

  @Column({ length: 64, unique: true })
  qrcode_token: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('package')
export class Package {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, comment: '所属门店，NULL 表示全局通用' })
  store_id: number;

  @Column({ length: 64 })
  name: string;

  @Column({ type: 'enum', enum: ['HOURLY', 'THREE_HOUR', 'ALL_DAY'] })
  type: 'HOURLY' | 'THREE_HOUR' | 'ALL_DAY';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int', nullable: true })
  duration_minutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hourly_unit_price: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.0 })
  deposit: string;

  @Column({ length: 255, default: '' })
  description: string;

  @Column({ type: 'tinyint', default: 1 })
  enabled: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('staff_shift')
export class StaffShift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  store_id: number;

  @Column()
  shift_staff_id: number;

  @Column({ nullable: true })
  receive_staff_id: number;

  @Column({ type: 'datetime' })
  shift_start: Date;

  @Column({ type: 'datetime', nullable: true })
  shift_end: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  cash_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  wx_amount: string;

  @Column({ type: 'int', default: 0 })
  un_settle_count: number;

  @Column({ length: 1024, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}