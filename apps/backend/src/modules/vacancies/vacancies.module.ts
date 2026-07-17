import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { VacancyRepository } from './repositories/vacancy.repository';
import { ApplyJobRepository } from './repositories/apply-job.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { ScanVacanciesUseCase } from './use-cases/scan-vacancies.use-case';
import { ApplyToVacancyUseCase } from './use-cases/apply-to-vacancy.use-case';
import { AnalyzeVacancyUseCase } from './use-cases/analyze-vacancy.use-case';
import { GenerateCoverLetterUseCase } from './use-cases/generate-cover-letter.use-case';
import { ApplyDelayPolicy } from './policies/apply-delay.policy';
import { ApplyProcessor } from '../../infrastructure/queue/apply.processor';

@Module({
  imports: [AuthModule, forwardRef(() => QueueModule)],
  providers: [
    VacancyRepository,
    ApplyJobRepository,
    ApplicationRepository,
    ApplyDelayPolicy,
    ScanVacanciesUseCase,
    AnalyzeVacancyUseCase,
    GenerateCoverLetterUseCase,
    ApplyToVacancyUseCase,
    ApplyProcessor,
  ],
  exports: [ScanVacanciesUseCase, ApplyToVacancyUseCase, VacancyRepository],
})
export class VacanciesModule {}
