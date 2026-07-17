import { Injectable } from '@nestjs/common';
import { ChatMessageRole, type ChatMessage } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMessage(input: {
    threadId: string;
    externalId?: string | null;
    role: ChatMessageRole;
    body: string;
    sentAt?: Date | null;
    correlationId?: string;
  }): Promise<ChatMessage> {
    if (input.externalId) {
      return this.prisma.chatMessage.upsert({
        where: {
          threadId_externalId: {
            threadId: input.threadId,
            externalId: input.externalId,
          },
        },
        create: {
          threadId: input.threadId,
          externalId: input.externalId,
          role: input.role,
          body: input.body,
          sentAt: input.sentAt ?? null,
          correlationId: input.correlationId,
        },
        update: {
          role: input.role,
          body: input.body,
          sentAt: input.sentAt ?? undefined,
          correlationId: input.correlationId,
        },
      });
    }

    return this.prisma.chatMessage.create({
      data: {
        threadId: input.threadId,
        role: input.role,
        body: input.body,
        sentAt: input.sentAt ?? null,
        correlationId: input.correlationId,
      },
    });
  }

  async listByThread(threadId: string): Promise<ChatMessage[]> {
    return this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
