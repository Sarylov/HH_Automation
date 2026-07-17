export type ChatReplyResult = {
  version: 'v1';
  reply: string;
  shouldReply: boolean;
  notes: string[];
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function parseChatReplyResult(value: unknown): ChatReplyResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('chat_reply must be an object');
  }

  const record = value as Record<string, unknown>;

  if (record.version !== 'v1') {
    throw new Error('chat_reply.version must be "v1"');
  }
  if (typeof record.shouldReply !== 'boolean') {
    throw new Error('chat_reply.shouldReply must be boolean');
  }
  if (typeof record.reply !== 'string') {
    throw new Error('chat_reply.reply must be string');
  }
  if (!isStringArray(record.notes)) {
    throw new Error('chat_reply.notes must be string[]');
  }

  return {
    version: 'v1',
    reply: record.reply.trim(),
    shouldReply: record.shouldReply,
    notes: record.notes,
  };
}
