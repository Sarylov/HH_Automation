import { Controller, Get, Query } from '@nestjs/common';
import { ListApplyJobsQueryDto } from './dto/list-apply-jobs-query.dto';
import { mapApplyJobItem } from './mappers/ops-read.mapper';
import { ListApplyJobsUseCase } from './use-cases/list-apply-jobs.use-case';

@Controller('apply-jobs')
export class ApplyJobsController {
  constructor(private readonly listApplyJobs: ListApplyJobsUseCase) {}

  @Get()
  async list(@Query() query: ListApplyJobsQueryDto) {
    const result = await this.listApplyJobs.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return {
      items: result.items.map(mapApplyJobItem),
      nextCursor: result.nextCursor,
    };
  }
}
