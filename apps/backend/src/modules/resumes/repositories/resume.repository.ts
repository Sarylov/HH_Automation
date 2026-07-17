import { Injectable } from '@nestjs/common';
import { Prisma, type Resume } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ResumeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(externalId: string): Promise<Resume | null> {
    return this.prisma.resume.findUnique({ where: { externalId } });
  }

  async upsertByExternalId(input: {
    externalId: string;
    title?: string | null;
    url?: string | null;
    fieldsSnapshot?: Prisma.InputJsonValue;
    lastRaisedAt?: Date | null;
    lastOptimizedAt?: Date | null;
  }): Promise<Resume> {
    return this.prisma.resume.upsert({
      where: { externalId: input.externalId },
      create: {
        externalId: input.externalId,
        title: input.title ?? null,
        url: input.url ?? null,
        fieldsSnapshot: input.fieldsSnapshot,
        lastRaisedAt: input.lastRaisedAt ?? null,
        lastOptimizedAt: input.lastOptimizedAt ?? null,
      },
      update: {
        title: input.title ?? undefined,
        url: input.url ?? undefined,
        fieldsSnapshot: input.fieldsSnapshot,
        lastRaisedAt: input.lastRaisedAt ?? undefined,
        lastOptimizedAt: input.lastOptimizedAt ?? undefined,
      },
    });
  }

  async markRaised(id: string, at: Date = new Date()): Promise<Resume> {
    return this.prisma.resume.update({
      where: { id },
      data: { lastRaisedAt: at },
    });
  }

  async markOptimized(
    id: string,
    fieldsSnapshot: Prisma.InputJsonValue,
    at: Date = new Date(),
  ): Promise<Resume> {
    return this.prisma.resume.update({
      where: { id },
      data: {
        lastOptimizedAt: at,
        fieldsSnapshot,
      },
    });
  }
}
