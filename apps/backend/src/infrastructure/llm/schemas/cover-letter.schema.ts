import type { CoverLetterResult } from '../llm.types';

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function parseCoverLetterResult(value: unknown): CoverLetterResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('cover_letter must be an object');
  }

  const record = value as Record<string, unknown>;

  if (record.version !== 'v1') {
    throw new Error('cover_letter.version must be "v1"');
  }
  if (typeof record.letter !== 'string' || record.letter.trim() === '') {
    throw new Error('cover_letter.letter must be a non-empty string');
  }
  if (!isStringArray(record.highlights)) {
    throw new Error('cover_letter.highlights must be string[]');
  }
  if (typeof record.wordCount !== 'number' || record.wordCount < 1) {
    throw new Error('cover_letter.wordCount must be a positive number');
  }

  return {
    version: 'v1',
    letter: record.letter.trim(),
    highlights: record.highlights,
    wordCount: record.wordCount,
  };
}
