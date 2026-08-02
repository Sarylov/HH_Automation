import { Body, Controller, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  RankSkillsUseCase,
  type SkillsRankingProfileInput,
} from './use-cases/rank-skills.use-case';

class SkillsRankingProfileDto implements SkillsRankingProfileInput {
  @IsString()
  @MaxLength(128)
  label!: string;

  @IsString()
  @MaxLength(200)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  excludedText?: string;

  @IsOptional()
  @IsIn(['REMOTE'])
  workFormat?: 'REMOTE';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  searchPeriod?: number;

  @IsOptional()
  @IsIn(['name', 'company_name', 'description'])
  searchField?: 'name' | 'company_name' | 'description';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itemsOnPage?: number;
}

class RankSkillsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkillsRankingProfileDto)
  profiles!: SkillsRankingProfileDto[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}

@Controller('skills-ranking')
export class SkillsRankingController {
  constructor(private readonly rankSkills: RankSkillsUseCase) {}

  @Post()
  async rank(@Body() body: RankSkillsDto) {
    return this.rankSkills.execute({
      profiles: body.profiles,
      correlationId: body.correlationId,
    });
  }
}
