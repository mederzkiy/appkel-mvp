import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import {
  ClipboardList,
  Package,
  Settings,
  LogOut,
  Store,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: ClipboardList, label: 'Заказы' },
  { to: '/catalog', icon: Package, label: 'Каталог' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
] as const;

export default function Layout() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Боковое меню для планшетов и десктопов */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <p className="font-bold text-sm">Appkel</p>
            <p className="text-xs text-slate-400 truncate max-w-[160px]">
              {user?.email}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-sm'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Основная рабочая область */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Шапка для мобильных */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-base text-slate-900">Appkel</span>
          </div>
          <button
            onClick={signOut}
            className="text-slate-400 hover:text-slate-900 p-1 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Контент активной страницы */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Нижняя мобильная навигация */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 z-40 pb-safe">
          <div className="flex items-center justify-around">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-3 text-[10px] uppercase tracking-wider transition-colors ${
                    isActive ? 'text-slate-900 font-black' : 'text-slate-400 font-bold hover:text-slate-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`w-5 h-5 ${isActive ? 'text-slate-900' : ''}`}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* Контейнер всплывающих уведомлений (Toasts) */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 left-4 md:left-auto z-50 space-y-2 md:max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-sm font-bold ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : toast.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 flex-shrink-0 transition-opacity p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}