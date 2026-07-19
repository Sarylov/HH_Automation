import type { ConfigService } from '@nestjs/config';
import type { VacancyAnalysis } from '../llm/llm.types';

/** Default true — preserves historical two-stage apply path. */
export function isVacancyAnalysisEnabled(config: ConfigService): boolean {
  const raw = config.get<string>('LLM_VACANCY_ANALYSIS_ENABLED', 'true');
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function skippedVacancyAnalysis(
  reason = 'LLM_VACANCY_ANALYSIS_ENABLED=false',
): VacancyAnalysis {
  return {
    version: 'v1',
    shouldApply: true,
    matchScore: 0,
    reasons: [reason],
    redFlags: [],
    requiredSkills: [],
    summary: 'Analysis skipped — cover letter uses vacancy description and profile only.',
  };
}
