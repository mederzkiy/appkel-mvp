import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { apiGet } from '../api/client';
import { Loader2, ShieldAlert } from 'lucide-react';

/**
 * Двухуровневая защита маршрутов админки:
 * 1. Проверяет наличие валидной сессии Supabase.
 * 2. Проверяет права суперадмина на бэкенде вызовом /api/admin/metrics (если 403 — блокирует доступ).
 */
export default function AdminProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Если еще идет первичная загрузка статуса - ждем
    if (loading) return;

    // Если пользователь не авторизован - выключаем проверку (ниже нас перекинет на /login)
    if (!session) {
      setChecking(false);
      return;
    }

    // Если сессия есть - идем стучаться на бэкенд
    apiGet('/api/admin/metrics')
      .then(() => {
        setAuthorized(true);
        setChecking(false);
      })
      .catch(() => {
        setAuthorized(false);
        setChecking(false);
      });
  }, [session, loading]);

  if (loading || checking) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
        <p className="text-xs text-slate-400">Проверка прав администратора...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Доступ запрещён</h1>
        <p className="text-xs text-slate-500 max-w-sm">
          Ваш аккаунт не обладает ролью суперадминистратора платформы Appkel.
        </p>
        <button onClick={signOut} className="btn-outline mt-2">
          Выйти из аккаунта
        </button>
      </div>
    );
  }

  return <Outlet />;
}