import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TriggerWorkflowUseCase,
  type WorkflowKey,
} from './use-cases/trigger-workflow.use-case';

class TriggerWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  pages?: number;

  @IsOptional()
  @IsBoolean()
  enqueue?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  excludedText?: string;

  @IsOptional()
  @IsIn(['REMOTE'])
  workFormat?: 'REMOTE';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  searchPeriod?: number;

  @IsOptional()
  @IsIn(['name', 'company_name', 'description'])
  searchField?: 'name' | 'company_name' | 'description';

  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsOptional()
  @IsUUID()
  applyJobId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

const ALLOWED: ReadonlySet<WorkflowKey> = new Set([
  'resume-maintainer',
  'resume-optimizer',
  'vacancy-scanner',
  'apply',
  'apply-next',
  'chat-processor',
  'follow-up',
]);

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly triggerWorkflow: TriggerWorkflowUseCase) {}

  @Post(':name')
  async trigger(
    @Param('name') name: string,
    @Body() body: TriggerWorkflowDto,
  ) {
    if (!ALLOWED.has(name as WorkflowKey)) {
      return { accepted: false, reason: 'unknown_workflow', name };
    }
    return this.triggerWorkflow.execute(name as WorkflowKey, body);
  }
}
