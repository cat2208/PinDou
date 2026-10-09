import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  openid: string;

  @Column({ length: 64, nullable: true })
  unionid: string;

  @Column({ length: 64, default: '' })
  nickname: string;

  @Column({ length: 20, default: '' })
  phone: string;

  @Column({ length: 512, default: '' })
  avatar: string;

  @Column({ type: 'tinyint', default: 0, comment: '会员等级 0-3' })
  member_level: number;

  @Column({ type: 'int', default: 0, comment: '当前可用积分' })
  points: number;

  @Column({ type: 'int', default: 0, comment: '累计积分（只增不减）' })
  cumulative_points: number;

  @Column({ type: 'datetime', nullable: true })
  level_updated_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  balance: string;

  @Column({ type: 'date', nullable: true })
  birthday: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  deleted_at: Date;
}

@Entity('member_level_config')
export class MemberLevelConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'tinyint', unique: true })
  level: number;

  @Column({ length: 32 })
  name: string;

  @Column({ type: 'int' })
  min_cumulative_points: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  discount_rate: string;

  @Column({ type: 'json', nullable: true })
  benefits_json: string[];

  @Column({ type: 'tinyint', default: 1 })
  enabled: number;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('point_log')
@Index('idx_user', ['user_id'])
@Index('idx_expire', ['expire_at'])
@Index('idx_change_type', ['change_type'])
export class PointLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  store_id: number;

  @Column({ type: 'enum', enum: ['EARN', 'SPEND', 'EXPIRE', 'ADJUST'] })
  change_type: 'EARN' | 'SPEND' | 'EXPIRE' | 'ADJUST';

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'tinyint', comment: '1=增加 -1=减少' })
  direction: number;

  @Column({ type: 'int' })
  before_points: number;

  @Column({ type: 'int' })
  after_points: number;

  @Column({ length: 32, nullable: true })
  ref_biz_type: string;

  @Column({ length: 32, nullable: true })
  ref_order_no: string;

  @Column({ type: 'datetime', nullable: true })
  expire_at: Date;

  @Column({ length: 255, default: '' })
  remark: string;

  @Column({ nullable: true })
  operator_id: number;

  @CreateDateColumn()
  created_at: Date;
}