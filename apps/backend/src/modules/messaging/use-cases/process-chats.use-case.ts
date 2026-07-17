import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import {
  ChatClassification,
  ChatMessageRole,
  ChatThreadStatus,
  FollowUpStatus,
  Prisma,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import {
  LlmConfigurationError,
  LlmSchemaError,
} from '../../../infrastructure/llm/llm.errors';
import { LLM_PORT, type LlmPort } from '../../../infrastructure/llm/llm.port';
import {
  CHAT_REPLY_PROMPT_VERSION,
  CHAT_REPLY_SCHEMA_HINT,
  CHAT_REPLY_SYSTEM,
  buildChatReplyUserPrompt,
} from '../../../infrastructure/llm/prompts/chat-reply.v1';
import { parseChatReplyResult } from '../../../infrastructure/llm/schemas/chat-reply.schema';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { ChatThreadRepository } from '../repositories/chat-thread.repository';
import { FollowUpStateRepository } from '../repositories/follow-up-state.repository';
import { ClassifyChatMessageService } from '../services/classify-chat-message.service';

@Injectable()
export class ProcessChatsUseCase {
  private readonly logger = new Logger(ProcessChatsUseCase.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
    private readonly threads: ChatThreadRepository,
    private readonly messages: ChatMessageRepository,
    private readonly followUps: FollowUpStateRepository,
    private readonly classifier: ClassifyChatMessageService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input?: { correlationId?: string; limit?: number }) {
    const correlationId = input?.correlationId;
    const dryRun = isDryRun(this.config);
    const limit = input?.limit ?? this.chatLimit();

    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.CHAT_PROCESSOR,
        status: WorkflowRunStatus.RUNNING,
        correlationId,
        startedAt: new Date(),
        metadata: { dryRun, limit },
      },
    });

    this.logger.log({
      msg: 'Chat processor started',
      runId: run.id,
      correlationId,
      dryRun,
    });

    try {
      const listed = await this.playwright.listChats();
      if (!listed.ok) {
        return await this.failRun(run.id, listed.reason ?? 'list_chats_failed');
      }

      const results: Array<Record<string, unknown>> = [];
      const targets = listed.items.slice(0, limit);

      for (const item of targets) {
        const result = await this.processThread(item.externalId, {
          listMeta: item,
          correlationId,
          dryRun,
          workflowRunId: run.id,
        });
        results.push(result);
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: { dryRun, limit, results } as Prisma.InputJsonValue,
        },
      });

      this.logger.log({
        msg: 'Chat processor completed',
        runId: run.id,
        count: results.length,
      });

      return {
        accepted: true,
        implemented: true,
        workflow: 'chat-processor',
        runId: run.id,
        status: 'SUCCEEDED',
        dryRun,
        results,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'chat_processor_failed';
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

  private async processThread(
    externalId: string,
    ctx: {
      listMeta: {
        employerName?: string;
        vacancyTitle?: string;
        url: string;
      };
      correlationId?: string;
      dryRun: boolean;
      workflowRunId: string;
    },
  ): Promise<Record<string, unknown>> {
    const read = await this.playwright.readChat(externalId);
    if (!read.ok) {
      return {
        externalId,
        status: 'FAILED',
        reason: read.reason ?? 'read_failed',
      };
    }

    const thread = await this.threads.upsertByExternalId({
      externalId,
      employerName: read.employerName ?? ctx.listMeta.employerName,
      vacancyTitle: read.vacancyTitle ?? ctx.listMeta.vacancyTitle,
      url: read.url || ctx.listMeta.url,
      lastMessageAt: new Date(),
      status: ChatThreadStatus.OPEN,
    });

    for (const msg of read.messages) {
      await this.messages.upsertMessage({
        threadId: thread.id,
        externalId: msg.externalId,
        role: this.mapRole(msg.role),
        body: msg.body,
        correlationId: ctx.correlationId,
      });
    }

    const employerMessages = read.messages.filter((m) => m.role === 'employer');
    const latestEmployer = employerMessages[employerMessages.length - 1];
    if (!latestEmployer) {
      await this.threads.markProcessed({
        id: thread.id,
        status: ChatThreadStatus.PROCESSED,
        classification: ChatClassification.UNKNOWN,
        notifyReason: 'no_employer_message',
      });
      return {
        externalId,
        status: 'SKIPPED',
        reason: 'no_employer_message',
      };
    }

    // Stop follow-ups if employer has written
    const followUp = await this.prisma.followUpState.findFirst({
      where: { threadId: thread.id, status: FollowUpStatus.ACTIVE },
    });
    if (followUp) {
      await this.followUps.stop(followUp.id, FollowUpStatus.COMPLETED);
    }

    const classified = this.classifier.classify(latestEmployer.body);

    if (classified.classification === ChatClassification.REJECTION) {
      await this.threads.markProcessed({
        id: thread.id,
        status: ChatThreadStatus.PROCESSED,
        classification: ChatClassification.REJECTION,
        notifyReason: null,
      });
      return {
        externalId,
        status: 'PROCESSED',
        classification: 'REJECTION',
        action: 'none',
      };
    }

    if (classified.classification === ChatClassification.INTERVIEW) {
      await this.threads.markProcessed({
        id: thread.id,
        status: ChatThreadStatus.NEEDS_MANUAL,
        classification: ChatClassification.INTERVIEW,
        notifyReason: 'interview_invite',
      });
      this.logger.warn({
        msg: 'Interview notify',
        externalId,
        employer: thread.employerName,
        vacancy: thread.vacancyTitle,
        workflowRunId: ctx.workflowRunId,
      });
      return {
        externalId,
        status: 'NEEDS_MANUAL',
        classification: 'INTERVIEW',
        action: 'notify',
        notifyReason: 'interview_invite',
      };
    }

    let replyText: string | null = null;

    if (classified.classification === ChatClassification.TEMPLATE) {
      replyText = this.classifier.buildTemplateReply(latestEmployer.body);
    }

    if (
      !replyText &&
      (classified.classification === ChatClassification.AI_QA ||
        classified.classification === ChatClassification.TEMPLATE ||
        classified.classification === ChatClassification.UNKNOWN)
    ) {
      try {
        replyText = await this.generateAiReply({
          employerMessage: latestEmployer.body,
          employerName: thread.employerName ?? undefined,
          vacancyTitle: thread.vacancyTitle ?? undefined,
        });
      } catch (error) {
        const reason =
          error instanceof LlmSchemaError
            ? 'llm_schema_mismatch'
            : error instanceof LlmConfigurationError
              ? 'llm_not_configured'
              : 'llm_reply_failed';
        await this.threads.markProcessed({
          id: thread.id,
          status: ChatThreadStatus.NEEDS_MANUAL,
          classification: classified.classification,
          notifyReason: reason,
        });
        return {
          externalId,
          status: 'NEEDS_MANUAL',
          classification: classified.classification,
          reason,
        };
      }
    }

    if (!replyText) {
      await this.threads.markProcessed({
        id: thread.id,
        status: ChatThreadStatus.PROCESSED,
        classification: classified.classification,
        notifyReason: 'no_reply_needed',
      });
      return {
        externalId,
        status: 'PROCESSED',
        classification: classified.classification,
        action: 'none',
      };
    }

    const sent = await this.playwright.sendChatMessage({
      externalId,
      text: replyText,
      dryRun: ctx.dryRun,
    });

    if (!sent.ok) {
      await this.threads.markProcessed({
        id: thread.id,
        status: ChatThreadStatus.NEEDS_MANUAL,
        classification: classified.classification,
        notifyReason: sent.reason ?? 'send_failed',
      });
      return {
        externalId,
        status: 'FAILED',
        classification: classified.classification,
        reason: sent.reason,
      };
    }

    if (!ctx.dryRun && sent.sent) {
      await this.messages.upsertMessage({
        threadId: thread.id,
        role: ChatMessageRole.APPLICANT,
        body: replyText,
        sentAt: new Date(),
        correlationId: ctx.correlationId,
        externalId: `out-${Date.now()}`,
      });
    }

    await this.threads.markProcessed({
      id: thread.id,
      status: ChatThreadStatus.PROCESSED,
      classification: classified.classification,
    });

    // Schedule follow-up after our reply (wait for employer)
    const delayDays = this.followUpDelayDays();
    await this.followUps.upsertForThread({
      threadId: thread.id,
      lastEmployerAt: new Date(),
      nextReminderAt: new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000),
      correlationId: ctx.correlationId,
    });

    return {
      externalId,
      status: ctx.dryRun ? 'DRY_RUN' : 'REPLIED',
      classification: classified.classification,
      action: 'reply',
      dryRun: ctx.dryRun,
      replyPreview: replyText.slice(0, 120),
    };
  }

  private async generateAiReply(input: {
    employerMessage: string;
    employerName?: string;
    vacancyTitle?: string;
  }): Promise<string | null> {
    if (!this.llm.isConfigured()) {
      throw new LlmConfigurationError();
    }

    const result = await this.llm.completeJson<unknown>({
      promptVersion: CHAT_REPLY_PROMPT_VERSION,
      system: CHAT_REPLY_SYSTEM,
      user: buildChatReplyUserPrompt({
        ...input,
        applicantProfile: this.config.get<string>('APPLICANT_PROFILE'),
      }),
      schemaHint: CHAT_REPLY_SCHEMA_HINT,
    });

    try {
      const parsed = parseChatReplyResult(result.data);
      if (!parsed.shouldReply || !parsed.reply) return null;
      return parsed.reply;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'invalid_chat_reply_schema';
      throw new LlmSchemaError(message, CHAT_REPLY_PROMPT_VERSION);
    }
  }

  private mapRole(role: 'employer' | 'applicant' | 'system'): ChatMessageRole {
    if (role === 'applicant') return ChatMessageRole.APPLICANT;
    if (role === 'system') return ChatMessageRole.SYSTEM;
    return ChatMessageRole.EMPLOYER;
  }

  private chatLimit(): number {
    const raw = Number(this.config.get<string>('CHAT_PROCESSOR_LIMIT', '10'));
    return Number.isFinite(raw) && raw > 0 ? raw : 10;
  }

  private followUpDelayDays(): number {
    const raw = Number(
      this.config.get<string>('FOLLOW_UP_DELAY_DAYS', '3'),
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 3;
  }

  private async failRun(runId: string, reason: string) {
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: WorkflowRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: reason,
      },
    });
    return {
      accepted: true,
      implemented: true,
      workflow: 'chat-processor',
      runId,
      status: 'FAILED',
      reason,
    };
  }
}
