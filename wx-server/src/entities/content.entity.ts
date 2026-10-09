import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  sku: string;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['FINISHED', 'MATERIAL', 'ACCESSORY'] })
  category: 'FINISHED' | 'MATERIAL' | 'ACCESSORY';

  @Column({ length: 128 })
  title: string;

  @Column({ length: 512, default: '' })
  cover: string;

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ length: 255, default: '' })
  tags: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'int', nullable: true })
  bean_count: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'tinyint', default: 1 })
  enabled: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  store_id: number;

  @Column({ type: 'enum', enum: ['BEAN', 'ACCESSORY', 'PACKAGING', 'OTHER'] })
  item_type: 'BEAN' | 'ACCESSORY' | 'PACKAGING' | 'OTHER';

  @Column({ length: 128 })
  item_name: string;

  @Column({ length: 64 })
  item_code: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ length: 16, default: '个' })
  unit: string;

  @Column({ type: 'int', default: 50 })
  alert_threshold: number;

  @Column({ type: 'datetime', nullable: true })
  last_restock_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('inventory_log')
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  store_id: number;

  @Column()
  inventory_id: number;

  @Column({ type: 'enum', enum: ['IN', 'OUT', 'ADJUST', 'RETURN'] })
  change_type: 'IN' | 'OUT' | 'ADJUST' | 'RETURN';

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'tinyint', comment: '1=增加 -1=减少' })
  direction: number;

  @Column({ type: 'int' })
  before_quantity: number;

  @Column({ type: 'int' })
  after_quantity: number;

  @Column({ length: 32, nullable: true })
  ref_order_no: string;

  @Column()
  operator_id: number;

  @Column({ length: 255, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('gallery')
export class Gallery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'json' })
  images: string[];

  @Column({ length: 1024, default: '' })
  content: string;

  @Column({ type: 'enum', enum: ['USER', 'MEITUAN', 'DOUYIN', 'ADMIN'], default: 'USER' })
  source: 'USER' | 'MEITUAN' | 'DOUYIN' | 'ADMIN';

  @Column({ type: 'enum', enum: ['TEMPLATE', 'PRODUCT', 'NONE'], default: 'NONE' })
  related_type: 'TEMPLATE' | 'PRODUCT' | 'NONE';

  @Column({ nullable: true })
  related_id: number;

  @Column({ type: 'int', default: 0 })
  like_count: number;

  @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @CreateDateColumn()
  created_at: Date;
}

@Entity('review_sync')
export class ReviewSync {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['MEITUAN', 'DOUYIN', 'MANUAL'] })
  platform: 'MEITUAN' | 'DOUYIN' | 'MANUAL';

  @Column({ length: 128, nullable: true })
  platform_id: string;

  @Column({ length: 64, default: '' })
  nickname: string;

  @Column({ length: 512, default: '' })
  avatar: string;

  @Column({ length: 2048, default: '' })
  content: string;

  @Column({ type: 'int', nullable: true })
  rating: number;

  @Column({ type: 'json', nullable: true })
  raw: any;

  @Column({ type: 'tinyint', default: 0 })
  synced: number;

  @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'HIDDEN'], default: 'PENDING' })
  audit_status: 'PENDING' | 'APPROVED' | 'HIDDEN';

  @CreateDateColumn()
  created_at: Date;
}