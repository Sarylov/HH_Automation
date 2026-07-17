import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetricsController } from './metrics.controller';
import { GetMetricsUseCase } from './use-cases/get-metrics.use-case';

@Module({
  imports: [AuthModule],
  controllers: [MetricsController],
  providers: [GetMetricsUseCase],
  exports: [GetMetricsUseCase],
})
export class MetricsModule {}
