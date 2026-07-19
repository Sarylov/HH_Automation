import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VacancyRepository } from './repositories/vacancy.repository';
import { ApplyJobRepository } from './repositories/apply-job.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { ScanVacanciesUseCase } from './use-cases/scan-vacancies.use-case';
import { ApplyToVacancyUseCase } from './use-cases/apply-to-vacancy.use-case';
import { ApplyNextUseCase } from './use-cases/apply-next.use-case';
import { AnalyzeVacancyUseCase } from './use-cases/analyze-vacancy.use-case';
import { GenerateCoverLetterUseCase } from './use-cases/generate-cover-letter.use-case';
import { ApplyDelayPolicy } from './policies/apply-delay.policy';

@Module({
  imports: [AuthModule],
  providers: [
    VacancyRepository,
    ApplyJobRepository,
    ApplicationRepository,
    ApplyDelayPolicy,
    ScanVacanciesUseCase,
    AnalyzeVacancyUseCase,
    GenerateCoverLetterUseCase,
    ApplyToVacancyUseCase,
    ApplyNextUseCase,
  ],
  exports: [
    ScanVacanciesUseCase,
    ApplyToVacancyUseCase,
    ApplyNextUseCase,
    VacancyRepository,
  ],
})
export class VacanciesModule {}
