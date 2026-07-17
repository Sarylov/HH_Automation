import { Injectable } from '@nestjs/common';
import {
  Prisma,
  VacancyStatus,
  type Vacancy,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class VacancyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByExternalId(input: {
    externalId: string;
    title: string;
    url: string;
    company?: string;
    salary?: string;
    snippet?: string;
    raw?: Prisma.InputJsonValue;
  }): Promise<{ vacancy: Vacancy; created: boolean }> {
    const existing = await this.prisma.vacancy.findUnique({
      where: { externalId: input.externalId },
    });

    if (existing) {
      const vacancy = await this.prisma.vacancy.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          url: input.url,
          company: input.company,
          salary: input.salary,
          snippet: input.snippet,
          raw: input.raw,
          lastSeenAt: new Date(),
        },
      });
      return { vacancy, created: false };
    }

    const vacancy = await this.prisma.vacancy.create({
      data: {
        externalId: input.externalId,
        title: input.title,
        url: input.url,
        company: input.company,
        salary: input.salary,
        snippet: input.snippet,
        raw: input.raw,
        status: VacancyStatus.NEW,
      },
    });
    return { vacancy, created: true };
  }

  async findById(id: string): Promise<Vacancy | null> {
    return this.prisma.vacancy.findUnique({ where: { id } });
  }

  async findRecent(limit = 50): Promise<Vacancy[]> {
    return this.prisma.vacancy.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
    });
  }

  async markQueued(id: string): Promise<Vacancy> {
    return this.prisma.vacancy.update({
      where: { id },
      data: { status: VacancyStatus.QUEUED },
    });
  }

  async markStatus(id: string, status: VacancyStatus): Promise<Vacancy> {
    return this.prisma.vacancy.update({
      where: { id },
      data: { status },
    });
  }
}
