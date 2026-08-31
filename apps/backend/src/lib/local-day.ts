const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayLocalYmd(): string {
  return formatLocalYmd(new Date());
}

export function parseLocalDayYmd(ymd: string): Date | null {
  const match = YMD_RE.exec(ymd);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function localDayRange(ymd: string): { start: Date; end: Date } | null {
  const start = parseLocalDayYmd(ymd);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function addLocalDays(ymd: string, delta: number): string | null {
  const date = parseLocalDayYmd(ymd);
  if (!date) return null;
  date.setDate(date.getDate() + delta);
  return formatLocalYmd(date);
}

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
