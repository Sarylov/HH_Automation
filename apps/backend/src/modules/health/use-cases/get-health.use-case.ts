import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSessionStatus, ApplyJobStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { AuthSessionRepository } from '../../auth/repositories/auth-session.repository';
import { WorkingHoursPolicy } from '../../hardening/policies/working-hours.policy';

export type HealthResult = {
  status: 'ok' | 'degraded';
  checks: {
    api: 'up';
    database: 'up' | 'down';
    playwright: 'up' | 'down';
    session: 'up' | 'down' | 'unknown';
    queue: 'up' | 'degraded';
    workingHours: 'open' | 'closed';
  };
  sessionAgeHours: number | null;
  dryRun: boolean;
  timestamp: string;
};

@Injectable()
export class GetHealthUseCase {
  private readonly logger = new Logger(GetHealthUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly playwright: PlaywrightClient,
    private readonly authSessions: AuthSessionRepository,
    private readonly workingHours: WorkingHoursPolicy,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<HealthResult> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    const playwright = await this.playwright.health();
    const sessionRow = await this.authSessions.getLatest();
    const session =
      sessionRow?.status === AuthSessionStatus.UP
        ? 'up'
        : sessionRow?.status === AuthSessionStatus.DOWN
          ? 'down'
          : 'unknown';

    const stuckRunning = await this.prisma.applyJob.count({
      where: {
        status: ApplyJobStatus.RUNNING,
        startedAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
      },
    });
    const pending = await this.prisma.applyJob.count({
      where: { status: ApplyJobStatus.PENDING },
    });
    const queueThreshold = Number(
      this.config.get<string>('QUEUE_STUCK_THRESHOLD', '25'),
    );
    const queue: 'up' | 'degraded' =
      stuckRunning > 0 || pending > queueThreshold ? 'degraded' : 'up';

    const hours = this.workingHours.evaluate();
    const workingHours = hours.allowed ? 'open' : 'closed';

    const checkedAt = sessionRow?.checkedAt ?? null;
    const sessionAgeHours = checkedAt
      ? Math.round(((Date.now() - checkedAt.getTime()) / (60 * 60 * 1000)) * 10) /
        10
      : null;
    const maxAge = Number(
      this.config.get<string>('SESSION_MAX_AGE_HOURS', '72'),
    );
    const sessionStale =
      sessionAgeHours !== null &&
      Number.isFinite(maxAge) &&
      sessionAgeHours > maxAge;

    const dryRunRaw = this.config.get<string>('DRY_RUN', 'false');
    const dryRun =
      dryRunRaw === '1' || dryRunRaw.toLowerCase() === 'true';

    const degraded =
      database === 'down' ||
      playwright === 'down' ||
      session === 'down' ||
      queue === 'degraded' ||
      sessionStale;

    const result: HealthResult = {
      status: degraded ? 'degraded' : 'ok',
      checks: {
        api: 'up',
        database,
        playwright,
        session,
        queue,
        workingHours,
      },
      sessionAgeHours,
      dryRun,
      timestamp: new Date().toISOString(),
    };

    this.logger.log({ msg: 'Health check', ...result });
    return result;
  }
}
