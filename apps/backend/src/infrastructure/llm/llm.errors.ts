export class LlmConfigurationError extends Error {
  constructor(message = 'LLM is not configured') {
    super(message);
    this.name = 'LlmConfigurationError';
  }
}

export class LlmSchemaError extends Error {
  constructor(
    message: string,
    public readonly promptVersion: string,
  ) {
    super(message);
    this.name = 'LlmSchemaError';
  }
}

export class LlmRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmRequestError';
  }
}
