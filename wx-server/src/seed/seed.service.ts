import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Staff } from '../entities/store.entity';

const DEMO_PASSWORD = 'demo123456';

const DEFAULT_STAFF = [
  { username: 'manager', real_name: '张店长', role: 'MANAGER', store_id: 1 },
  { username: 'staff01', real_name: '李店员', role: 'STAFF', store_id: 1 },
  { username: 'owner', real_name: '王老板', role: 'OWNER', store_id: 1 },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureStaffPasswords();
  }

  /** 确保默认店员账号存在且密码 hash 为 demo123456（仅在开发 / 空密码时覆盖） */
  async ensureStaffPasswords() {
    try {
      const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
      for (const item of DEFAULT_STAFF) {
        const existing = await this.staffRepo.findOne({ where: { username: item.username } });
        if (!existing) {
          await this.staffRepo.save(
            this.staffRepo.create({
              username: item.username,
              password_hash: hash,
              real_name: item.real_name,
              role: item.role as Staff['role'],
              store_id: item.store_id,
            }),
          );
          this.logger.log(`[seed] 创建店员账号 ${item.username}`);
          continue;
        }
        // schema.sql 里 password_hash 是占位符，统一替换为真实 hash
        if (!existing.password_hash || existing.password_hash.startsWith('$2b$10$placeholder')) {
          existing.password_hash = hash;
          await this.staffRepo.save(existing);
          this.logger.log(`[seed] 修正店员账号 ${item.username} 密码为 ${DEMO_PASSWORD}`);
        }
      }
    } catch (e) {
      this.logger.warn(`[seed] staff 密码初始化跳过: ${(e as Error).message}`);
    }
  }
}