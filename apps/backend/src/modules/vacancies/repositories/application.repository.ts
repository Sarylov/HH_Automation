import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  Prisma,
  type Application,
  type Vacancy,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
} from '../lib/list-cursor';

export type ApplicationWithVacancy = Application & {
  vacancy: Pick<Vacancy, 'id' | 'title' | 'company' | 'url' | 'salary'>;
};

export type ListApplicationsResult = {
  items: ApplicationWithVacancy[];
  nextCursor: string | null;
};

const vacancySelect = {
  id: true,
  title: true,
  company: true,
  url: true,
  salary: true,
} as const;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVacancyId(vacancyId: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { vacancyId } });
  }

  async findByIdWithVacancy(
    id: string,
  ): Promise<ApplicationWithVacancy | null> {
    return this.prisma.application.findUnique({
      where: { id },
      include: { vacancy: { select: vacancySelect } },
    });
  }

  async list(input: {
    status?: ApplicationStatus;
    limit: number;
    cursor?: string;
  }): Promise<ListApplicationsResult> {
    const decoded = input.cursor
      ? decodeCreatedAtCursor(input.cursor)
      : null;
    if (input.cursor && !decoded) {
      throw new BadRequestException('Invalid cursor');
    }

    const rows = await this.prisma.application.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.at } },
                { createdAt: decoded.at, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      include: { vacancy: { select: vacancySelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCreatedAtCursor(last.createdAt, last.id)
        : null;

    return { items: page, nextCursor };
  }

  async upsertStub(input: {
    vacancyId: string;
    correlationId?: string;
    errorMessage?: string | null;
    status?: ApplicationStatus;
  }): Promise<Application> {
    return this.prisma.application.upsert({
      where: { vacancyId: input.vacancyId },
      create: {
        vacancyId: input.vacancyId,
        status: input.status ?? ApplicationStatus.STUB,
        correlationId: input.correlationId,
        errorMessage: input.errorMessage ?? null,
        appliedAt: new Date(),
      },
      update: {
        status: input.status ?? ApplicationStatus.STUB,
        correlationId: input.correlationId,
        errorMessage: input.errorMessage ?? null,
        appliedAt: new Date(),
      },
    });
  }

  async upsertResult(input: {
    vacancyId: string;
    status: ApplicationStatus;
    coverLetter?: string | null;
    analysis?: Prisma.InputJsonValue;
    correlationId?: string;
    errorMessage?: string | null;
    appliedAt?: Date | null;
  }): Promise<Application> {
    return this.prisma.application.upsert({
      where: { vacancyId: input.vacancyId },
      create: {
        vacancyId: input.vacancyId,
        status: input.status,
        coverLetter: input.coverLetter ?? null,
        analysis: input.analysis,
        correlationId: input.correlationId,
        errorMessage: input.errorMessage ?? null,
        appliedAt: input.appliedAt ?? null,
      },
      update: {
        status: input.status,
        coverLetter: input.coverLetter ?? null,
        analysis: input.analysis,
        correlationId: input.correlationId,
        errorMessage: input.errorMessage ?? null,
        appliedAt: input.appliedAt ?? null,
      },
    });
  }
}
