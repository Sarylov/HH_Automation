import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';
import { SkillsRankingRunRepository } from '../repositories/skills-ranking-run.repository';

export type SkillsRankingProfileInput = {
  label: string;
  text: string;
  area?: string;
  excludedText?: string;
  workFormat?: 'REMOTE';
  searchPeriod?: number;
  searchField?: 'name' | 'company_name' | 'description';
  itemsOnPage?: number;
};

export type SkillsRankingExecuteInput = {
  profiles: SkillsRankingProfileInput[];
  correlationId?: string;
};

type ProfileStat = {
  label: string;
  expectedTotal: number;
  collected: number;
  vacanciesWithoutSkills: number;
};

type AggregatedSkill = {
  query: string;
  name: string;
  unique: string;
  counts: number;
};

@Injectable()
export class RankSkillsUseCase {
  private readonly logger = new Logger(RankSkillsUseCase.name);

  constructor(
    private readonly playwright: PlaywrightClient,
    private readonly runs: SkillsRankingRunRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(input: SkillsRankingExecuteInput) {
    if (!input.profiles?.length) {
      throw new BadRequestException('profiles is required and must be non-empty');
    }

    const profiles = input.profiles.map((profile) =>
      this.normalizeProfile(profile),
    );

    const auth = await this.playwright.getAuthStatus();
    if (auth.status !== 'up') {
      this.logger.warn({
        msg: 'Skills ranking refused — session not up',
        status: auth.status,
        reason: auth.reason,
      });
      throw new HttpException(
        {
          accepted: false,
          reason: auth.reason ?? 'session_not_up',
          sessionStatus: auth.status,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const run = await this.runs.createRunning({
      profiles: profiles as unknown as Prisma.InputJsonValue,
      correlationId: input.correlationId,
    });

    this.logger.log({
      msg: 'Skills ranking started',
      runId: run.id,
      profileCount: profiles.length,
      correlationId: input.correlationId,
    });

    const delayMs = Number(
      this.config.get<string>('SKILLS_COLLECT_DELAY_MS', '1500'),
    );
    const aggregated = new Map<string, AggregatedSkill>();
    const perProfile: ProfileStat[] = [];
    let expectedTotalSum = 0;
    let collectedSum = 0;

    try {
      for (const profile of profiles) {
        const collected = await this.playwright.collectProfileSkills({
          ...profile,
          delayMs: Number.isFinite(delayMs) ? delayMs : 1_500,
        });

        if (!collected.ok) {
          const reason =
            collected.reason ??
            `skills_collect_failed label=${profile.label}`;
          await this.runs.markFailed({
            id: run.id,
            reason,
            stats: {
              perProfile,
              expectedTotalSum,
              collectedSum,
              failedLabel: profile.label,
            } as Prisma.InputJsonValue,
          });
          this.logger.warn({
            msg: 'Skills ranking failed',
            runId: run.id,
            reason,
          });
          throw new HttpException(
            {
              accepted: false,
              runId: run.id,
              status: 'FAILED',
              reason,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        expectedTotalSum += collected.expectedTotal;
        collectedSum += collected.collected;
        perProfile.push({
          label: collected.label,
          expectedTotal: collected.expectedTotal,
          collected: collected.collected,
          vacanciesWithoutSkills: collected.vacanciesWithoutSkills.length,
        });

        for (const item of collected.items) {
          const seenInVacancy = new Set<string>();
          for (const raw of item.skills) {
            const name = raw.replace(/\s+/g, ' ').trim();
            if (!name) continue;
            const unique = name.toLowerCase();
            if (seenInVacancy.has(unique)) continue;
            seenInVacancy.add(unique);

            const key = `${collected.label}::${unique}`;
            const existing = aggregated.get(key);
            if (existing) {
              existing.counts += 1;
            } else {
              aggregated.set(key, {
                query: collected.label,
                name,
                unique,
                counts: 1,
              });
            }
          }
        }
      }

      const skills = [...aggregated.values()];
      const stats = {
        perProfile,
        expectedTotalSum,
        collectedSum,
        skillCount: skills.length,
      };

      const saved = await this.runs.markSucceeded({
        id: run.id,
        stats: stats as Prisma.InputJsonValue,
        skills,
      });

      this.logger.log({
        msg: 'Skills ranking completed',
        runId: saved.id,
        skillCount: skills.length,
        expectedTotalSum,
        collectedSum,
      });

      return {
        accepted: true,
        runId: saved.id,
        status: saved.status,
        startedAt: saved.startedAt?.toISOString() ?? null,
        finishedAt: saved.finishedAt?.toISOString() ?? null,
        stats,
        skills,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const reason =
        error instanceof Error ? error.message : 'skills_ranking_failed';
      await this.runs.markFailed({
        id: run.id,
        reason,
        stats: {
          perProfile,
          expectedTotalSum,
          collectedSum,
        } as Prisma.InputJsonValue,
      });
      this.logger.error({
        msg: 'Skills ranking failed unexpectedly',
        runId: run.id,
        reason,
      });
      throw new HttpException(
        {
          accepted: false,
          runId: run.id,
          status: 'FAILED',
          reason,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeProfile(
    profile: SkillsRankingProfileInput,
  ): SkillsRankingProfileInput {
    const label = profile.label?.trim().toLowerCase();
    const text = profile.text?.trim();
    if (!label || !text) {
      throw new BadRequestException(
        'each profile requires non-empty label and text',
      );
    }
    return {
      label,
      text,
      area: profile.area?.trim() || undefined,
      excludedText: profile.excludedText?.trim() || undefined,
      workFormat: profile.workFormat,
      searchPeriod: profile.searchPeriod,
      searchField: profile.searchField,
      itemsOnPage: profile.itemsOnPage ?? 100,
    };
  }
}
