import { Global, Module } from '@nestjs/common';
import { LLM_PORT } from './llm.port';
import { OpenAiLlmAdapter } from './openai-llm.adapter';

@Global()
@Module({
  providers: [
    OpenAiLlmAdapter,
    {
      provide: LLM_PORT,
      useExisting: OpenAiLlmAdapter,
    },
  ],
  exports: [LLM_PORT, OpenAiLlmAdapter],
})
export class LlmModule {}
