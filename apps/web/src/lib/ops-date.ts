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

export function addLocalDays(ymd: string, delta: number): string | null {
  const date = parseLocalDayYmd(ymd);
  if (!date) return null;
  date.setDate(date.getDate() + delta);
  return formatLocalYmd(date);
}

export function clampOpsDate(raw: string | null | undefined): string {
  const today = todayLocalYmd();
  const candidate = raw && parseLocalDayYmd(raw) ? raw : today;
  return candidate > today ? today : candidate;
}

export function opsPathWithDate(path: string, ymd: string): string {
  if (ymd === todayLocalYmd()) return path;
  return `${path}?date=${encodeURIComponent(ymd)}`;
}

export function formatDayLabel(ymd: string): string {
  const date = parseLocalDayYmd(ymd);
  if (!date) return ymd;
  const today = todayLocalYmd();
  if (ymd === today) return 'Сегодня';
  const yesterday = addLocalDays(today, -1);
  if (ymd === yesterday) return 'Вчера';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
