import { Injectable } from '@nestjs/common';
import {
  ChatClassification,
  ChatThreadStatus,
  Prisma,
  type ChatThread,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ChatThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByExternalId(input: {
    externalId: string;
    employerName?: string | null;
    vacancyTitle?: string | null;
    url?: string | null;
    lastMessageAt?: Date | null;
    status?: ChatThreadStatus;
    classification?: ChatClassification | null;
    notifyReason?: string | null;
    lastProcessedAt?: Date | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<ChatThread> {
    return this.prisma.chatThread.upsert({
      where: { externalId: input.externalId },
      create: {
        externalId: input.externalId,
        employerName: input.employerName ?? null,
        vacancyTitle: input.vacancyTitle ?? null,
        url: input.url ?? null,
        lastMessageAt: input.lastMessageAt ?? null,
        status: input.status ?? ChatThreadStatus.OPEN,
        classification: input.classification ?? null,
        notifyReason: input.notifyReason ?? null,
        lastProcessedAt: input.lastProcessedAt ?? null,
        metadata: input.metadata,
      },
      update: {
        employerName: input.employerName ?? undefined,
        vacancyTitle: input.vacancyTitle ?? undefined,
        url: input.url ?? undefined,
        lastMessageAt: input.lastMessageAt ?? undefined,
        status: input.status ?? undefined,
        classification: input.classification ?? undefined,
        notifyReason: input.notifyReason ?? undefined,
        lastProcessedAt: input.lastProcessedAt ?? undefined,
        metadata: input.metadata,
      },
    });
  }

  async findByExternalId(externalId: string): Promise<ChatThread | null> {
    return this.prisma.chatThread.findUnique({ where: { externalId } });
  }

  async markProcessed(input: {
    id: string;
    status: ChatThreadStatus;
    classification: ChatClassification;
    notifyReason?: string | null;
  }): Promise<ChatThread> {
    return this.prisma.chatThread.update({
      where: { id: input.id },
      data: {
        status: input.status,
        classification: input.classification,
        notifyReason: input.notifyReason ?? null,
        lastProcessedAt: new Date(),
      },
    });
  }
}
