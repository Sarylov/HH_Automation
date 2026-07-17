import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ResumeActionStatus,
  ResumeActionType,
  type ResumeAction,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ResumeActionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    resumeId?: string | null;
    type: ResumeActionType;
    status: ResumeActionStatus;
    reason?: string | null;
    changelog?: Prisma.InputJsonValue;
    snapshot?: Prisma.InputJsonValue;
    correlationId?: string;
    workflowRunId?: string;
  }): Promise<ResumeAction> {
    return this.prisma.resumeAction.create({
      data: {
        resumeId: input.resumeId ?? null,
        type: input.type,
        status: input.status,
        reason: input.reason ?? null,
        changelog: input.changelog,
        snapshot: input.snapshot,
        correlationId: input.correlationId,
        workflowRunId: input.workflowRunId,
      },
    });
  }

  async findRecentRaise(
    resumeId: string,
    since: Date,
  ): Promise<ResumeAction | null> {
    return this.prisma.resumeAction.findFirst({
      where: {
        resumeId,
        type: ResumeActionType.RAISE,
        status: ResumeActionStatus.SUCCEEDED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecentOptimize(
    resumeId: string,
    since: Date,
  ): Promise<ResumeAction | null> {
    return this.prisma.resumeAction.findFirst({
      where: {
        resumeId,
        type: ResumeActionType.OPTIMIZE,
        status: ResumeActionStatus.SUCCEEDED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
