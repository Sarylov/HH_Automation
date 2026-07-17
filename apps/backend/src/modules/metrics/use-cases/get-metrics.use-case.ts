import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  ApplyJobStatus,
  AuthSessionStatus,
  WorkflowRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuthSessionRepository } from '../../auth/repositories/auth-session.repository';
import { ApplyRateLimitPolicy } from '../../hardening/policies/apply-rate-limit.policy';

export type MetricsResult = {
  timestamp: string;
  applies: {
    succeededToday: number;
    failedToday: number;
    needsManualToday: number;
  };
  workflows: {
    failedToday: number;
    succeededToday: number;
  };
  queue: {
    pending: number;
    running: number;
    failed: number;
  };
  session: {
    status: 'up' | 'down' | 'unknown';
    ageHours: number | null;
    checkedAt: string | null;
    stale: boolean;
  };
  rateLimit: {
    hourCount: number;
    dayCount: number;
    hourLimit: number;
    dayLimit: number;
  };
  alerts: string[];
};

@Injectable()
export class GetMetricsUseCase {
  private readonly logger = new Logger(GetMetricsUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessions: AuthSessionRepository,
    private readonly rateLimit: ApplyRateLimitPolicy,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<MetricsResult> {
    const startOfDay = this.startOfLocalDay();
    const [
      succeededToday,
      failedToday,
      needsManualToday,
      wfFailed,
      wfSucceeded,
      pending,
      running,
      failedJobs,
      sessionRow,
      rate,
    ] = await Promise.all([
      this.prisma.application.count({
        where: {
          status: ApplicationStatus.APPLIED,
          appliedAt: { gte: startOfDay },
        },
      }),
      this.prisma.application.count({
        where: {
          status: ApplicationStatus.FAILED,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.application.count({
        where: {
          status: ApplicationStatus.NEEDS_MANUAL,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.workflowRun.count({
        where: {
          status: WorkflowRunStatus.FAILED,
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.workflowRun.count({
        where: {
          status: WorkflowRunStatus.SUCCEEDED,
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.applyJob.count({ where: { status: ApplyJobStatus.PENDING } }),
      this.prisma.applyJob.count({ where: { status: ApplyJobStatus.RUNNING } }),
      this.prisma.applyJob.count({ where: { status: ApplyJobStatus.FAILED } }),
      this.authSessions.getLatest(),
      this.rateLimit.checkApplyAllowed(),
    ]);

    const sessionStatus =
      sessionRow?.status === AuthSessionStatus.UP
        ? 'up'
        : sessionRow?.status === AuthSessionStatus.DOWN
          ? 'down'
          : 'unknown';

    const checkedAt = sessionRow?.checkedAt ?? null;
    const ageHours = checkedAt
      ? (Date.now() - checkedAt.getTime()) / (60 * 60 * 1000)
      : null;
    const maxAge = Number(
      this.config.get<string>('SESSION_MAX_AGE_HOURS', '72'),
    );
    const stale =
      ageHours !== null && Number.isFinite(maxAge) && ageHours > maxAge;

    const alerts: string[] = [];
    if (sessionStatus === 'down') alerts.push('session_down');
    if (stale) alerts.push('session_stale');
    if (pending + running > this.intEnv('QUEUE_STUCK_THRESHOLD', 25)) {
      alerts.push('queue_backlog');
    }
    if (running > 0) {
      const stuck = await this.prisma.applyJob.count({
        where: {
          status: ApplyJobStatus.RUNNING,
          startedAt: {
            lte: new Date(Date.now() - 30 * 60 * 1000),
          },
        },
      });
      if (stuck > 0) alerts.push('queue_stuck_running');
    }
    if (failedToday >= this.intEnv('APPLY_FAIL_ALERT_THRESHOLD', 5)) {
      alerts.push('apply_failures_spike');
    }
    if (!rate.allowed) alerts.push(rate.reason ?? 'rate_limited');

    const result: MetricsResult = {
      timestamp: new Date().toISOString(),
      applies: { succeededToday, failedToday, needsManualToday },
      workflows: { failedToday: wfFailed, succeededToday: wfSucceeded },
      queue: { pending, running, failed: failedJobs },
      session: {
        status: sessionStatus,
        ageHours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
        checkedAt: checkedAt?.toISOString() ?? null,
        stale,
      },
      rateLimit: {
        hourCount: rate.hourCount ?? 0,
        dayCount: rate.dayCount ?? 0,
        hourLimit: rate.hourLimit ?? 0,
        dayLimit: rate.dayLimit ?? 0,
      },
      alerts,
    };

    this.logger.log({ msg: 'Metrics snapshot', alerts: result.alerts });
    return result;
  }

  private startOfLocalDay(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private intEnv(name: string, fallback: number): number {
    const raw = Number(this.config.get<string>(name, String(fallback)));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  }
}
