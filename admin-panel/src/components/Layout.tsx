import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import {
  LayoutDashboard,
  Store,
  Package,
  LogOut,
  Shield,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stores', icon: Store, label: 'Магазины' },
  { to: '/catalog', icon: Package, label: 'Глобальный каталог' },
] as const;

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Левый постоянный сайдбар */}
      <aside className="w-60 flex flex-col bg-white border-r border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-100">
          <Shield className="w-6 h-6 text-admin" />
          <span className="font-bold text-slate-900 text-sm">Appkel Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-admin-50 text-admin-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400 truncate px-3 mb-2 font-mono">
            {user?.email}
          </p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Основная рабочая область */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Тосты */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold ${
                t.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : t.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {t.type === 'info' && <Info className="w-4 h-4 flex-shrink-0" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => removeToast(t.id)} className="opacity-60 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}