import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApplyDelayPolicy {
  constructor(private readonly config: ConfigService) {}

  async wait(): Promise<number> {
    const minMs = Number(this.config.get<string>('APPLY_DELAY_MIN_MS', '3000'));
    const maxMs = Number(this.config.get<string>('APPLY_DELAY_MAX_MS', '15000'));
    const boundedMin = Math.max(0, Number.isFinite(minMs) ? minMs : 3_000);
    const boundedMax = Math.max(
      boundedMin,
      Number.isFinite(maxMs) ? maxMs : 15_000,
    );
    const span = boundedMax - boundedMin;
    const delayMs = boundedMin + Math.floor(Math.random() * (span + 1));

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return delayMs;
  }
}
