import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApplyJobStatus } from '@prisma/client';
import { ApplyRateLimitPolicy } from '../../hardening/policies/apply-rate-limit.policy';
import { WorkingHoursPolicy } from '../../hardening/policies/working-hours.policy';
import { ApplyJobRepository } from '../repositories/apply-job.repository';
import { ApplyToVacancyUseCase } from './apply-to-vacancy.use-case';

@Injectable()
export class ApplyNextUseCase {
  private readonly logger = new Logger(ApplyNextUseCase.name);

  constructor(
    private readonly applyJobs: ApplyJobRepository,
    private readonly applyToVacancy: ApplyToVacancyUseCase,
    private readonly workingHours: WorkingHoursPolicy,
    private readonly rateLimit: ApplyRateLimitPolicy,
  ) {}

  async execute(input?: {
    applyJobId?: string;
    correlationId?: string;
  }) {
    const correlationId = input?.correlationId;

    const hours = this.workingHours.evaluate();
    if (!hours.allowed) {
      this.logger.log({
        msg: 'Apply-next skipped — outside working hours',
        reason: hours.reason,
        correlationId,
      });
      return {
        accepted: true,
        implemented: true,
        workflow: 'apply-next',
        status: 'SKIPPED',
        reason: hours.reason,
        window: hours.window,
        nowLocal: hours.nowLocal,
      };
    }

    const rate = await this.rateLimit.checkApplyAllowed();
    if (!rate.allowed) {
      this.logger.log({
        msg: 'Apply-next skipped — rate limited',
        reason: rate.reason,
        correlationId,
      });
      return {
        accepted: true,
        implemented: true,
        workflow: 'apply-next',
        status: 'SKIPPED',
        reason: rate.reason,
        hourCount: rate.hourCount,
        dayCount: rate.dayCount,
      };
    }

    let job =
      (input?.applyJobId
        ? await this.resolveById(input.applyJobId)
        : null) ??
      (await this.applyJobs.findStuckRunning()) ??
      (await this.applyJobs.claimOldestPending());

    if (!job) {
      this.logger.log({
        msg: 'Apply-next empty queue',
        correlationId,
      });
      return {
        accepted: true,
        implemented: true,
        workflow: 'apply-next',
        status: 'EMPTY',
        reason: 'no_pending_apply_jobs',
      };
    }

    if (
      job.status === ApplyJobStatus.DONE ||
      job.status === ApplyJobStatus.FAILED
    ) {
      return {
        accepted: true,
        implemented: true,
        workflow: 'apply-next',
        status: job.status,
        applyJobId: job.id,
        vacancyId: job.vacancyId,
        reason: 'job_already_finished',
      };
    }

    this.logger.log({
      msg: 'Apply-next claimed job',
      applyJobId: job.id,
      vacancyId: job.vacancyId,
      jobStatus: job.status,
      correlationId,
    });

    const result = await this.applyToVacancy.execute({
      vacancyId: job.vacancyId,
      applyJobId: job.id,
      correlationId,
    });

    return {
      ...result,
      workflow: 'apply-next',
      applyJobId: job.id,
      vacancyId: job.vacancyId,
    };
  }

  private async resolveById(applyJobId: string) {
    const job = await this.applyJobs.findById(applyJobId);
    if (!job) {
      throw new NotFoundException(`ApplyJob ${applyJobId} not found`);
    }
    if (job.status === ApplyJobStatus.PENDING) {
      await this.applyJobs.markRunning(job.id);
      return this.applyJobs.findById(job.id);
    }
    return job;
  }
}
