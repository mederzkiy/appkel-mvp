import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import {
  ClipboardList,
  Package,
  Megaphone,
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
  { to: '/marketing', icon: Megaphone, label: 'Рассылка' },
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
      <aside className="hidden md:flex md:flex-col md:w-64 bg-brand-dark text-white">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-brand-dark" />
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
                    ? 'bg-brand text-brand-dark font-bold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
            <div className="w-7 h-7 bg-brand-dark rounded-lg flex items-center justify-center">
              <Store className="w-4 h-4 text-brand" />
            </div>
            <span className="font-bold text-sm text-slate-900">Appkel</span>
          </div>
          <button
            onClick={signOut}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Контент активной страницы */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Нижняя мобильная навигация */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2">
          <div className="flex items-center justify-around">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                    isActive ? 'text-brand-dark font-bold' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`w-5 h-5 ${isActive ? 'text-brand-600' : ''}`}
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
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
                toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
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
                className="opacity-60 hover:opacity-100 flex-shrink-0"
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