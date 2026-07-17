import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Vacancy } from '@prisma/client';
import { LlmSchemaError } from '../../../infrastructure/llm/llm.errors';
import { LLM_PORT, type LlmPort } from '../../../infrastructure/llm/llm.port';
import type {
  CoverLetterResult,
  VacancyAnalysis,
} from '../../../infrastructure/llm/llm.types';
import {
  COVER_LETTER_PROMPT_VERSION,
  COVER_LETTER_SCHEMA_HINT,
  COVER_LETTER_SYSTEM,
  buildCoverLetterUserPrompt,
} from '../../../infrastructure/llm/prompts/cover-letter.v1';
import { parseCoverLetterResult } from '../../../infrastructure/llm/schemas/cover-letter.schema';
import type { PlaywrightOpenVacancyResult } from '../../../infrastructure/playwright/playwright.client';

@Injectable()
export class GenerateCoverLetterUseCase {
  private readonly logger = new Logger(GenerateCoverLetterUseCase.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: {
    vacancy: Vacancy;
    opened: PlaywrightOpenVacancyResult;
    analysis: VacancyAnalysis;
  }): Promise<CoverLetterResult> {
    this.logger.log({
      msg: 'Generating cover letter',
      vacancyId: input.vacancy.id,
      externalId: input.vacancy.externalId,
    });

    const user = buildCoverLetterUserPrompt({
      title: input.opened.title ?? input.vacancy.title,
      company: input.opened.company ?? input.vacancy.company ?? undefined,
      description: input.opened.descriptionSnippet,
      analysisSummary: input.analysis.summary,
      matchScore: input.analysis.matchScore,
      applicantProfile: this.config.get<string>('APPLICANT_PROFILE'),
    });

    const result = await this.llm.completeJson<unknown>({
      promptVersion: COVER_LETTER_PROMPT_VERSION,
      system: COVER_LETTER_SYSTEM,
      user,
      schemaHint: COVER_LETTER_SCHEMA_HINT,
    });

    try {
      const letter = parseCoverLetterResult(result.data);
      this.logger.log({
        msg: 'Cover letter generated',
        vacancyId: input.vacancy.id,
        wordCount: letter.wordCount,
        promptVersion: result.promptVersion,
      });
      return letter;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'invalid_cover_letter_schema';
      throw new LlmSchemaError(message, COVER_LETTER_PROMPT_VERSION);
    }
  }
}
