import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Vacancy } from '@prisma/client';
import { LlmSchemaError } from '../../../infrastructure/llm/llm.errors';
import { LLM_PORT, type LlmPort } from '../../../infrastructure/llm/llm.port';
import type { VacancyAnalysis } from '../../../infrastructure/llm/llm.types';
import {
  VACANCY_ANALYSIS_PROMPT_VERSION,
  VACANCY_ANALYSIS_SCHEMA_HINT,
  VACANCY_ANALYSIS_SYSTEM,
  buildVacancyAnalysisUserPrompt,
} from '../../../infrastructure/llm/prompts/vacancy-analysis.v1';
import { parseVacancyAnalysis } from '../../../infrastructure/llm/schemas/vacancy-analysis.schema';
import type { PlaywrightOpenVacancyResult } from '../../../infrastructure/playwright/playwright.client';

@Injectable()
export class AnalyzeVacancyUseCase {
  private readonly logger = new Logger(AnalyzeVacancyUseCase.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: {
    vacancy: Vacancy;
    opened: PlaywrightOpenVacancyResult;
  }): Promise<VacancyAnalysis> {
    this.logger.log({
      msg: 'Analyzing vacancy',
      vacancyId: input.vacancy.id,
      externalId: input.vacancy.externalId,
    });

    const user = buildVacancyAnalysisUserPrompt({
      title: input.opened.title ?? input.vacancy.title,
      company: input.opened.company ?? input.vacancy.company ?? undefined,
      salary: input.vacancy.salary ?? undefined,
      snippet: input.vacancy.snippet ?? undefined,
      description: input.opened.descriptionSnippet,
      searchText: this.config.get<string>('HH_SEARCH_TEXT'),
      excludedText: this.config.get<string>('HH_EXCLUDED_TEXT'),
      applicantProfile: this.config.get<string>('APPLICANT_PROFILE'),
    });

    const result = await this.llm.completeJson<unknown>({
      promptVersion: VACANCY_ANALYSIS_PROMPT_VERSION,
      system: VACANCY_ANALYSIS_SYSTEM,
      user,
      schemaHint: VACANCY_ANALYSIS_SCHEMA_HINT,
    });

    try {
      const analysis = parseVacancyAnalysis(result.data);
      this.logger.log({
        msg: 'Vacancy analyzed',
        vacancyId: input.vacancy.id,
        shouldApply: analysis.shouldApply,
        matchScore: analysis.matchScore,
        promptVersion: result.promptVersion,
      });
      return analysis;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'invalid_analysis_schema';
      throw new LlmSchemaError(message, VACANCY_ANALYSIS_PROMPT_VERSION);
    }
  }
}
