import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VacanciesModule } from '../vacancies/vacancies.module';
import { ResumeRepository } from './repositories/resume.repository';
import { ResumeActionRepository } from './repositories/resume-action.repository';
import { MaintainResumesUseCase } from './use-cases/maintain-resumes.use-case';
import { OptimizeResumesUseCase } from './use-cases/optimize-resumes.use-case';

@Module({
  imports: [AuthModule, VacanciesModule],
  providers: [
    ResumeRepository,
    ResumeActionRepository,
    MaintainResumesUseCase,
    OptimizeResumesUseCase,
  ],
  exports: [MaintainResumesUseCase, OptimizeResumesUseCase],
})
export class ResumesModule {}
