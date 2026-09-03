import { Body, Controller, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  RaiseProfileResumeResponse,
  RaiseProfileResumeUseCase,
} from './use-cases/raise-profile-resume.use-case';

class RaiseProfileResumeDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}

@Controller('resumes')
export class ResumeRaiseController {
  constructor(private readonly raiseProfileResume: RaiseProfileResumeUseCase) {}

  @Post('raise')
  async raise(
    @Body() body: RaiseProfileResumeDto,
  ): Promise<RaiseProfileResumeResponse> {
    return this.raiseProfileResume.execute({
      dryRun: body.dryRun,
      correlationId: body.correlationId,
    });
  }
}
