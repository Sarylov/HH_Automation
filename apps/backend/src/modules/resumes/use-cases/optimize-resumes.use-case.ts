import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import {
  Prisma,
  ResumeActionStatus,
  ResumeActionType,
  WorkflowName,
  WorkflowRunStatus,
} from '@prisma/client';
import {
  LlmConfigurationError,
  LlmSchemaError,
} from '../../../infrastructure/llm/llm.errors';
import { LLM_PORT, type LlmPort } from '../../../infrastructure/llm/llm.port';
import {
  RESUME_OPTIMIZE_PROMPT_VERSION,
  RESUME_OPTIMIZE_SCHEMA_HINT,
  RESUME_OPTIMIZE_SYSTEM,
  buildResumeOptimizeUserPrompt,
} from '../../../infrastructure/llm/prompts/resume-optimize.v1';
import { parseResumeOptimizeSuggestion } from '../../../infrastructure/llm/schemas/resume-optimize.schema';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository';
import { ResumeActionRepository } from '../repositories/resume-action.repository';
import { ResumeRepository } from '../repositories/resume.repository';

const TECH_TOKEN =
  /\b(?:React(?:\.js)?|Next\.js|TypeScript|JavaScript|Node\.js|Vue(?:\.js)?|Angular|Redux|Zustand|GraphQL|REST|Webpack|Vite|Docker|Jest|Playwright|Cypress|Storybook|SSR|SPA|CI\/CD|Git|HTML5?|CSS3?|SCSS|Sass|Tailwind|Figma|WebSocket|Monorepo|Turborepo|OpenAPI|Prisma|NestJS|Express)\b/gi;

@Injectable()
export class OptimizeResumesUseCase {
  private readonly logger = new Logger(OptimizeResumesUseCase.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
    private readonly resumes: ResumeRepository,
    private readonly actions: ResumeActionRepository,
    private readonly vacancies: VacancyRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input?: { correlationId?: string }) {
    const correlationId = input?.correlationId;
    const dryRun = isDryRun(this.config);
    const cooldownDays = this.cooldownDays();

    const run = await this.prisma.workflowRun.create({
      data: {
        workflow: WorkflowName.RESUME_OPTIMIZER,
        status: WorkflowRunStatus.RUNNING,
        correlationId,
        startedAt: new Date(),
        metadata: { dryRun, cooldownDays },
      },
    });

    this.logger.log({
      msg: 'Resume optimizer started',
      runId: run.id,
      correlationId,
      dryRun,
    });

    try {
      if (!this.llm.isConfigured()) {
        return await this.failRun(run.id, 'llm_not_configured');
      }

      const targetIds = this.targetResumeIds().slice(0, 2);
      if (targetIds.length === 0) {
        const listed = await this.playwright.listResumes();
        if (!listed.ok) {
          return await this.failRun(
            run.id,
            listed.reason ?? 'list_resumes_failed',
          );
        }
        targetIds.push(
          ...listed.items.slice(0, 2).map((item) => item.externalId),
        );
      }

      if (targetIds.length === 0) {
        return await this.failRun(run.id, 'no_target_resumes');
      }

      const marketSkills = await this.aggregateMarketSkills();
      const since = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
      const results: Array<Record<string, unknown>> = [];

      for (const externalId of targetIds) {
        const resume = await this.resumes.upsertByExternalId({ externalId });

        const recent = await this.actions.findRecentOptimize(resume.id, since);
        if (
          recent ||
          (resume.lastOptimizedAt && resume.lastOptimizedAt >= since)
        ) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.SKIP,
            status: ResumeActionStatus.SKIPPED,
            reason: 'already_optimized_within_window',
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId,
            status: 'SKIPPED',
            reason: 'already_optimized_within_window',
          });
          continue;
        }

