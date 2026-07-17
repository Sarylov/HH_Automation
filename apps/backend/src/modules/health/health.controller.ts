import { Controller, Get } from '@nestjs/common';
import { GetHealthUseCase } from './use-cases/get-health.use-case';

@Controller('health')
export class HealthController {
  constructor(private readonly getHealth: GetHealthUseCase) {}

  @Get()
  async check() {
    return this.getHealth.execute();
  }
}
