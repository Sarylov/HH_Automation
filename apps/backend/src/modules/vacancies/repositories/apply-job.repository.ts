import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplyJobStatus, type ApplyJob } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ApplyJobRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findById(id: string): Promise<ApplyJob | null> {
    return this.prisma.applyJob.findUnique({ where: { id } });
  }

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

  /**
   * Atomically claim the oldest PENDING job (PENDING → RUNNING).
   * Returns null if the queue is empty or the row was raced away.
   */
  async claimOldestPending(): Promise<ApplyJob | null> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.applyJob.findFirst({
        where: { status: ApplyJobStatus.PENDING },
        orderBy: { createdAt: 'asc' },
      });
      if (!candidate) return null;

      const updated = await tx.applyJob.updateMany({
        where: {
          id: candidate.id,
          status: ApplyJobStatus.PENDING,
        },
        data: {
          status: ApplyJobStatus.RUNNING,
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (updated.count === 0) return null;

      return tx.applyJob.findUnique({ where: { id: candidate.id } });
    });
  }

  /**
   * Oldest RUNNING job whose startedAt is older than APPLY_JOB_STUCK_MINUTES.
   * Used to resume after n8n/HTTP timeouts without claiming a new vacancy.
   */
  async findStuckRunning(): Promise<ApplyJob | null> {
    const minutes = this.stuckMinutes();
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.applyJob.findFirst({
      where: {
        status: ApplyJobStatus.RUNNING,
        startedAt: { lte: cutoff },
      },
      orderBy: { startedAt: 'asc' },
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

  /** Mark RUNNING without bumping attempts (already claimed). */
  async touchRunning(id: string): Promise<ApplyJob> {
    return this.prisma.applyJob.update({
      where: { id },
      data: {
        status: ApplyJobStatus.RUNNING,
        startedAt: new Date(),
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

  private stuckMinutes(): number {
    const raw = Number(
      this.config.get<string>('APPLY_JOB_STUCK_MINUTES', '30'),
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  }
}
