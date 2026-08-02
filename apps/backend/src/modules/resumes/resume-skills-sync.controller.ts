import { Body, Controller, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SyncResumeSkillsUseCase } from './use-cases/sync-resume-skills.use-case';

class SyncResumeSkillsDto {
  @IsString()
  @MaxLength(64)
  resumeExternalId!: string;

  @IsUUID()
  rankingRunId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  /** Legacy filter by profile label; omit to use merged pool. */
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  topN?: number;

  /** Substring match on skill unique (e.g. "angular" drops Angular + AngularJS). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Type(() => String)
  blacklist?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}

@Controller('resume-skills-sync')
export class ResumeSkillsSyncController {
  constructor(private readonly syncResumeSkills: SyncResumeSkillsUseCase) {}

  @Post()
  async sync(@Body() body: SyncResumeSkillsDto) {
    return this.syncResumeSkills.execute({
      resumeExternalId: body.resumeExternalId,
      rankingRunId: body.rankingRunId,
      query: body.query,
      topN: body.topN,
      blacklist: body.blacklist,
      correlationId: body.correlationId,
    });
  }
}
