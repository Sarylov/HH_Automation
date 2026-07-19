import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchApplyJobs } from '../api/apply-jobs';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime } from '../lib/format';

const STATUS_FILTERS = ['', 'PENDING', 'RUNNING', 'DONE', 'FAILED'] as const;

export function QueuePage() {
  const [status, setStatus] = useState<string>('');
  const query = useQuery({
    queryKey: ['apply-jobs', status],
    queryFn: () =>
      fetchApplyJobs({
        status: status || undefined,
        limit: 50,
      }),
    refetchInterval: 10_000,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <h1 className="text-base font-semibold">Очередь ApplyJob</h1>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Статус
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'Все'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Загрузка…</p>
      ) : null}

      {query.isError ? (
        <p className="px-4 py-6 text-sm text-rose-700">
          {query.error instanceof Error ? query.error.message : 'Ошибка загрузки'}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Очередь пуста</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Вакансия</th>
                <th className="px-4 py-2 font-medium">Компания</th>
                <th className="px-4 py-2 font-medium">В очереди</th>
                <th className="px-4 py-2 font-medium">Попытки</th>
                <th className="px-4 py-2 font-medium">Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {items.map((job) => (
                <tr key={job.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2 align-top">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <a
                      href={job.vacancy.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {job.vacancy.title}
                    </a>
                  </td>
                  <td className="px-4 py-2 align-top text-zinc-700">
                    {job.vacancy.company ?? '—'}
                  </td>
                  <td className="px-4 py-2 align-top whitespace-nowrap text-zinc-600">
                    {formatDateTime(job.queuedAt)}
                  </td>
                  <td className="px-4 py-2 align-top text-zinc-700">{job.attempts}</td>
                  <td className="max-w-xs px-4 py-2 align-top text-zinc-600">
                    {job.lastError ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
