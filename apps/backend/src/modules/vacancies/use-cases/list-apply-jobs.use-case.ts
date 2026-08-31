import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ApplyJobStatus } from '@prisma/client';
import { parseLocalDayYmd, todayLocalYmd } from '../../../lib/local-day';
import {
  ApplyJobRepository,
  type ListApplyJobsResult,
} from '../repositories/apply-job.repository';

export type ListApplyJobsInput = {
  status?: ApplyJobStatus;
  limit?: number;
  cursor?: string;
  date?: string;
};

@Injectable()
export class ListApplyJobsUseCase {
  private readonly logger = new Logger(ListApplyJobsUseCase.name);

  constructor(private readonly applyJobs: ApplyJobRepository) {}

  async execute(input: ListApplyJobsInput = {}): Promise<ListApplyJobsResult> {
    const limit = clampLimit(input.limit);
    const date = resolveListDate(input.date);
    this.logger.log({
      msg: 'List apply jobs',
      status: input.status ?? null,
      date,
      limit,
      hasCursor: Boolean(input.cursor),
    });
    return this.applyJobs.list({
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
