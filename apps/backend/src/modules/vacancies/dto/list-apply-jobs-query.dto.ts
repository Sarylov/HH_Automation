import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplyJobStatus } from '@prisma/client';

export class ListApplyJobsQueryDto {
  @IsOptional()
  @IsEnum(ApplyJobStatus)
  status?: ApplyJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  /** Local calendar day (YYYY-MM-DD). Defaults to today when omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
