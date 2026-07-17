export type LlmCompleteInput = {
  promptVersion: string;
  system: string;
  user: string;
  schemaHint: string;
};

export type LlmUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LlmCompleteResult<T> = {
  data: T;
  promptVersion: string;
  usage?: LlmUsage;
  model: string;
};

export type VacancyAnalysis = {
  version: 'v1';
  shouldApply: boolean;
  matchScore: number;
  reasons: string[];
  redFlags: string[];
  requiredSkills: string[];
  summary: string;
};

export type CoverLetterResult = {
  version: 'v1';
  letter: string;
  highlights: string[];
  wordCount: number;
};
