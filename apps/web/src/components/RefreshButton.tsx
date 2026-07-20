import { useIsFetching, useQueryClient } from '@tanstack/react-query';

export function RefreshButton() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;

  return (
    <button
      type="button"
      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isFetching}
      onClick={() => {
        void queryClient.refetchQueries();
      }}
    >
      {isFetching ? 'Обновление…' : 'Обновить'}
    </button>
  );
}
