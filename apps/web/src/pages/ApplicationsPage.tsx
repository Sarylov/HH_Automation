import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { fetchApplications } from '../api/applications';
import { CoverLetterModal } from '../components/CoverLetterModal';
import { StatusBadge } from '../components/StatusBadge';
import {
  formatApplyReason,
  formatApplicationStatus,
  isApplyWarningReason,
} from '../lib/apply-labels';
import { formatDateTime, previewText } from '../lib/format';

const STATUS_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'APPLIED', label: formatApplicationStatus('APPLIED') },
  { value: 'FAILED', label: formatApplicationStatus('FAILED') },
  { value: 'NEEDS_MANUAL', label: formatApplicationStatus('NEEDS_MANUAL') },
  { value: 'STUB', label: formatApplicationStatus('STUB') },
] as const;

export function ApplicationsPage() {
  const [status, setStatus] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['applications', status],
    queryFn: () =>
      fetchApplications({
        status: status || undefined,
        limit: 50,
      }),
    refetchInterval: 15_000,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const openItem = items.find((a) => a.id === openId) ?? null;

  const toggleLetter = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <h1 className="text-base font-semibold">Отклики</h1>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Статус
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
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
        <p className="px-4 py-6 text-sm text-zinc-500">Откликов пока нет</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Когда</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Вакансия</th>
                <th className="px-4 py-2 font-medium">Компания</th>
                <th className="px-4 py-2 font-medium">Письмо</th>
                <th className="px-4 py-2 font-medium">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {items.map((app) => (
                <tr key={app.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2 align-top whitespace-nowrap text-zinc-600">
                    {formatDateTime(app.appliedAt ?? app.createdAt)}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <a
                      href={app.vacancy.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {app.vacancy.title}
                    </a>
                  </td>
                  <td className="px-4 py-2 align-top text-zinc-700">
                    {app.vacancy.company ?? '—'}
                  </td>
                  <td className="px-4 py-2 align-top">
                    {app.coverLetter ? (
                      <button
                        type="button"
                        className={`max-w-xs text-left text-sky-700 hover:underline ${
                          openId === app.id ? 'font-semibold' : ''
                        }`}
                        onClick={() => toggleLetter(app.id)}
                      >
                        {previewText(app.coverLetter)}
                      </button>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2 align-top ${
                      isApplyWarningReason(app.errorMessage)
                        ? 'text-amber-800'
                        : app.errorMessage
                          ? 'text-rose-800'
                          : 'text-zinc-400'
                    }`}
                    title={app.errorMessage ?? undefined}
                  >
                    {app.errorMessage
                      ? previewText(formatApplyReason(app.errorMessage), 100)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <CoverLetterModal
        open={Boolean(openItem?.coverLetter)}
        title={
          openItem
            ? `Письмо · ${openItem.vacancy.title}`
            : 'Сопроводительное письмо'
        }
        body={openItem?.coverLetter ?? ''}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}
