import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type RateLimitDecision = {
  allowed: boolean;
  reason?: string;
  hourCount?: number;
  dayCount?: number;
  hourLimit?: number;
  dayLimit?: number;
};

/**
 * Apply action rate limits (per hour / per day) backed by Redis when available.
 */
@Injectable()
export class ApplyRateLimitPolicy implements OnModuleDestroy {
  private readonly logger = new Logger(ApplyRateLimitPolicy.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
    try {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      void this.redis.connect().catch((error: unknown) => {
        this.logger.warn({
          msg: 'Redis rate-limit connect failed — using memory fallback',
          error: String(error),
        });
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async checkApplyAllowed(): Promise<RateLimitDecision> {
    const hourLimit = this.intEnv('APPLY_MAX_PER_HOUR', 10);
    const dayLimit = this.intEnv('APPLY_MAX_PER_DAY', 40);

    const hourCount = await this.getCount('apply:hour');
    const dayCount = await this.getCount('apply:day');

    if (hourCount >= hourLimit) {
      return {
        allowed: false,
        reason: 'apply_hour_limit',
        hourCount,
        dayCount,
        hourLimit,
        dayLimit,
      };
    }
    if (dayCount >= dayLimit) {
      return {
        allowed: false,
        reason: 'apply_day_limit',
        hourCount,
        dayCount,
        hourLimit,
        dayLimit,
      };
    }

    return {
      allowed: true,
      hourCount,
      dayCount,
      hourLimit,
      dayLimit,
    };
  }

  async recordApply(): Promise<void> {
    await this.incr('apply:hour', 60 * 60);
    await this.incr('apply:day', 24 * 60 * 60);
  }

  private intEnv(name: string, fallback: number): number {
    const raw = Number(this.config.get<string>(name, String(fallback)));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  }

  private async getCount(key: string): Promise<number> {
    if (this.redis?.status === 'ready') {
      try {
        const value = await this.redis.get(this.ns(key));
        return value ? Number(value) || 0 : 0;
      } catch {
        // fall through
      }
    }
    this.purgeExpired();
    return this.memory.get(key)?.count ?? 0;
  }

  private async incr(key: string, ttlSeconds: number): Promise<void> {
    if (this.redis?.status === 'ready') {
      try {
        const full = this.ns(key);
        const count = await this.redis.incr(full);
        if (count === 1) {
          await this.redis.expire(full, ttlSeconds);
        }
        return;
      } catch {
        // fall through
      }
    }
    const now = Date.now();
    const existing = this.memory.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.memory.set(key, {
        count: 1,
        expiresAt: now + ttlSeconds * 1000,
      });
      return;
    }
    existing.count += 1;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.memory) {
      if (value.expiresAt <= now) this.memory.delete(key);
    }
  }

  private ns(key: string): string {
    return `hh:ratelimit:${key}`;
  }
}
