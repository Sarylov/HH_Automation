import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { mapApplicationItem } from './mappers/ops-read.mapper';
import { GetApplicationUseCase } from './use-cases/get-application.use-case';
import { ListApplicationsUseCase } from './use-cases/list-applications.use-case';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly listApplications: ListApplicationsUseCase,
    private readonly getApplication: GetApplicationUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListApplicationsQueryDto) {
    const result = await this.listApplications.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return {
      items: result.items.map(mapApplicationItem),
      nextCursor: result.nextCursor,
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.getApplication.execute(id);
    return mapApplicationItem(row);
  }
}
