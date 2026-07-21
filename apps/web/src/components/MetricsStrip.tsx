import { useQuery } from '@tanstack/react-query';
import { fetchMetrics } from '../api/metrics';

export function MetricsStrip() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: fetchMetrics,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
        Загрузка метрик…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Метрики недоступны: {error instanceof Error ? error.message : 'error'}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric
        label="Очередь"
        value={`P ${data.queue.pending} · R ${data.queue.running} · F ${data.queue.failed}`}
      />
      <Metric
        label="Отклики сегодня"
        value={`OK ${data.applies.succeededToday} · fail ${data.applies.failedToday} · manual ${data.applies.needsManualToday}`}
      />
      <Metric
        label="Сессия"
        value={`${data.session.status}${data.session.stale ? ' (stale)' : ''}`}
      />
      <Metric
        label="Rate limit"
        value={`${data.rateLimit.hourCount}/${data.rateLimit.hourLimit} ч · ${data.rateLimit.dayCount}/${data.rateLimit.dayLimit} д`}
      />
      {data.alerts.length > 0 ? (
        <div className="sm:col-span-2 lg:col-span-4 text-sm text-amber-800">
          Alerts: {data.alerts.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-zinc-900">{value}</div>
    </div>
  );
}
