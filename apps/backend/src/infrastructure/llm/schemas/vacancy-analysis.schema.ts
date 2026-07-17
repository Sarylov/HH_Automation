import type { VacancyAnalysis } from '../llm.types';

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function parseVacancyAnalysis(value: unknown): VacancyAnalysis {
  if (typeof value !== 'object' || value === null) {
    throw new Error('analysis must be an object');
  }

  const record = value as Record<string, unknown>;

  if (record.version !== 'v1') {
    throw new Error('analysis.version must be "v1"');
  }
  if (typeof record.shouldApply !== 'boolean') {
    throw new Error('analysis.shouldApply must be boolean');
  }
  if (
    typeof record.matchScore !== 'number' ||
    record.matchScore < 0 ||
    record.matchScore > 100
  ) {
    throw new Error('analysis.matchScore must be a number between 0 and 100');
  }
  if (!isStringArray(record.reasons)) {
    throw new Error('analysis.reasons must be string[]');
  }
  if (!isStringArray(record.redFlags)) {
    throw new Error('analysis.redFlags must be string[]');
  }
  if (!isStringArray(record.requiredSkills)) {
    throw new Error('analysis.requiredSkills must be string[]');
  }
  if (typeof record.summary !== 'string' || record.summary.trim() === '') {
    throw new Error('analysis.summary must be a non-empty string');
  }

  return {
    version: 'v1',
    shouldApply: record.shouldApply,
    matchScore: record.matchScore,
    reasons: record.reasons,
    redFlags: record.redFlags,
    requiredSkills: record.requiredSkills,
    summary: record.summary.trim(),
  };
}
