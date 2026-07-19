import { Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import {
  ApplicationRepository,
  type ListApplicationsResult,
} from '../repositories/application.repository';

export type ListApplicationsInput = {
  status?: ApplicationStatus;
  limit?: number;
  cursor?: string;
};

@Injectable()
export class ListApplicationsUseCase {
  private readonly logger = new Logger(ListApplicationsUseCase.name);

  constructor(private readonly applications: ApplicationRepository) {}

  async execute(
    input: ListApplicationsInput = {},
  ): Promise<ListApplicationsResult> {
    const limit = clampLimit(input.limit);
    this.logger.log({
      msg: 'List applications',
      status: input.status ?? null,
      limit,
      hasCursor: Boolean(input.cursor),
    });
    return this.applications.list({
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
