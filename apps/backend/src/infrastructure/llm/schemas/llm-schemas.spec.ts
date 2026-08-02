import { parseCoverLetterResult } from './cover-letter.schema';
import { parseVacancyAnalysis } from './vacancy-analysis.schema';
import { parseChatReplyResult } from './chat-reply.schema';

describe('vacancy-analysis schema', () => {
  it('parses valid analysis', () => {
    const result = parseVacancyAnalysis({
      version: 'v1',
      shouldApply: true,
      matchScore: 82,
      reasons: ['React experience'],
      redFlags: [],
      requiredSkills: ['TypeScript'],
      summary: 'Good frontend fit',
    });

    expect(result.shouldApply).toBe(true);
    expect(result.matchScore).toBe(82);
  });

  it('rejects invalid matchScore', () => {
    expect(() =>
      parseVacancyAnalysis({
        version: 'v1',
        shouldApply: true,
        matchScore: 120,
        reasons: [],
        redFlags: [],
        requiredSkills: [],
        summary: 'x',
      }),
    ).toThrow();
  });
});

describe('cover-letter schema', () => {
  it('parses valid letter', () => {
    const result = parseCoverLetterResult({
      version: 'v1',
      letter: 'Здравствуйте!',
      highlights: ['React'],
      wordCount: 42,
    });

    expect(result.letter).toBe('Здравствуйте!');
    expect(result.wordCount).toBe(42);
  });

  it('rejects empty letter', () => {
    expect(() =>
      parseCoverLetterResult({
        version: 'v1',
        letter: '   ',
        highlights: [],
        wordCount: 0,
      }),
    ).toThrow();
  });
});

describe('chat-reply schema', () => {
  it('parses valid reply', () => {
    const result = parseChatReplyResult({
      version: 'v1',
      reply: 'Здравствуйте!',
      shouldReply: true,
      notes: [],
    });
    expect(result.reply).toBe('Здравствуйте!');
  });
});
