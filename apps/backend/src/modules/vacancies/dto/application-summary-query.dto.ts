import { IsOptional, IsString, Matches } from 'class-validator';

export class ApplicationSummaryQueryDto {
  /** Local calendar day (YYYY-MM-DD). Defaults to today when omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
