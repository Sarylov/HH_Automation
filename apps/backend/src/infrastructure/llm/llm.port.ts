import type { LlmCompleteInput, LlmCompleteResult } from './llm.types';

export const LLM_PORT = Symbol('LLM_PORT');

export interface LlmPort {
  isConfigured(): boolean;
  completeJson<T>(input: LlmCompleteInput): Promise<LlmCompleteResult<T>>;
}
