import { Injectable } from '@nestjs/common';
import { ApplyJobStatus, type ApplyJob } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ApplyJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveForVacancy(vacancyId: string): Promise<ApplyJob | null> {
    return this.prisma.applyJob.findFirst({
      where: {
        vacancyId,
        status: { in: [ApplyJobStatus.PENDING, ApplyJobStatus.RUNNING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPending(input: {
    vacancyId: string;
    correlationId?: string;
  }): Promise<ApplyJob> {
    return this.prisma.applyJob.create({
      data: {
        vacancyId: input.vacancyId,
        status: ApplyJobStatus.PENDING,
        correlationId: input.correlationId,
      },
    });
  }

  async markRunning(id: string): Promise<ApplyJob> {
    return this.prisma.applyJob.update({
      where: { id },
      data: {
        status: ApplyJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markDone(id: string): Promise<ApplyJob> {
    return this.prisma.applyJob.update({
      where: { id },
      data: { status: ApplyJobStatus.DONE, finishedAt: new Date() },
    });
  }

  async markFailed(id: string, lastError: string): Promise<ApplyJob> {
    return this.prisma.applyJob.update({
      where: { id },
      data: {
        status: ApplyJobStatus.FAILED,
        lastError,
        finishedAt: new Date(),
      },
    });
  }
}
