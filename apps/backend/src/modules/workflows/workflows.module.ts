import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { TriggerWorkflowUseCase } from './use-cases/trigger-workflow.use-case';
import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { VacanciesModule } from '../vacancies/vacancies.module';
import { ResumesModule } from '../resumes/resumes.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [VacanciesModule, ResumesModule, MessagingModule],
  controllers: [WorkflowsController],
  providers: [TriggerWorkflowUseCase, WorkflowRunRepository],
})
export class WorkflowsModule {}
