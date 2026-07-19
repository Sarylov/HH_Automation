import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  Prisma,
  VacancyStatus,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import {
  LlmConfigurationError,
  LlmSchemaError,
} from '../../../infrastructure/llm/llm.errors';
import { LLM_PORT, type LlmPort } from '../../../infrastructure/llm/llm.port';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import {
  isVacancyAnalysisEnabled,
  skippedVacancyAnalysis,
} from '../../../infrastructure/config/vacancy-analysis';
import type { VacancyAnalysis } from '../../../infrastructure/llm/llm.types';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ActionPacingPolicy } from '../../hardening/policies/action-pacing.policy';
import { ApplyRateLimitPolicy } from '../../hardening/policies/apply-rate-limit.policy';
import { WorkingHoursPolicy } from '../../hardening/policies/working-hours.policy';
import { ApplyDelayPolicy } from '../policies/apply-delay.policy';
import { ApplicationRepository } from '../repositories/application.repository';
import { ApplyJobRepository } from '../repositories/apply-job.repository';
import { VacancyRepository } from '../repositories/vacancy.repository';
import { AnalyzeVacancyUseCase } from './analyze-vacancy.use-case';
import { GenerateCoverLetterUseCase } from './generate-cover-letter.use-case';

@Injectable()
export class ApplyToVacancyUseCase {
  private readonly logger = new Logger(ApplyToVacancyUseCase.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
    private readonly vacancies: VacancyRepository,
    private readonly applyJobs: ApplyJobRepository,
    private readonly applications: ApplicationRepository,
    private readonly analyzeVacancy: AnalyzeVacancyUseCase,
    private readonly generateCoverLetter: GenerateCoverLetterUseCase,
    private readonly applyDelay: ApplyDelayPolicy,
    private readonly workingHours: WorkingHoursPolicy,
    private readonly rateLimit: ApplyRateLimitPolicy,
    private readonly pacing: ActionPacingPolicy,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    vacancyId: string;
    applyJobId?: string;
    correlationId?: string;
  }) {
    const vacancy = await this.vacancies.findById(input.vacancyId);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${input.vacancyId} not found`);
    }

    const existing = await this.applications.findByVacancyId(vacancy.id);
    if (existing && existing.status !== ApplicationStatus.STUB) {
      this.logger.log({
        msg: 'Apply skipped — already processed',
        vacancyId: vacancy.id,
        status: existing.status,
      });
      return {
        accepted: true,
        implemented: true,
        skipped: true,
        reason: 'already_processed',
        applicationId: existing.id,
        status: existing.status,
      };
    }

    // Dry-run already produced letter/analysis — do not loop forever
    if (existing?.status === ApplicationStatus.STUB && existing.coverLetter) {
      this.logger.log({
        msg: 'Apply skipped — dry-run already completed',
        vacancyId: vacancy.id,
      });
      return {
        accepted: true,
        implemented: true,
        skipped: true,
        reason: 'already_dry_run',
        applicationId: existing.id,
        status: existing.status,
      };
    }

    const hours = this.workingHours.evaluate();
    if (!hours.allowed) {
      this.logger.log({
        msg: 'Apply skipped — outside working hours',
        vacancyId: vacancy.id,
        reason: hours.reason,
      });
      return {
        accepted: true,
        implemented: true,
        skipped: true,
        reason: hours.reason,
        window: hours.window,
        nowLocal: hours.nowLocal,
      };
    }

    const rate = await this.rateLimit.checkApplyAllowed();
    if (!rate.allowed) {
      this.logger.log({
        msg: 'Apply skipped — rate limited',
        vacancyId: vacancy.id,
        reason: rate.reason,
      });
      return {
        accepted: true,
        implemented: true,
        skipped: true,
        reason: rate.reason,
        hourCount: rate.hourCount,
        dayCount: rate.dayCount,
      };
    }

    let applyJobId = input.applyJobId;
    if (!applyJobId) {
      const active = await this.applyJobs.findActiveForVacancy(vacancy.id);
      const job =
        active ??
        (await this.applyJobs.createPending({
          vacancyId: vacancy.id,
          correlationId: input.correlationId,
        }));
      applyJobId = job.id;
    }
    await this.applyJobs.markRunning(applyJobId);
    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.APPLY_WORKER,
        status: WorkflowRunStatus.RUNNING,
        correlationId: input.correlationId,
        startedAt: new Date(),
        metadata: { vacancyId: vacancy.id, externalId: vacancy.externalId },
      },
    });
    const dryRun = isDryRun(this.config);
    try {
      if (!this.llm.isConfigured()) {
        return await this.failControlled({
          applyJobId,
          vacancyId: vacancy.id,
          runId: run.id,
          correlationId: input.correlationId,
          reason: 'llm_not_configured',
          errorMessage: 'LLM is not configured (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL)',
        });
      }
      const opened = await this.playwright.openVacancy(vacancy.externalId);
      if (!opened.ok) {
        return await this.failControlled({
          applyJobId,
          vacancyId: vacancy.id,
          runId: run.id,
          correlationId: input.correlationId,
          reason: opened.reason ?? 'open_vacancy_failed',
          errorMessage: opened.reason ?? 'open_vacancy_failed',
          vacancyStatus: VacancyStatus.FAILED,
        });
      }
      let analysis: VacancyAnalysis;
      if (!isVacancyAnalysisEnabled(this.config)) {
        analysis = skippedVacancyAnalysis();
        this.logger.log({
          msg: 'Vacancy analysis skipped (LLM_VACANCY_ANALYSIS_ENABLED=false)',
          vacancyId: vacancy.id,
        });
      } else {
        try {
          analysis = await this.analyzeVacancy.execute({ vacancy, opened });
        } catch (error) {
          const reason =
            error instanceof LlmSchemaError
              ? 'llm_schema_mismatch'
              : error instanceof LlmConfigurationError
                ? 'llm_not_configured'
                : 'llm_analysis_failed';
          const message = error instanceof Error ? error.message : reason;
          return await this.failControlled({
            applyJobId,
            vacancyId: vacancy.id,
            runId: run.id,
            correlationId: input.correlationId,
            reason,
            errorMessage: message,
          });
        }
        // Analysis is context for the cover letter only — never skip apply on shouldApply
        this.logger.log({
          msg: 'Vacancy analysis used for cover letter (apply gate disabled)',
          vacancyId: vacancy.id,
          matchScore: analysis.matchScore,
          shouldApply: analysis.shouldApply,
        });
      }
      let coverLetter;
      try {
        coverLetter = await this.generateCoverLetter.execute({
          vacancy,
          opened,
          analysis,
        });
      } catch (error) {
        const reason =
          error instanceof LlmSchemaError
            ? 'llm_schema_mismatch'
            : 'llm_cover_letter_failed';
        const message = error instanceof Error ? error.message : reason;
        return await this.failControlled({
          applyJobId,
          vacancyId: vacancy.id,
          runId: run.id,
          correlationId: input.correlationId,
          reason,
          errorMessage: message,
          analysis,
        });
      }
      const pacingMs = await this.pacing.waitTurn('apply');
      const delayMs = await this.applyDelay.wait();
      this.logger.log({
        msg: 'Apply delay elapsed',
        vacancyId: vacancy.id,
        delayMs,
        pacingMs,
      });
      const applyResult = await this.playwright.applyVacancy({
        externalId: vacancy.externalId,
        coverLetter: coverLetter.letter,
        dryRun,
      });
      if (applyResult.needsManual) {
        const application = await this.applications.upsertResult({
          vacancyId: vacancy.id,
          status: ApplicationStatus.NEEDS_MANUAL,
          coverLetter: coverLetter.letter,
          analysis,
          correlationId: input.correlationId,
          errorMessage: applyResult.reason ?? 'manual_steps_required',
        });
        await this.applyJobs.markDone(applyJobId);
        await this.vacancies.markStatus(vacancy.id, VacancyStatus.FAILED);
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: WorkflowRunStatus.SUCCEEDED,
            finishedAt: new Date(),
            metadata: {
              vacancyId: vacancy.id,
              externalId: vacancy.externalId,
              needsManual: true,
              dryRun,
              delayMs,
            },
          },
        });
        return {
          accepted: true,
          implemented: true,
          workflow: 'apply',
          runId: run.id,
          status: 'NEEDS_MANUAL',
          applicationId: application.id,
          reason: applyResult.reason,
        };
      }
      if (!applyResult.ok) {
        return await this.failControlled({
          applyJobId,
          vacancyId: vacancy.id,
          runId: run.id,
          correlationId: input.correlationId,
          reason: applyResult.reason ?? 'apply_failed',
          errorMessage: applyResult.reason ?? 'apply_failed',
          analysis,
          coverLetter: coverLetter.letter,
          vacancyStatus: VacancyStatus.FAILED,
        });
      }
      const applicationStatus = dryRun
        ? ApplicationStatus.STUB
        : ApplicationStatus.APPLIED;
      const application = await this.applications.upsertResult({
        vacancyId: vacancy.id,
        status: applicationStatus,
        coverLetter: coverLetter.letter,
        analysis,
        correlationId: input.correlationId,
        appliedAt: dryRun ? null : new Date(),
      });
      if (!dryRun) {
        await this.rateLimit.recordApply();
      }
      await this.applyJobs.markDone(applyJobId);
      await this.vacancies.markStatus(
        vacancy.id,
        dryRun ? VacancyStatus.QUEUED : VacancyStatus.APPLIED,
      );
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: {
            vacancyId: vacancy.id,
            externalId: vacancy.externalId,
            dryRun,
            delayMs,
            alreadyApplied: applyResult.alreadyApplied ?? false,
            matchScore: analysis.matchScore,
          },
        },
      });
      this.logger.log({
        msg: dryRun ? 'Apply dry-run completed' : 'Apply completed',
        vacancyId: vacancy.id,
        externalId: vacancy.externalId,
      });
      return {
        accepted: true,
        implemented: true,
        workflow: 'apply',
        runId: run.id,
        status: dryRun ? 'DRY_RUN' : 'SUCCEEDED',
        applicationId: application.id,
        dryRun,
        alreadyApplied: applyResult.alreadyApplied,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'apply_failed';
      await this.applyJobs.markFailed(applyJobId, message);
      await this.vacancies.markStatus(vacancy.id, VacancyStatus.FAILED);
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      throw error;
    }
  }

  private async failControlled(input: {
    applyJobId: string;
    vacancyId: string;
    runId: string;
    correlationId?: string;
    reason: string;
    errorMessage: string;
    analysis?: Prisma.InputJsonValue;
    coverLetter?: string;
    vacancyStatus?: VacancyStatus;
  }) {
    const application = await this.applications.upsertResult({
      vacancyId: input.vacancyId,
      status: ApplicationStatus.FAILED,
      coverLetter: input.coverLetter ?? null,
      analysis: input.analysis,
      correlationId: input.correlationId,
      errorMessage: input.errorMessage,
    });
    await this.applyJobs.markFailed(input.applyJobId, input.errorMessage);
    await this.vacancies.markStatus(
      input.vacancyId,
      input.vacancyStatus ?? VacancyStatus.FAILED,
    );
    await this.prisma.workflowRun.update({
      where: { id: input.runId },
      data: {
        status: WorkflowRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: input.errorMessage,
        metadata: { reason: input.reason },
      },
    });
    this.logger.warn({
      msg: 'Apply failed (controlled)',
      vacancyId: input.vacancyId,
      reason: input.reason,
    });
    return {
      accepted: true,
      implemented: true,
      workflow: 'apply',
      runId: input.runId,
      status: 'FAILED',
      applicationId: application.id,
      reason: input.reason,
    };
  }
}
