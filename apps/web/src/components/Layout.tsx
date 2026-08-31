import { NavLink, Outlet } from 'react-router-dom';
import { DayNavigator } from './DayNavigator';
import { MetricsStrip } from './MetricsStrip';
import { RefreshButton } from './RefreshButton';
import { useOpsDate } from '../hooks/useOpsDate';
import { opsPathWithDate } from '../lib/ops-date';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-zinc-900 text-white'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
  }`;

export function Layout() {
  const { date, setDate } = useOpsDate();
  const queuePath = opsPathWithDate('/queue', date);
  const applicationsPath = opsPathWithDate('/applications', date);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="text-lg font-semibold tracking-tight">HH Automation</div>
            <div className="text-xs text-zinc-500">Ops UI · read-only</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton />
            <nav className="flex gap-2">
              <NavLink to={queuePath} className={linkClass}>
                Очередь
              </NavLink>
              <NavLink to={applicationsPath} className={linkClass}>
                Отклики
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <MetricsStrip />
        <DayNavigator date={date} onChange={setDate} />
        <Outlet />
      </main>
    </div>
  );
}
