import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Loader2 } from 'lucide-react';

export default function AdminProtectedRoute() {
  const { user, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Админка требует ТОЛЬКО логин по email и паролю.
  // Никаких проверок Telegram WebApp!
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}