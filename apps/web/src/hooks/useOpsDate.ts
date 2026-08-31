import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clampOpsDate, todayLocalYmd } from '../lib/ops-date';

export function useOpsDate(): { date: string; setDate: (ymd: string) => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = useMemo(
    () => clampOpsDate(searchParams.get('date')),
    [searchParams],
  );

  const setDate = useCallback(
    (ymd: string) => {
      const nextDate = clampOpsDate(ymd);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextDate === todayLocalYmd()) {
            next.delete('date');
          } else {
            next.set('date', nextDate);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { date, setDate };
}
