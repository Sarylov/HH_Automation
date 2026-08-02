import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsRankingController } from './skills-ranking.controller';
import { SkillsRankingRunRepository } from './repositories/skills-ranking-run.repository';
import { RankSkillsUseCase } from './use-cases/rank-skills.use-case';

@Module({
  imports: [AuthModule],
  controllers: [SkillsRankingController],
  providers: [SkillsRankingRunRepository, RankSkillsUseCase],
  exports: [RankSkillsUseCase, SkillsRankingRunRepository],
})
export class SkillsRankingModule {}
