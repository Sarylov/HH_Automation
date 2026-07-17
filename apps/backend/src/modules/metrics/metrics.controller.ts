import { Controller, Get } from '@nestjs/common';
import { GetMetricsUseCase } from './use-cases/get-metrics.use-case';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly getMetrics: GetMetricsUseCase) {}

  @Get()
  async metrics() {
    return this.getMetrics.execute();
  }
}
