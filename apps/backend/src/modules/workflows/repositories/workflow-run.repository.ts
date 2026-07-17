import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkflowRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSkipped(input: {
    workflow: WorkflowName;
    correlationId?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<{ id: string; status: WorkflowRunStatus }> {
    const now = new Date();
    return this.prisma.workflowRun.create({
      data: {
        workflow: input.workflow,
        status: WorkflowRunStatus.SKIPPED,
        correlationId: input.correlationId,
        startedAt: now,
        finishedAt: now,
        metadata: input.metadata,
      },
      select: { id: true, status: true },
    });
  }
}
