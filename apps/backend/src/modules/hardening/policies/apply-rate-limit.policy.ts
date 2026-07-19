import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RateLimitDecision = {
  allowed: boolean;
  reason?: string;
  hourCount?: number;
  dayCount?: number;
  hourLimit?: number;
  dayLimit?: number;
};

/**
 * Apply action rate limits (per hour / per day) in process memory.
 * Single backend instance only — counters reset on restart.
 */
@Injectable()
export class ApplyRateLimitPolicy {
  private readonly logger = new Logger(ApplyRateLimitPolicy.name);
  private readonly memory = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(private readonly config: ConfigService) {}

  async checkApplyAllowed(): Promise<RateLimitDecision> {
    const hourLimit = this.intEnv('APPLY_MAX_PER_HOUR', 10);
    const dayLimit = this.intEnv('APPLY_MAX_PER_DAY', 40);

    const hourCount = this.getCount('apply:hour');
    const dayCount = this.getCount('apply:day');

    if (hourCount >= hourLimit) {
      this.logger.log({
        msg: 'Apply rate limited',
        reason: 'apply_hour_limit',
        hourCount,
        hourLimit,
      });
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
      this.logger.log({
        msg: 'Apply rate limited',
        reason: 'apply_day_limit',
        dayCount,
        dayLimit,
      });
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
    this.incr('apply:hour', 60 * 60);
    this.incr('apply:day', 24 * 60 * 60);
  }

  private intEnv(name: string, fallback: number): number {
    const raw = Number(this.config.get<string>(name, String(fallback)));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  }

  private getCount(key: string): number {
    this.purgeExpired();
    return this.memory.get(key)?.count ?? 0;
  }

  private incr(key: string, ttlSeconds: number): void {
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
}
