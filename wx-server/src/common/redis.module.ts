import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export class RedisService {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (ttlSec && ttlSec > 0) {
      await this.client.set(key, value, 'EX', ttlSec);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /** 分布式锁：获得返回 true，未获得返回 false */
  async lock(key: string, ttlMs = 5000): Promise<boolean> {
    const res = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
    return res === 'OK';
  }

  async unlock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async hget(hash: string, field: string): Promise<string | null> {
    return this.client.hget(hash, field);
  }

  async hset(hash: string, field: string, value: string | number): Promise<void> {
    await this.client.hset(hash, field, String(value));
  }

  async hincrby(hash: string, field: string, by: number): Promise<number> {
    return this.client.hincrby(hash, field, by);
  }

  async hgetall(hash: string): Promise<Record<string, string>> {
    return this.client.hgetall(hash);
  }

  async hdel(hash: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(hash, ...fields);
  }

  /** 获取一个 Redis 分布式锁；拿不到锁时抛业务异常 */
  async withLock<T>(key: string, fn: () => Promise<T>, ttlMs = 5000): Promise<T> {
    const ok = await this.lock(key, ttlMs);
    if (!ok) {
      throw new Error(`操作正在进行中，请稍后再试 (${key})`);
    }
    try {
      return await fn();
    } finally {
      await this.unlock(key);
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const client = new Redis({
          host: cfg.get<string>('REDIS_HOST', '127.0.0.1'),
          port: parseInt(cfg.get<string>('REDIS_PORT', '6379'), 10),
          db: parseInt(cfg.get<string>('REDIS_DB', '0'), 10),
          lazyConnect: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000)),
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}

export { Redis };