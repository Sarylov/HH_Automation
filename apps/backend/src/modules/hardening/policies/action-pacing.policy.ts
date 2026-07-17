import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Ensures a minimum gap between HH side-effect actions (anti-ban pacing).
 */
@Injectable()
export class ActionPacingPolicy {
  private readonly logger = new Logger(ActionPacingPolicy.name);
  private lastActionAt = 0;

  constructor(private readonly config: ConfigService) {}

  async waitTurn(action = 'hh_action'): Promise<number> {
    const minIntervalMs = this.minIntervalMs();
    const now = Date.now();
    const elapsed = now - this.lastActionAt;
    const waitMs =
      this.lastActionAt === 0 || elapsed >= minIntervalMs
        ? 0
        : minIntervalMs - elapsed;

    if (waitMs > 0) {
      this.logger.log({ msg: 'Action pacing wait', action, waitMs });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastActionAt = Date.now();
    return waitMs;
  }

  private minIntervalMs(): number {
    const raw = Number(
      this.config.get<string>('HH_ACTION_MIN_INTERVAL_MS', '8000'),
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : 8_000;
  }
}
