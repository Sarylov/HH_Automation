import {
  addLocalDays,
  formatLocalYmd,
  localDayRange,
  parseLocalDayYmd,
  todayLocalYmd,
} from './local-day';

describe('local-day', () => {
  it('parses valid YMD', () => {
    const d = parseLocalDayYmd('2026-08-31');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(31);
  });

  it('rejects invalid calendar dates', () => {
    expect(parseLocalDayYmd('2026-02-30')).toBeNull();
    expect(parseLocalDayYmd('bad')).toBeNull();
  });

  it('builds local day range', () => {
    const range = localDayRange('2026-08-31');
    expect(range).not.toBeNull();
    expect(range?.start.getFullYear()).toBe(2026);
    expect(range?.start.getMonth()).toBe(7);
    expect(range?.start.getDate()).toBe(31);
    expect(range?.end.getDate()).toBe(1);
    expect(range?.end.getMonth()).toBe(8);
  });

  it('adds days in local calendar', () => {
    expect(addLocalDays('2026-08-31', -1)).toBe('2026-08-30');
    expect(addLocalDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('formats today as YMD', () => {
    const now = new Date();
    expect(todayLocalYmd()).toBe(formatLocalYmd(now));
  });
});
