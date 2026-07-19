const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  RUNNING: 'bg-sky-100 text-sky-900',
  DONE: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-rose-100 text-rose-900',
  STUB: 'bg-zinc-100 text-zinc-700',
  APPLIED: 'bg-emerald-100 text-emerald-900',
  NEEDS_MANUAL: 'bg-orange-100 text-orange-900',
};

type Props = {
  status: string;
};

export function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-700';
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
