import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsRankingModule } from '../skills-ranking/skills-ranking.module';
import { ResumeRaiseController } from './resume-raise.controller';
import { ResumeSkillsSyncController } from './resume-skills-sync.controller';
import { ResumeRepository } from './repositories/resume.repository';
import { ResumeActionRepository } from './repositories/resume-action.repository';
import { MaintainResumesUseCase } from './use-cases/maintain-resumes.use-case';
import { RaiseProfileResumeUseCase } from './use-cases/raise-profile-resume.use-case';
import { SyncResumeSkillsUseCase } from './use-cases/sync-resume-skills.use-case';

@Module({
  imports: [AuthModule, SkillsRankingModule],
  controllers: [ResumeRaiseController, ResumeSkillsSyncController],
  providers: [
    ResumeRepository,
    ResumeActionRepository,
    MaintainResumesUseCase,
    RaiseProfileResumeUseCase,
    SyncResumeSkillsUseCase,
  ],
  exports: [
    MaintainResumesUseCase,
    RaiseProfileResumeUseCase,
    SyncResumeSkillsUseCase,
  ],
})
export class ResumesModule {}
