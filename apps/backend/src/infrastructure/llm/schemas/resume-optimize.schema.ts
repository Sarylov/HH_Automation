export type ResumeOptimizeSuggestion = {
  version: 'v1';
  skillsToAdd: string[];
  skillsToRemove: string[];
  aboutHint: string | null;
  rationale: string[];
  shouldUpdate: boolean;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function parseResumeOptimizeSuggestion(
  value: unknown,
): ResumeOptimizeSuggestion {
  if (typeof value !== 'object' || value === null) {
    throw new Error('optimize suggestion must be an object');
  }

  const record = value as Record<string, unknown>;

  if (record.version !== 'v1') {
    throw new Error('optimize.version must be "v1"');
  }
  if (!isStringArray(record.skillsToAdd)) {
    throw new Error('optimize.skillsToAdd must be string[]');
  }
  if (!isStringArray(record.skillsToRemove)) {
    throw new Error('optimize.skillsToRemove must be string[]');
  }
  if (
    record.aboutHint !== null &&
    typeof record.aboutHint !== 'string'
  ) {
    throw new Error('optimize.aboutHint must be string or null');
  }
  if (!isStringArray(record.rationale)) {
    throw new Error('optimize.rationale must be string[]');
  }
  if (typeof record.shouldUpdate !== 'boolean') {
    throw new Error('optimize.shouldUpdate must be boolean');
  }

  return {
    version: 'v1',
    skillsToAdd: record.skillsToAdd.map((s) => s.trim()).filter(Boolean),
    skillsToRemove: record.skillsToRemove.map((s) => s.trim()).filter(Boolean),
    aboutHint:
      typeof record.aboutHint === 'string'
        ? record.aboutHint.trim() || null
        : null,
    rationale: record.rationale,
    shouldUpdate: record.shouldUpdate,
  };
}
