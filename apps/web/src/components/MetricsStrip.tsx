import { useQuery } from '@tanstack/react-query';
import { fetchApplicationSummary } from '../api/application-summary';
import { useOpsDate } from '../hooks/useOpsDate';
import { formatDayLabel } from '../lib/ops-date';

export function MetricsStrip() {
  const { date } = useOpsDate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['application-summary', date],
    queryFn: () => fetchApplicationSummary({ date }),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
        Загрузка статистики…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Статистика недоступна:{' '}
        {error instanceof Error ? error.message : 'error'}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <h2 className="mb-3 text-sm font-medium text-zinc-700">
        Статистика · {formatDayLabel(date)}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Всего" value={data.total} />
        <StatCard
          label="Успешно"
          value={data.succeeded}
          valueClassName="text-emerald-700"
        />
        <StatCard
          label="Ошибки"
          value={data.failed}
          valueClassName="text-rose-700"
        />
        <StatCard
          label="Предупреждения"
          value={data.warnings}
          valueClassName="text-amber-700"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  valueClassName = 'text-zinc-900',
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}
