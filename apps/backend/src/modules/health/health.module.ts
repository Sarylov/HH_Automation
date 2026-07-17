import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GetHealthUseCase } from './use-cases/get-health.use-case';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [GetHealthUseCase],
})
export class HealthModule {}
