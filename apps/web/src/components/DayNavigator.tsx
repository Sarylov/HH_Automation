import {
  addLocalDays,
  formatDayLabel,
  todayLocalYmd,
} from '../lib/ops-date';

type DayNavigatorProps = {
  date: string;
  onChange: (ymd: string) => void;
};

export function DayNavigator({ date, onChange }: DayNavigatorProps) {
  const today = todayLocalYmd();
  const canGoNext = date < today;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
      <span className="text-zinc-500">День:</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
          aria-label="Предыдущий день"
          onClick={() => {
            const prev = addLocalDays(date, -1);
            if (prev) onChange(prev);
          }}
        >
          ←
        </button>
        <input
          type="date"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
          value={date}
          max={today}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Следующий день"
          disabled={!canGoNext}
          onClick={() => {
            const next = addLocalDays(date, 1);
            if (next) onChange(next);
          }}
        >
          →
        </button>
      </div>
      <span className="font-medium text-zinc-800">{formatDayLabel(date)}</span>
      {date !== today ? (
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
          onClick={() => onChange(today)}
        >
          Сегодня
        </button>
      ) : null}
    </div>
  );
}
