import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmConfigurationError,
  LlmRequestError,
  LlmSchemaError,
} from './llm.errors';
import type { LlmPort } from './llm.port';
import type { LlmCompleteInput, LlmCompleteResult } from './llm.types';

type OpenAiChatResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

@Injectable()
export class OpenAiLlmAdapter implements LlmPort {
  private readonly logger = new Logger(OpenAiLlmAdapter.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const apiKey = this.config.get<string>('LLM_API_KEY', '').trim();
    const baseUrl = this.config.get<string>('LLM_BASE_URL', '').trim();
    const model = this.config.get<string>('LLM_MODEL', '').trim();
    return Boolean(apiKey && baseUrl && model);
  }

  async completeJson<T>(input: LlmCompleteInput): Promise<LlmCompleteResult<T>> {
    if (!this.isConfigured()) {
      throw new LlmConfigurationError();
    }

    const apiKey = this.config.get<string>('LLM_API_KEY', '').trim();
    const baseUrl = this.config
      .get<string>('LLM_BASE_URL', '')
      .trim()
      .replace(/\/$/, '');
    const model = this.config.get<string>('LLM_MODEL', '').trim();
    const temperature = Number(
      this.config.get<string>('LLM_TEMPERATURE', '0.2'),
    );

    const userContent = `${input.user}\n\nJSON schema:\n${input.schemaHint}`;

    const maxAttempts = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: userContent },
            ],
          }),
          signal: AbortSignal.timeout(90_000),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          if (res.status === 429 && attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw new LlmRequestError(
            `LLM HTTP ${res.status}: ${body.slice(0, 200)}`,
            res.status,
          );
        }

        const body = (await res.json()) as OpenAiChatResponse;
        const content = body.choices?.[0]?.message?.content;
        if (!content?.trim()) {
          throw new LlmRequestError('LLM returned empty content');
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content) as unknown;
        } catch {
          throw new LlmSchemaError(
            'LLM response is not valid JSON',
            input.promptVersion,
          );
        }

        this.logger.log({
          msg: 'LLM completion',
          promptVersion: input.promptVersion,
          model,
          usage: body.usage,
          attempt,
        });

        return {
          data: parsed as T,
          promptVersion: input.promptVersion,
          model,
          usage: body.usage
            ? {
                promptTokens: body.usage.prompt_tokens,
                completionTokens: body.usage.completion_tokens,
                totalTokens: body.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (
          error instanceof LlmRequestError &&
          error.status === 429 &&
          attempt < maxAttempts
        ) {
          await this.backoff(attempt);
          continue;
        }
        if (attempt < maxAttempts && !(error instanceof LlmSchemaError)) {
          await this.backoff(attempt);
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new LlmRequestError('LLM request failed');
  }

  private async backoff(attempt: number): Promise<void> {
    const ms = 1_000 * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
