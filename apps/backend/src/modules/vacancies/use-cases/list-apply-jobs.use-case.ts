import { Injectable, Logger } from '@nestjs/common';
import { ApplyJobStatus } from '@prisma/client';
import {
  ApplyJobRepository,
  type ListApplyJobsResult,
} from '../repositories/apply-job.repository';

export type ListApplyJobsInput = {
  status?: ApplyJobStatus;
  limit?: number;
  cursor?: string;
};

@Injectable()
export class ListApplyJobsUseCase {
  private readonly logger = new Logger(ListApplyJobsUseCase.name);

  constructor(private readonly applyJobs: ApplyJobRepository) {}

  async execute(input: ListApplyJobsInput = {}): Promise<ListApplyJobsResult> {
    const limit = clampLimit(input.limit);
    this.logger.log({
      msg: 'List apply jobs',
      status: input.status ?? null,
      limit,
      hasCursor: Boolean(input.cursor),
    });
    return this.applyJobs.list({
      status: input.status,
      limit,
      cursor: input.cursor,
    });
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 50;
  return Math.min(100, Math.max(1, Math.floor(raw)));
}
