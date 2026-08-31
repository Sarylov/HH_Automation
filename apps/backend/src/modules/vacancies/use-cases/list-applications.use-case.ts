import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { parseLocalDayYmd, todayLocalYmd } from '../../../lib/local-day';
import {
  ApplicationRepository,
  type ListApplicationsResult,
} from '../repositories/application.repository';

export type ListApplicationsInput = {
  status?: ApplicationStatus;
  limit?: number;
  cursor?: string;
  date?: string;
};

@Injectable()
export class ListApplicationsUseCase {
  private readonly logger = new Logger(ListApplicationsUseCase.name);

  constructor(private readonly applications: ApplicationRepository) {}

  async execute(
    input: ListApplicationsInput = {},
  ): Promise<ListApplicationsResult> {
    const limit = clampLimit(input.limit);
    const date = resolveListDate(input.date);
    this.logger.log({
      msg: 'List applications',
      status: input.status ?? null,
      date,
      limit,
      hasCursor: Boolean(input.cursor),
    });
    return this.applications.list({
      status: input.status,
      limit,
      cursor: input.cursor,
      date,
    });
  }
}

function resolveListDate(raw: string | undefined): string {
  const date = raw ?? todayLocalYmd();
  if (!parseLocalDayYmd(date)) {
    throw new BadRequestException('Invalid date');
  }
  return date;
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 50;
  return Math.min(100, Math.max(1, Math.floor(raw)));
}
