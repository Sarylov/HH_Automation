import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ResumeActionStatus,
  ResumeActionType,
  SkillsRankingRunStatus,
  type SkillsRankingSkill,
} from '@prisma/client';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { SkillsRankingRunRepository } from '../../skills-ranking/repositories/skills-ranking-run.repository';
import { ResumeActionRepository } from '../repositories/resume-action.repository';
import { ResumeRepository } from '../repositories/resume.repository';

const DEFAULT_TOP_N = 30;
const MAX_CHIPS = 30;
/** Applied when `blacklist` is omitted from the request. */
const DEFAULT_BLACKLIST = ['angular', 'c++'];

export type SyncResumeSkillsInput = {
  resumeExternalId: string;
  rankingRunId: string;
  query: string;
  topN?: number;
  /** Case-insensitive substrings; drops skills whose name/unique contains any token (e.g. "angular" → Angular, AngularJS). */
  blacklist?: string[];
  correlationId?: string;
};

/** Exported for unit tests. */
export function normalizeBlacklist(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const token = item.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}

/** Skill is blocked if any blacklist token is a substring of its unique key. */
export function isSkillBlacklisted(
  skillUnique: string,
  blacklist: string[],
): boolean {
  if (blacklist.length === 0) return false;
  const key = skillUnique.replace(/\s+/g, ' ').trim().toLowerCase();
  return blacklist.some((token) => key.includes(token));
}

export function pickTargetSkills(
  ranked: SkillsRankingSkill[],
  topN: number,
  blacklist: string[],
): { desired: SkillsRankingSkill[]; skipped: SkillsRankingSkill[] } {
  const skipped: SkillsRankingSkill[] = [];
  const desired: SkillsRankingSkill[] = [];
  for (const skill of ranked) {
    if (isSkillBlacklisted(skill.unique, blacklist)) {
      skipped.push(skill);
      continue;
    }
    desired.push(skill);
    if (desired.length >= topN) break;
  }
  return { desired, skipped };
}

@Injectable()
export class SyncResumeSkillsUseCase {
  private readonly logger = new Logger(SyncResumeSkillsUseCase.name);

  constructor(
    private readonly playwright: PlaywrightClient,
    private readonly rankingRuns: SkillsRankingRunRepository,
    private readonly resumes: ResumeRepository,
    private readonly actions: ResumeActionRepository,
  ) {}

