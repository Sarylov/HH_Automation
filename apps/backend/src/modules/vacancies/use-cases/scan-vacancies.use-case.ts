import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VacancyStatus,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { ApplyQueueService } from '../../../infrastructure/queue/apply-queue.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkingHoursPolicy } from '../../hardening/policies/working-hours.policy';
import { VacancyRepository } from '../repositories/vacancy.repository';
import { ApplyJobRepository } from '../repositories/apply-job.repository';

@Injectable()
export class ScanVacanciesUseCase {
  private readonly logger = new Logger(ScanVacanciesUseCase.name);

  constructor(
    private readonly playwright: PlaywrightClient,
    private readonly vacancies: VacancyRepository,
    private readonly applyJobs: ApplyJobRepository,
    private readonly applyQueue: ApplyQueueService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly workingHours: WorkingHoursPolicy,
  ) {}

  async execute(input?: {
    text?: string;
    area?: string;
    pages?: number;
    correlationId?: string;
    enqueue?: boolean;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod?: number;
    searchField?: 'name' | 'company_name' | 'description';
  }) {
    const text =
      input?.text?.trim() ||
      this.config.get<string>('HH_SEARCH_TEXT', 'frontend developer');
    // No default region: omit area unless explicitly passed in the request
    const area = input?.area?.trim() || undefined;
    const pages = input?.pages ?? Number(this.config.get('HH_SEARCH_PAGES', '1'));
    const excludedText =
      input?.excludedText?.trim() ||
      this.config.get<string>('HH_EXCLUDED_TEXT', '').trim() ||
      undefined;
    const workFormat =
      input?.workFormat ??
      (this.config.get<string>('HH_WORK_FORMAT', '').toUpperCase() === 'REMOTE'
        ? 'REMOTE'
        : undefined);
    const searchPeriod =
      input?.searchPeriod ??
      Number(this.config.get<string>('HH_SEARCH_PERIOD', '3'));
    const searchField =
      input?.searchField ??
      (this.config.get<string>('HH_SEARCH_FIELD', 'name') as
        | 'name'
        | 'company_name'
        | 'description');
    const enqueue = input?.enqueue !== false;
    const correlationId = input?.correlationId;
    const dryRun = isDryRun(this.config);

    const hours = this.workingHours.evaluate();
    if (!hours.allowed) {
      this.logger.log({
        msg: 'Vacancy scan skipped — outside working hours',
        reason: hours.reason,
        nowLocal: hours.nowLocal,
      });
      const run = await this.prisma.workflowRun.create({
        data: {
          workflow: WorkflowName.VACANCY_SCANNER,
          status: WorkflowRunStatus.SKIPPED,
          correlationId,
          startedAt: new Date(),
          finishedAt: new Date(),
          metadata: {
            skipped: true,
            reason: hours.reason,
            window: hours.window,
            nowLocal: hours.nowLocal,
          },
        },
      });
      return {
        accepted: true,
        implemented: true,
        workflow: 'vacancy-scanner',
        runId: run.id,
        status: 'SKIPPED',
        reason: hours.reason,
        created: 0,
        updated: 0,
        enqueued: 0,
      };
    }

    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.VACANCY_SCANNER,
        status: WorkflowRunStatus.RUNNING,
        correlationId,
        startedAt: new Date(),
        metadata: { dryRun },
      },
    });

    try {
      const search = await this.playwright.searchVacancies({
        text,
        area,
        pages,
        excludedText,
        workFormat,
        searchPeriod,
        searchField,
      });
      if (!search.ok) {
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: WorkflowRunStatus.FAILED,
            finishedAt: new Date(),
            errorMessage: search.reason ?? 'search_failed',
          },
        });
        return {
          accepted: true,
          implemented: true,
          workflow: 'vacancy-scanner',
          runId: run.id,
          status: 'FAILED',
          reason: search.reason,
          created: 0,
          updated: 0,
          enqueued: 0,
        };
      }

      let created = 0;
      let updated = 0;
      let enqueued = 0;

      for (const item of search.items) {
        const result = await this.vacancies.upsertByExternalId({
          externalId: item.externalId,
          title: item.title,
          url: item.url,
          company: item.company,
          salary: item.salary,
          snippet: item.snippet,
          raw: item,
        });

        if (result.created) created += 1;
        else updated += 1;

        if (!enqueue) continue;
        if (
          result.vacancy.status === VacancyStatus.APPLIED ||
          result.vacancy.status === VacancyStatus.SKIPPED
        ) {
          continue;
        }

        const active = await this.applyJobs.findActiveForVacancy(result.vacancy.id);
        if (active) continue;

        const existingApp = await this.prisma.application.findUnique({
          where: { vacancyId: result.vacancy.id },
        });
        if (existingApp) continue;

        const job = await this.applyJobs.createPending({
          vacancyId: result.vacancy.id,
          correlationId,
        });
        await this.vacancies.markQueued(result.vacancy.id);
        await this.applyQueue.enqueue({
          applyJobId: job.id,
          vacancyId: result.vacancy.id,
          externalId: result.vacancy.externalId,
          correlationId,
        });
        enqueued += 1;
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: {
            text,
            area,
            pages,
            excludedText,
            workFormat,
            searchPeriod,
            searchField,
            dryRun,
            found: search.items.length,
            created,
            updated,
            enqueued,
          },
        },
      });

      this.logger.log({
        msg: 'Vacancy scan completed',
        found: search.items.length,
        created,
        updated,
        enqueued,
        dryRun,
      });

      return {
        accepted: true,
        implemented: true,
        workflow: 'vacancy-scanner',
        runId: run.id,
        status: 'SUCCEEDED',
        found: search.items.length,
        created,
        updated,
        enqueued,
        dryRun,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'scan_failed';
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
}
