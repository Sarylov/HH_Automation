import { NavLink, Outlet } from 'react-router-dom';
import { MetricsStrip } from './MetricsStrip';
import { RefreshButton } from './RefreshButton';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-zinc-900 text-white'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
  }`;

export function Layout() {
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
              <NavLink to="/queue" className={linkClass}>
                Очередь
              </NavLink>
              <NavLink to="/applications" className={linkClass}>
                Отклики
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <MetricsStrip />
        <Outlet />
      </main>
    </div>
  );
}
