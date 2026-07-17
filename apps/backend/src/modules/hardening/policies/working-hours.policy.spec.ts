import { WorkingHoursPolicy } from './working-hours.policy';
import { ConfigService } from '@nestjs/config';

function mockConfig(values: Record<string, string>): ConfigService {
  return {
    get: <T = string>(key: string, defaultValue?: T) =>
      (values[key] ?? defaultValue) as T,
  } as ConfigService;
}

describe('WorkingHoursPolicy', () => {
  it('allows when disabled', () => {
    const policy = new WorkingHoursPolicy(
      mockConfig({ WORKING_HOURS_ENABLED: 'false' }),
    );
    expect(policy.evaluate().allowed).toBe(true);
  });

  it('rejects weekend when working days are Mon-Fri', () => {
    const policy = new WorkingHoursPolicy(
      mockConfig({
        WORKING_HOURS_ENABLED: 'true',
        WORKING_DAYS: '1-5',
        WORKING_HOURS_START: '00:00',
        WORKING_HOURS_END: '23:59',
        TZ: 'UTC',
      }),
    );
    // 2026-07-18 is Saturday
    const result = policy.evaluate(new Date('2026-07-18T12:00:00Z'));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_working_days');
  });

  it('rejects outside hours on a weekday', () => {
    const policy = new WorkingHoursPolicy(
      mockConfig({
        WORKING_HOURS_ENABLED: 'true',
        WORKING_DAYS: '1-5',
        WORKING_HOURS_START: '09:00',
        WORKING_HOURS_END: '19:00',
        TZ: 'UTC',
      }),
    );
    // 2026-07-16 is Thursday
    const result = policy.evaluate(new Date('2026-07-16T05:00:00Z'));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_working_hours');
  });

  it('allows inside weekday window', () => {
    const policy = new WorkingHoursPolicy(
      mockConfig({
        WORKING_HOURS_ENABLED: 'true',
        WORKING_DAYS: '1-5',
        WORKING_HOURS_START: '09:00',
        WORKING_HOURS_END: '19:00',
        TZ: 'UTC',
      }),
    );
    const result = policy.evaluate(new Date('2026-07-16T12:00:00Z'));
    expect(result.allowed).toBe(true);
  });
});
