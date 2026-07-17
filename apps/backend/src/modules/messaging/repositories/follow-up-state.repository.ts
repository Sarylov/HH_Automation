import { Injectable } from '@nestjs/common';
import { FollowUpStatus, type FollowUpState } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class FollowUpStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDue(now: Date = new Date()): Promise<FollowUpState[]> {
    return this.prisma.followUpState.findMany({
      where: {
        status: FollowUpStatus.ACTIVE,
        OR: [{ nextReminderAt: null }, { nextReminderAt: { lte: now } }],
      },
      orderBy: { nextReminderAt: 'asc' },
      take: 50,
    });
  }

  async upsertForThread(input: {
    threadId: string;
    lastEmployerAt?: Date | null;
    nextReminderAt?: Date | null;
    correlationId?: string;
  }): Promise<FollowUpState> {
    const existing = await this.prisma.followUpState.findFirst({
      where: { threadId: input.threadId },
    });

    if (existing) {
      return this.prisma.followUpState.update({
        where: { id: existing.id },
        data: {
          lastEmployerAt: input.lastEmployerAt ?? undefined,
          nextReminderAt: input.nextReminderAt ?? undefined,
          correlationId: input.correlationId,
          status: FollowUpStatus.ACTIVE,
        },
      });
    }

    return this.prisma.followUpState.create({
      data: {
        threadId: input.threadId,
        lastEmployerAt: input.lastEmployerAt ?? null,
        nextReminderAt: input.nextReminderAt ?? null,
        correlationId: input.correlationId,
        reminderCount: 0,
        maxReminders: 3,
        status: FollowUpStatus.ACTIVE,
      },
    });
  }

  async upsertForApplication(input: {
    applicationId: string;
    threadId?: string | null;
    nextReminderAt?: Date | null;
    correlationId?: string;
  }): Promise<FollowUpState> {
    return this.prisma.followUpState.upsert({
      where: { applicationId: input.applicationId },
      create: {
        applicationId: input.applicationId,
        threadId: input.threadId ?? null,
        nextReminderAt: input.nextReminderAt ?? null,
        correlationId: input.correlationId,
        reminderCount: 0,
        maxReminders: 3,
        status: FollowUpStatus.ACTIVE,
      },
      update: {
        threadId: input.threadId ?? undefined,
        nextReminderAt: input.nextReminderAt ?? undefined,
        correlationId: input.correlationId,
        status: FollowUpStatus.ACTIVE,
      },
    });
  }

  async recordReminder(input: {
    id: string;
    reminderCount: number;
    nextReminderAt: Date | null;
    status: FollowUpStatus;
  }): Promise<FollowUpState> {
    return this.prisma.followUpState.update({
      where: { id: input.id },
      data: {
        reminderCount: input.reminderCount,
        lastReminderAt: new Date(),
        nextReminderAt: input.nextReminderAt,
        status: input.status,
      },
    });
  }

  async stop(id: string, status: FollowUpStatus = FollowUpStatus.STOPPED) {
    return this.prisma.followUpState.update({
      where: { id },
      data: { status, nextReminderAt: null },
    });
  }
}
