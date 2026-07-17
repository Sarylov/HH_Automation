import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import {
  ApplicationStatus,
  FollowUpStatus,
  Prisma,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FollowUpStateRepository } from '../repositories/follow-up-state.repository';

const REMINDER_TEMPLATES = [
  'Здравствуйте! Уточняю по своему отклику — остался ли интерес к моей кандидатуре? Готов ответить на вопросы.',
  'Здравствуйте! Напоминаю о своём отклике. Буду рад продолжить диалог, если вакансия ещё актуальна.',
  'Здравствуйте! Последнее короткое напоминание по отклику. Если позиция закрыта — тоже буду благодарен за ответ.',
];

@Injectable()
export class ProcessFollowUpsUseCase {
  private readonly logger = new Logger(ProcessFollowUpsUseCase.name);

  constructor(
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
    private readonly followUps: FollowUpStateRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input?: { correlationId?: string }) {
    const correlationId = input?.correlationId;
    const dryRun = isDryRun(this.config);
    const maxReminders = this.maxReminders();

    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.FOLLOW_UP_WORKER,
        status: WorkflowRunStatus.RUNNING,
        correlationId,
        startedAt: new Date(),
        metadata: { dryRun, maxReminders },
      },
    });

    this.logger.log({
      msg: 'Follow-up worker started',
      runId: run.id,
      correlationId,
      dryRun,
    });

    try {
      await this.seedFromApplications(correlationId);

      const due = await this.followUps.findDue();
      const results: Array<Record<string, unknown>> = [];

      for (const state of due) {
        if (state.reminderCount >= Math.min(state.maxReminders, maxReminders)) {
          await this.followUps.recordReminder({
            id: state.id,
            reminderCount: state.reminderCount,
            nextReminderAt: null,
            status: FollowUpStatus.COMPLETED,
          });
          results.push({
            followUpId: state.id,
            status: 'SKIPPED',
            reason: 'max_reminders_reached',
            reminderCount: state.reminderCount,
          });
          continue;
        }

        // Hard stop: never send a 4th reminder
        if (state.reminderCount >= 3) {
          await this.followUps.stop(state.id, FollowUpStatus.COMPLETED);
          results.push({
            followUpId: state.id,
            status: 'SKIPPED',
            reason: 'hard_cap_3',
          });
          continue;
        }

        let externalId: string | null = null;
        if (state.threadId) {
          const thread = await this.prisma.chatThread.findUnique({
            where: { id: state.threadId },
          });
          externalId = thread?.externalId ?? null;
        }

        if (!externalId) {
          await this.followUps.stop(state.id, FollowUpStatus.STOPPED);
          results.push({
            followUpId: state.id,
            status: 'SKIPPED',
            reason: 'no_thread_external_id',
          });
          continue;
        }

        // Re-check employer reply before sending
        const read = await this.playwright.readChat(externalId);
        if (read.ok) {
          const hasEmployerAfter =
            read.messages.some((m) => m.role === 'employer') &&
            state.lastReminderAt != null;
          const latestEmployer = [...read.messages]
            .reverse()
            .find((m) => m.role === 'employer');
          const latestApplicant = [...read.messages]
            .reverse()
            .find((m) => m.role === 'applicant');

          // If latest message is from employer after our last reminder/reply — stop
          if (
            latestEmployer &&
            (!latestApplicant ||
              read.messages.indexOf(latestEmployer) >
                read.messages.indexOf(latestApplicant))
          ) {
            // Only stop if this isn't the initial state before any reminder
            if (state.reminderCount > 0 || hasEmployerAfter) {
              await this.followUps.stop(state.id, FollowUpStatus.COMPLETED);
              results.push({
                followUpId: state.id,
                externalId,
                status: 'SKIPPED',
                reason: 'employer_replied',
              });
              continue;
            }
          }
        }

        const nextCount = state.reminderCount + 1;
        if (nextCount > 3) {
          await this.followUps.stop(state.id, FollowUpStatus.COMPLETED);
          results.push({
            followUpId: state.id,
            status: 'SKIPPED',
            reason: 'would_exceed_3',
          });
          continue;
        }

        const text =
          REMINDER_TEMPLATES[Math.min(nextCount - 1, REMINDER_TEMPLATES.length - 1)];

        const sent = await this.playwright.sendChatMessage({
          externalId,
          text,
          dryRun,
        });

        if (!sent.ok) {
          results.push({
            followUpId: state.id,
            externalId,
            status: 'FAILED',
            reason: sent.reason,
          });
          continue;
        }

        const completed = nextCount >= 3;
        const delayDays = this.followUpDelayDays();
        await this.followUps.recordReminder({
          id: state.id,
          reminderCount: nextCount,
          nextReminderAt: completed
            ? null
            : new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000),
          status: completed ? FollowUpStatus.COMPLETED : FollowUpStatus.ACTIVE,
        });

        results.push({
          followUpId: state.id,
          externalId,
          status: dryRun ? 'DRY_RUN' : 'SENT',
          reminderCount: nextCount,
          dryRun,
        });
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: { dryRun, maxReminders, results } as Prisma.InputJsonValue,
        },
      });

      this.logger.log({
        msg: 'Follow-up worker completed',
        runId: run.id,
        count: results.length,
      });

      return {
        accepted: true,
        implemented: true,
        workflow: 'follow-up',
        runId: run.id,
        status: 'SUCCEEDED',
        dryRun,
        results,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'follow_up_failed';
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      throw error;
    }
  }

  /**
   * Ensure APPLIED applications without follow-up get tracked
   * (thread may be linked later by chat processor).
   */
  private async seedFromApplications(correlationId?: string): Promise<void> {
    const applied = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.APPLIED,
        followUp: null,
        appliedAt: {
          lte: new Date(
            Date.now() - this.followUpDelayDays() * 24 * 60 * 60 * 1000,
          ),
        },
      },
      take: 30,
      orderBy: { appliedAt: 'asc' },
    });

    for (const app of applied) {
      await this.followUps.upsertForApplication({
        applicationId: app.id,
        nextReminderAt: new Date(),
        correlationId,
      });
    }
  }

  private maxReminders(): number {
    const raw = Number(this.config.get<string>('FOLLOW_UP_MAX_REMINDERS', '3'));
    const value = Number.isFinite(raw) && raw > 0 ? raw : 3;
    return Math.min(value, 3);
  }

  private followUpDelayDays(): number {
    const raw = Number(this.config.get<string>('FOLLOW_UP_DELAY_DAYS', '3'));
    return Number.isFinite(raw) && raw > 0 ? raw : 3;
  }
}
