import { ConfigService } from '@nestjs/config';
import {
  isVacancyAnalysisEnabled,
  skippedVacancyAnalysis,
} from './vacancy-analysis';

describe('vacancy-analysis config', () => {
  it('defaults to enabled', () => {
    const config = {
      get: (_key: string, fallback?: string) => fallback,
    } as ConfigService;
    expect(isVacancyAnalysisEnabled(config)).toBe(true);
  });

  it('parses false', () => {
    const config = {
      get: () => 'false',
    } as unknown as ConfigService;
    expect(isVacancyAnalysisEnabled(config)).toBe(false);
  });

  it('builds skipped stub', () => {
    const stub = skippedVacancyAnalysis();
    expect(stub.version).toBe('v1');
    expect(stub.shouldApply).toBe(true);
    expect(stub.matchScore).toBe(0);
    expect(stub.summary.length).toBeGreaterThan(0);
  });
});
