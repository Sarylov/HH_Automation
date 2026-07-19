import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WorkingHoursDecision = {
  allowed: boolean;
  reason?: string;
  nowLocal?: string;
  window?: string;
};

/**
 * Gates automation to configured local working hours (TZ from env / process).
 */
@Injectable()
export class WorkingHoursPolicy {
  constructor(private readonly config: ConfigService) {}

  evaluate(now: Date = new Date()): WorkingHoursDecision {
    if (!this.enabled()) {
      return { allowed: true, reason: 'working_hours_disabled' };
    }

    const timeZone = this.config.get<string>('TZ', 'Europe/Moscow');
    const start = this.parseHm(
      this.config.get<string>('WORKING_HOURS_START', '09:00'),
      9,
      0,
    );
    const end = this.parseHm(
      this.config.get<string>('WORKING_HOURS_END', '19:00'),
      19,
      0,
    );
    const days = this.parseDays(
      this.config.get<string>('WORKING_DAYS', '1-7'),
    );

    const parts = this.localParts(now, timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    const startMin = start.hour * 60 + start.minute;
    const endMin = end.hour * 60 + end.minute;
    const inDay = days.has(parts.weekday);
    const inTime =
      startMin <= endMin
        ? minutes >= startMin && minutes < endMin
        : minutes >= startMin || minutes < endMin;

    const window = `${this.config.get('WORKING_DAYS', '1-5')} ${this.config.get('WORKING_HOURS_START', '09:00')}-${this.config.get('WORKING_HOURS_END', '19:00')} ${timeZone}`;
    const nowLocal = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;

    if (!inDay) {
      return {
        allowed: false,
        reason: 'outside_working_days',
        nowLocal,
        window,
      };
    }
    if (!inTime) {
      return {
        allowed: false,
        reason: 'outside_working_hours',
        nowLocal,
        window,
      };
    }

    return { allowed: true, nowLocal, window };
  }

  private enabled(): boolean {
    const raw = this.config.get<string>('WORKING_HOURS_ENABLED', 'true');
    return raw === '1' || raw.toLowerCase() === 'true';
  }

  private parseHm(
    raw: string,
    fallbackH: number,
    fallbackM: number,
  ): { hour: number; minute: number } {
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!match) return { hour: fallbackH, minute: fallbackM };
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return { hour: fallbackH, minute: fallbackM };
    }
    return { hour, minute };
  }

  /** ISO weekday: 1=Mon … 7=Sun */
  private parseDays(raw: string): Set<number> {
    const days = new Set<number>();
    for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
      const range = /^(\d)-(\d)$/.exec(part);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        for (let d = Math.min(a, b); d <= Math.max(a, b); d += 1) {
          if (d >= 1 && d <= 7) days.add(d);
        }
        continue;
      }
      const n = Number(part);
      if (n >= 1 && n <= 7) days.add(n);
    }
    return days.size > 0 ? days : new Set([1, 2, 3, 4, 5]);
  }

  private localParts(
    date: Date,
    timeZone: string,
  ): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    weekday: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    const map = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value]),
    );
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      weekday: weekdayMap[map.weekday ?? 'Mon'] ?? 1,
    };
  }
}
