import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ResumeActionStatus,
  ResumeActionType,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ResumeActionRepository } from '../repositories/resume-action.repository';
import { ResumeRepository } from '../repositories/resume.repository';

@Injectable()
export class MaintainResumesUseCase {
  private readonly logger = new Logger(MaintainResumesUseCase.name);

  constructor(
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
    private readonly resumes: ResumeRepository,
    private readonly actions: ResumeActionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input?: { correlationId?: string }) {
    const correlationId = input?.correlationId;
    const dryRun = isDryRun(this.config);
    const cooldownHours = this.cooldownHours();

    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.RESUME_MAINTAINER,
        status: WorkflowRunStatus.RUNNING,
        correlationId,
        startedAt: new Date(),
        metadata: { dryRun, cooldownHours },
      },
    });

    this.logger.log({
      msg: 'Resume maintainer started',
      runId: run.id,
      correlationId,
      dryRun,
    });

    try {
      const targetIds = this.targetResumeIds();
      const listed = await this.playwright.listResumes();
      if (!listed.ok) {
        return await this.failRun(
          run.id,
          listed.reason ?? 'list_resumes_failed',
        );
      }

      const targets =
        targetIds.length > 0
          ? listed.items.filter((item) => targetIds.includes(item.externalId))
          : listed.items;

      if (targets.length === 0) {
        return await this.failRun(run.id, 'no_target_resumes');
      }

      const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
      const results: Array<Record<string, unknown>> = [];

      for (const item of targets) {
        const resume = await this.resumes.upsertByExternalId({
          externalId: item.externalId,
          title: item.title,
          url: item.url,
        });

        const recent = await this.actions.findRecentRaise(resume.id, since);
        if (recent || (resume.lastRaisedAt && resume.lastRaisedAt >= since)) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.SKIP,
            status: ResumeActionStatus.SKIPPED,
            reason: 'already_raised_within_window',
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId: item.externalId,
            status: 'SKIPPED',
            reason: 'already_raised_within_window',
          });
          continue;
        }

        const raise = await this.playwright.raiseResume({
          externalId: item.externalId,
          dryRun,
        });

        if (!raise.ok) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.RAISE,
            status: ResumeActionStatus.FAILED,
            reason: raise.reason ?? 'raise_failed',
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId: item.externalId,
            status: 'FAILED',
            reason: raise.reason,
          });
          continue;
        }

        if (raise.skipped) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.SKIP,
            status: ResumeActionStatus.SKIPPED,
            reason: raise.reason ?? 'raise_unavailable',
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId: item.externalId,
            status: 'SKIPPED',
            reason: raise.reason,
          });
          continue;
        }

        if (!dryRun && raise.raised) {
          await this.resumes.markRaised(resume.id);
        }

        await this.actions.create({
          resumeId: resume.id,
          type: ResumeActionType.RAISE,
          status: ResumeActionStatus.SUCCEEDED,
          reason: dryRun ? 'dry_run' : 'raised',
          correlationId,
          workflowRunId: run.id,
        });

        results.push({
          externalId: item.externalId,
          status: dryRun ? 'DRY_RUN' : 'SUCCEEDED',
          raised: raise.raised ?? false,
          dryRun,
        });
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: {
            dryRun,
            cooldownHours,
            results,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log({
        msg: 'Resume maintainer completed',
        runId: run.id,
        count: results.length,
      });

      return {
        accepted: true,
        implemented: true,
        workflow: 'resume-maintainer',
        runId: run.id,
        status: 'SUCCEEDED',
        dryRun,
        results,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'resume_maintainer_failed';
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

  private targetResumeIds(): string[] {
    const raw = this.config.get<string>('HH_RESUME_IDS', '');
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  private cooldownHours(): number {
    const raw = Number(
      this.config.get<string>('RESUME_RAISE_COOLDOWN_HOURS', '1'),
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  private async failRun(runId: string, reason: string) {
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: WorkflowRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: reason,
      },
    });
    this.logger.warn({ msg: 'Resume maintainer failed', runId, reason });
    return {
      accepted: true,
      implemented: true,
      workflow: 'resume-maintainer',
      runId,
      status: 'FAILED',
      reason,
    };
  }
}
