import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApplicationSummaryQueryDto } from './dto/application-summary-query.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { mapApplicationItem } from './mappers/ops-read.mapper';
import { GetApplicationSummaryUseCase } from './use-cases/get-application-summary.use-case';
import { GetApplicationUseCase } from './use-cases/get-application.use-case';
import { ListApplicationsUseCase } from './use-cases/list-applications.use-case';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly listApplications: ListApplicationsUseCase,
    private readonly getApplicationSummary: GetApplicationSummaryUseCase,
    private readonly getApplication: GetApplicationUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListApplicationsQueryDto) {
    const result = await this.listApplications.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
      date: query.date,
    });
    return {
      items: result.items.map(mapApplicationItem),
      nextCursor: result.nextCursor,
    };
  }

  @Get('summary')
  async summary(@Query() query: ApplicationSummaryQueryDto) {
    return this.getApplicationSummary.execute({ date: query.date });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.getApplication.execute(id);
    return mapApplicationItem(row);
  }
}
