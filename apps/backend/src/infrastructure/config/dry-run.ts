import type { ConfigService } from '@nestjs/config';

export function isDryRun(config: ConfigService): boolean {
  const raw = config.get<string>('DRY_RUN', 'false');
  return raw === '1' || raw.toLowerCase() === 'true';
}
