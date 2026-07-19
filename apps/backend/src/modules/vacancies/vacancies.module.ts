import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplyJobsController } from './apply-jobs.controller';
import { ApplicationsController } from './applications.controller';
import { VacancyRepository } from './repositories/vacancy.repository';
import { ApplyJobRepository } from './repositories/apply-job.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { ScanVacanciesUseCase } from './use-cases/scan-vacancies.use-case';
import { ApplyToVacancyUseCase } from './use-cases/apply-to-vacancy.use-case';
import { ApplyNextUseCase } from './use-cases/apply-next.use-case';
import { AnalyzeVacancyUseCase } from './use-cases/analyze-vacancy.use-case';
import { GenerateCoverLetterUseCase } from './use-cases/generate-cover-letter.use-case';
import { ListApplyJobsUseCase } from './use-cases/list-apply-jobs.use-case';
import { ListApplicationsUseCase } from './use-cases/list-applications.use-case';
import { GetApplicationUseCase } from './use-cases/get-application.use-case';
import { ApplyDelayPolicy } from './policies/apply-delay.policy';

@Module({
  imports: [AuthModule],
  controllers: [ApplyJobsController, ApplicationsController],
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
    ListApplyJobsUseCase,
    ListApplicationsUseCase,
    GetApplicationUseCase,
  ],
  exports: [
    ScanVacanciesUseCase,
    ApplyToVacancyUseCase,
    ApplyNextUseCase,
    VacancyRepository,
  ],
})
export class VacanciesModule {}