  async execute(input: SyncResumeSkillsInput) {
    const resumeExternalId = input.resumeExternalId?.trim();
    const rankingRunId = input.rankingRunId?.trim();
    const query = input.query?.trim().toLowerCase();
    const topN = Math.min(
      Math.max(input.topN ?? DEFAULT_TOP_N, 1),
      MAX_CHIPS,
    );
    const blacklist = normalizeBlacklist(
      input.blacklist !== undefined ? input.blacklist : DEFAULT_BLACKLIST,
    );

    if (!resumeExternalId || !rankingRunId || !query) {
      throw new BadRequestException(
        'resumeExternalId, rankingRunId and query are required',
      );
    }

    const auth = await this.playwright.getAuthStatus();
    if (auth.status !== 'up') {
      throw new HttpException(
        {
          accepted: false,
          reason: auth.reason ?? 'session_not_up',
          sessionStatus: auth.status,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const { run, skills: ranked } =
      await this.rankingRuns.findSucceededSkillsForQuery({
        runId: rankingRunId,
        query,
      });

    if (!run || run.status !== SkillsRankingRunStatus.SUCCEEDED) {
      throw new NotFoundException(
        `skills ranking run not found or not SUCCEEDED: ${rankingRunId}`,
      );
    }

    if (ranked.length === 0) {
      throw new BadRequestException(
        `no skills for query="${query}" in run ${rankingRunId}`,
      );
    }

    const { desired, skipped } = pickTargetSkills(ranked, topN, blacklist);
    if (desired.length === 0) {
      throw new BadRequestException(
        `no skills left after blacklist for query="${query}" in run ${rankingRunId}`,
      );
    }

    const desiredSkills = desired.map((s) => s.name);
    const blacklistedSkipped = skipped.map((s) => s.name);

    this.logger.log({
      msg: 'Resume skills sync started',
      resumeExternalId,
      rankingRunId,
      query,
      topN,
      blacklist,
      desiredCount: desiredSkills.length,
      blacklistedSkipped: blacklistedSkipped.length,
      correlationId: input.correlationId,
    });

    const resume = await this.resumes.upsertByExternalId({
      externalId: resumeExternalId,
      url: `https://hh.ru/resume/${resumeExternalId}`,
    });

    const synced = await this.playwright.syncResumeSkills({
      externalId: resumeExternalId,
      desiredSkills,
    });

    const changelogBase = {
      rankingRunId,
      query,
      topN,
      blacklist,
      blacklistedSkipped,
      desiredSkills,
    };

    if (!synced.ok) {
      const reason = synced.reason ?? 'skills_sync_failed';
      await this.actions.create({
        resumeId: resume.id,
        type: ResumeActionType.SKILLS_SYNC,
        status: ResumeActionStatus.FAILED,
        reason,
        changelog: {
          ...changelogBase,
          before: synced.before ?? null,
          after: synced.after ?? null,
          added: synced.added ?? null,
          removed: synced.removed ?? null,
        },
        correlationId: input.correlationId,
      });
      this.logger.warn({
        msg: 'Resume skills sync failed',
        resumeExternalId,
        reason,
      });
      throw new HttpException(
        {
          accepted: false,
          status: 'FAILED',
          reason,
          resumeExternalId,
          rankingRunId,
          query,
          screenshotPath: synced.screenshotPath,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (synced.skipped) {
      await this.actions.create({
        resumeId: resume.id,
        type: ResumeActionType.SKILLS_SYNC,
        status: ResumeActionStatus.SKIPPED,
        reason: synced.reason ?? 'already_up_to_date',
        changelog: {
          ...changelogBase,
          before: synced.before ?? [],
          after: synced.after ?? synced.before ?? [],
          added: [],
          removed: [],
        },
        snapshot: { skills: synced.before ?? [] },
        correlationId: input.correlationId,
      });

      this.logger.log({
        msg: 'Resume skills sync skipped — already up to date',
        resumeExternalId,
      });

      return {
        accepted: true,
        status: 'SKIPPED',
        reason: synced.reason ?? 'already_up_to_date',
        resumeExternalId,
        rankingRunId,
        query,
        topN,
        blacklist,
        blacklistedSkipped,
        before: synced.before ?? [],
        after: synced.after ?? synced.before ?? [],
        added: [],
        removed: [],
      };
    }

    const after = synced.after ?? desiredSkills;
    await this.resumes.markOptimized(resume.id, { skills: after });
    await this.actions.create({
      resumeId: resume.id,
      type: ResumeActionType.SKILLS_SYNC,
      status: ResumeActionStatus.SUCCEEDED,
      reason: null,
      changelog: {
        ...changelogBase,
        before: synced.before ?? [],
        after,
        added: synced.added ?? [],
        removed: synced.removed ?? [],
      },
      snapshot: { skills: after },
      correlationId: input.correlationId,
    });

    this.logger.log({
      msg: 'Resume skills sync completed',
      resumeExternalId,
      added: synced.added?.length ?? 0,
      removed: synced.removed?.length ?? 0,
      blacklistedSkipped: blacklistedSkipped.length,
    });

    return {
      accepted: true,
      status: 'SUCCEEDED',
      resumeExternalId,
      rankingRunId,
      query,
      topN,
      blacklist,
      blacklistedSkipped,
      before: synced.before ?? [],
      after,
      added: synced.added ?? [],
      removed: synced.removed ?? [],
    };
  }
}
