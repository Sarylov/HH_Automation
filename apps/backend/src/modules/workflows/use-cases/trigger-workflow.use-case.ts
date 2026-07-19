import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WorkflowName } from '@prisma/client';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { ScanVacanciesUseCase } from '../../vacancies/use-cases/scan-vacancies.use-case';
import { ApplyToVacancyUseCase } from '../../vacancies/use-cases/apply-to-vacancy.use-case';
import { ApplyNextUseCase } from '../../vacancies/use-cases/apply-next.use-case';
import { MaintainResumesUseCase } from '../../resumes/use-cases/maintain-resumes.use-case';
import { OptimizeResumesUseCase } from '../../resumes/use-cases/optimize-resumes.use-case';
import { ProcessChatsUseCase } from '../../messaging/use-cases/process-chats.use-case';
import { ProcessFollowUpsUseCase } from '../../messaging/use-cases/process-follow-ups.use-case';

export type WorkflowKey =
  | 'resume-maintainer'
  | 'resume-optimizer'
  | 'vacancy-scanner'
  | 'apply'
  | 'apply-next'
  | 'chat-processor'
  | 'follow-up';

export type TriggerWorkflowInput = {
  correlationId?: string;
  text?: string;
  area?: string;
  pages?: number;
  enqueue?: boolean;
  excludedText?: string;
  workFormat?: 'REMOTE';
  searchPeriod?: number;
  searchField?: 'name' | 'company_name' | 'description';
  vacancyId?: string;
  applyJobId?: string;
  limit?: number;
};

const WORKFLOW_MAP: Record<WorkflowKey, WorkflowName> = {
  'resume-maintainer': WorkflowName.RESUME_MAINTAINER,
  'resume-optimizer': WorkflowName.RESUME_OPTIMIZER,
  'vacancy-scanner': WorkflowName.VACANCY_SCANNER,
  apply: WorkflowName.APPLY_WORKER,
  'apply-next': WorkflowName.APPLY_WORKER,
  'chat-processor': WorkflowName.CHAT_PROCESSOR,
  'follow-up': WorkflowName.FOLLOW_UP_WORKER,
};

@Injectable()
export class TriggerWorkflowUseCase {
  private readonly logger = new Logger(TriggerWorkflowUseCase.name);

  constructor(
    private readonly workflowRuns: WorkflowRunRepository,
    private readonly scanVacancies: ScanVacanciesUseCase,
    private readonly applyToVacancy: ApplyToVacancyUseCase,
    private readonly applyNext: ApplyNextUseCase,
    private readonly maintainResumes: MaintainResumesUseCase,
    private readonly optimizeResumes: OptimizeResumesUseCase,
    private readonly processChats: ProcessChatsUseCase,
    private readonly processFollowUps: ProcessFollowUpsUseCase,
  ) {}

  async execute(key: WorkflowKey, input: TriggerWorkflowInput = {}) {
    if (key === 'vacancy-scanner') {
      return this.scanVacancies.execute({
        text: input.text,
        area: input.area,
        pages: input.pages,
        enqueue: input.enqueue,
        excludedText: input.excludedText,
        workFormat: input.workFormat,
        searchPeriod: input.searchPeriod,
        searchField: input.searchField,
        correlationId: input.correlationId,
      });
    }

    if (key === 'apply') {
      if (!input.vacancyId) {
        throw new BadRequestException('vacancyId is required for apply workflow');
      }
      return this.applyToVacancy.execute({
        vacancyId: input.vacancyId,
        correlationId: input.correlationId,
      });
    }

    if (key === 'apply-next') {
      return this.applyNext.execute({
        applyJobId: input.applyJobId,
        correlationId: input.correlationId,
      });
    }

    if (key === 'resume-maintainer') {
      return this.maintainResumes.execute({
        correlationId: input.correlationId,
      });
    }

    if (key === 'resume-optimizer') {
      return this.optimizeResumes.execute({
        correlationId: input.correlationId,
      });
    }

    if (key === 'chat-processor') {
      return this.processChats.execute({
        correlationId: input.correlationId,
        limit: input.limit,
      });
    }

    if (key === 'follow-up') {
      return this.processFollowUps.execute({
        correlationId: input.correlationId,
      });
    }

    const workflow = WORKFLOW_MAP[key];
    this.logger.log({
      msg: 'Workflow trigger accepted (stub)',
      key,
      correlationId: input.correlationId,
    });

    const run = await this.workflowRuns.createSkipped({
      workflow,
      correlationId: input.correlationId,
      metadata: { note: 'Not implemented yet' },
    });

    return {
      accepted: true,
      implemented: false,
      workflow: key,
      runId: run.id,
      status: run.status,
    };
  }
}
