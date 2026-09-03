import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseLocalDayYmd, todayLocalYmd } from '../../../lib/local-day';
import {
  ApplicationRepository,
  type ApplicationDaySummary,
} from '../repositories/application.repository';

export type GetApplicationSummaryInput = {
  date?: string;
};

@Injectable()
export class GetApplicationSummaryUseCase {
  private readonly logger = new Logger(GetApplicationSummaryUseCase.name);

  constructor(private readonly applications: ApplicationRepository) {}

  async execute(
    input: GetApplicationSummaryInput = {},
  ): Promise<ApplicationDaySummary> {
    const date = resolveSummaryDate(input.date);
    this.logger.log({ msg: 'Application day summary', date });
    return this.applications.daySummary(date);
  }
}

function resolveSummaryDate(raw: string | undefined): string {
  const date = raw ?? todayLocalYmd();
  if (!parseLocalDayYmd(date)) {
    throw new BadRequestException('Invalid date');
  }
  return date;
}