        const read = await this.playwright.readResume(externalId);
        if (!read.ok || !read.fields) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.OPTIMIZE,
            status: ResumeActionStatus.FAILED,
            reason: read.reason ?? 'read_failed',
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId,
            status: 'FAILED',
            reason: read.reason,
          });
          continue;
        }

        const snapshot = {
          title: read.fields.title,
          about: read.fields.about,
          skills: read.fields.skills,
          salary: read.fields.salary,
          capturedAt: new Date().toISOString(),
        };

        let suggestion;
        try {
          suggestion = await this.suggestOptimize({
            title: read.fields.title,
            currentSkills: read.fields.skills,
            about: read.fields.about,
            marketSkills,
          });
        } catch (error) {
          const reason =
            error instanceof LlmSchemaError
              ? 'llm_schema_mismatch'
              : error instanceof LlmConfigurationError
                ? 'llm_not_configured'
                : 'llm_optimize_failed';
          const message = error instanceof Error ? error.message : reason;
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.OPTIMIZE,
            status: ResumeActionStatus.FAILED,
            reason: message,
            snapshot,
            correlationId,
            workflowRunId: run.id,
          });
          results.push({ externalId, status: 'FAILED', reason });
          continue;
        }

        if (!suggestion.shouldUpdate) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.SKIP,
            status: ResumeActionStatus.SKIPPED,
            reason: 'no_meaningful_diff',
            changelog: suggestion,
            snapshot,
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId,
            status: 'SKIPPED',
            reason: 'no_meaningful_diff',
            suggestion,
          });
          continue;
        }

        const nextSkills = this.applySkillDiff(
          read.fields.skills,
          suggestion.skillsToAdd,
          suggestion.skillsToRemove,
        );

        const update = await this.playwright.updateResume({
          externalId,
          skills: suggestion.skillsToAdd,
          about: suggestion.aboutHint ?? undefined,
          dryRun,
        });

        if (!update.ok) {
          await this.actions.create({
            resumeId: resume.id,
            type: ResumeActionType.OPTIMIZE,
            status: ResumeActionStatus.FAILED,
            reason: update.reason ?? 'update_failed',
            changelog: suggestion,
            snapshot,
            correlationId,
            workflowRunId: run.id,
          });
          results.push({
            externalId,
            status: 'FAILED',
            reason: update.reason,
          });
          continue;
        }

        const changelog = {
          ...suggestion,
          nextSkills,
          dryRun,
        };

        if (!dryRun) {
          await this.resumes.markOptimized(
            resume.id,
            snapshot as Prisma.InputJsonValue,
          );
        } else {
          await this.resumes.upsertByExternalId({
            externalId,
            title: read.fields.title,
            url: read.url,
            fieldsSnapshot: snapshot as Prisma.InputJsonValue,
          });
        }

        await this.actions.create({
          resumeId: resume.id,
          type: ResumeActionType.OPTIMIZE,
          status: ResumeActionStatus.SUCCEEDED,
          reason: dryRun ? 'dry_run' : 'optimized',
          changelog,
          snapshot,
          correlationId,
          workflowRunId: run.id,
        });

        results.push({
          externalId,
          status: dryRun ? 'DRY_RUN' : 'SUCCEEDED',
          changelog,
          snapshot,
        });
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          metadata: {
            dryRun,
            cooldownDays,
            marketSkills,
            results,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log({
        msg: 'Resume optimizer completed',
        runId: run.id,
        count: results.length,
      });

      return {
        accepted: true,
        implemented: true,
        workflow: 'resume-optimizer',
        runId: run.id,
        status: 'SUCCEEDED',
        dryRun,
        marketSkills,
        results,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'resume_optimizer_failed';
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

  private async suggestOptimize(input: {
    title?: string;
    currentSkills: string[];
    about?: string;
    marketSkills: string[];
  }) {
    const user = buildResumeOptimizeUserPrompt({
      ...input,
      applicantProfile: this.config.get<string>('APPLICANT_PROFILE'),
    });

    const result = await this.llm.completeJson<unknown>({
      promptVersion: RESUME_OPTIMIZE_PROMPT_VERSION,
      system: RESUME_OPTIMIZE_SYSTEM,
      user,
      schemaHint: RESUME_OPTIMIZE_SCHEMA_HINT,
    });

    try {
      return parseResumeOptimizeSuggestion(result.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'invalid_optimize_schema';
      throw new LlmSchemaError(message, RESUME_OPTIMIZE_PROMPT_VERSION);
    }
  }

  private async aggregateMarketSkills(): Promise<string[]> {
    const recent = await this.vacancies.findRecent(80);
    const counts = new Map<string, number>();

    for (const vacancy of recent) {
      const blob = [vacancy.title, vacancy.snippet ?? '', vacancy.salary ?? '']
        .join(' ')
        .toLowerCase();
      const matches = blob.match(TECH_TOKEN) ?? [];
      for (const raw of matches) {
        const key = this.normalizeSkill(raw);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([skill]) => skill);
  }

  private applySkillDiff(
    current: string[],
    add: string[],
    remove: string[],
  ): string[] {
    const removeSet = new Set(remove.map((s) => s.toLowerCase()));
    const next = current.filter((s) => !removeSet.has(s.toLowerCase()));
    const seen = new Set(next.map((s) => s.toLowerCase()));
    for (const skill of add) {
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(skill);
    }
    return next;
  }

  private normalizeSkill(raw: string): string {
    const map: Record<string, string> = {
      'react.js': 'React',
      react: 'React',
      'next.js': 'Next.js',
      typescript: 'TypeScript',
      javascript: 'JavaScript',
      'node.js': 'Node.js',
      'vue.js': 'Vue',
      vue: 'Vue',
      redux: 'Redux',
      zustand: 'Zustand',
      graphql: 'GraphQL',
      rest: 'REST',
      webpack: 'Webpack',
      vite: 'Vite',
      docker: 'Docker',
      jest: 'Jest',
      playwright: 'Playwright',
      cypress: 'Cypress',
      storybook: 'Storybook',
      ssr: 'SSR',
      spa: 'SPA',
      'ci/cd': 'CI/CD',
      git: 'Git',
      html: 'HTML',
      html5: 'HTML5',
      css: 'CSS',
      css3: 'CSS3',
      scss: 'SCSS',
      sass: 'Sass',
      tailwind: 'Tailwind',
      figma: 'Figma',
      websocket: 'WebSocket',
      monorepo: 'Monorepo',
      turborepo: 'Turborepo',
      openapi: 'OpenAPI',
      prisma: 'Prisma',
      nestjs: 'NestJS',
      express: 'Express',
      angular: 'Angular',
    };
    const key = raw.toLowerCase();
    return map[key] ?? raw;
  }

  private targetResumeIds(): string[] {
    const raw = this.config.get<string>('HH_RESUME_IDS', '');
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  private cooldownDays(): number {
    const raw = Number(
      this.config.get<string>('RESUME_OPTIMIZE_COOLDOWN_DAYS', '3'),
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
    this.logger.warn({ msg: 'Resume optimizer failed', runId, reason });
    return {
      accepted: true,
      implemented: true,
      workflow: 'resume-optimizer',
      runId,
      status: 'FAILED',
      reason,
    };
  }
}
