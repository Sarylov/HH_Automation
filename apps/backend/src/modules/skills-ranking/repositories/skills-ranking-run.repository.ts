import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SkillsRankingRun,
  SkillsRankingRunStatus,
  SkillsRankingSkill,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type SkillsRankingSkillInput = {
  query: string;
  name: string;
  unique: string;
  counts: number;
};

@Injectable()
export class SkillsRankingRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRunning(input: {
    profiles: Prisma.InputJsonValue;
    correlationId?: string;
  }): Promise<SkillsRankingRun> {
    return this.prisma.skillsRankingRun.create({
      data: {
        status: SkillsRankingRunStatus.RUNNING,
        startedAt: new Date(),
        profiles: input.profiles,
        correlationId: input.correlationId,
      },
    });
  }

  async markSucceeded(input: {
    id: string;
    stats: Prisma.InputJsonValue;
    skills: SkillsRankingSkillInput[];
  }): Promise<SkillsRankingRun> {
    return this.prisma.$transaction(async (tx) => {
      if (input.skills.length > 0) {
        await tx.skillsRankingSkill.createMany({
          data: input.skills.map((skill) => ({
            runId: input.id,
            query: skill.query,
            name: skill.name,
            unique: skill.unique,
            counts: skill.counts,
          })),
        });
      }
      return tx.skillsRankingRun.update({
        where: { id: input.id },
        data: {
          status: SkillsRankingRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          stats: input.stats,
          errorMessage: null,
        },
      });
    });
  }

  async markFailed(input: {
    id: string;
    reason: string;
    stats?: Prisma.InputJsonValue;
  }): Promise<SkillsRankingRun> {
    return this.prisma.skillsRankingRun.update({
      where: { id: input.id },
      data: {
        status: SkillsRankingRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: input.reason,
        stats: input.stats,
      },
    });
  }

  async findByIdWithSkills(
    id: string,
  ): Promise<(SkillsRankingRun & { skills: SkillsRankingSkill[] }) | null> {
    return this.prisma.skillsRankingRun.findUnique({
      where: { id },
      include: { skills: true },
    });
  }

  async findSucceededSkillsForQuery(input: {
    runId: string;
    query: string;
  }): Promise<{
    run: SkillsRankingRun | null;
    skills: SkillsRankingSkill[];
  }> {
    const run = await this.prisma.skillsRankingRun.findFirst({
      where: {
        id: input.runId,
        status: SkillsRankingRunStatus.SUCCEEDED,
      },
    });
    if (!run) {
      return { run: null, skills: [] };
    }

    const skills = await this.prisma.skillsRankingSkill.findMany({
      where: {
        runId: input.runId,
        query: input.query,
      },
      orderBy: [{ counts: 'desc' }, { unique: 'asc' }],
    });

    return { run, skills };
  }

  /** All skills for a succeeded run, ordered by counts desc. */
  async findSucceededSkillsForRun(input: { runId: string }): Promise<{
    run: SkillsRankingRun | null;
    skills: SkillsRankingSkill[];
  }> {
    const run = await this.prisma.skillsRankingRun.findFirst({
      where: {
        id: input.runId,
        status: SkillsRankingRunStatus.SUCCEEDED,
      },
    });
    if (!run) {
      return { run: null, skills: [] };
    }

    const skills = await this.prisma.skillsRankingSkill.findMany({
      where: { runId: input.runId },
      orderBy: [{ counts: 'desc' }, { unique: 'asc' }],
    });

    return { run, skills };
  }
}
