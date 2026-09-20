import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import OrdersPage from './pages/Orders';
import CatalogPage from './pages/Catalog';
import MarketingPage from './pages/Marketing';
import SettingsPage from './pages/Settings';
import { apiGet } from './api/client';
import { Loader2, ShieldX } from 'lucide-react';

type AppState = 'loading' | 'ready' | 'no_store' | 'error';

export default function App() {
  const [state, setState] = useState<AppState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Расширяем TMA на всю высоту экрана
    try {
      window.Telegram?.WebApp?.expand?.();
      window.Telegram?.WebApp?.ready?.();
    } catch { /* noop */ }

    const checkStore = async () => {
      try {
        await apiGet('/api/seller/store');
        setState('ready');
      } catch (err: any) {
        if (err.status === 401 || err.status === 403) {
          setState('no_store');
          setErrorMsg(err.message || 'Магазин не привязан');
        } else {
          setState('error');
          setErrorMsg(err.message || 'Ошибка загрузки');
        }
      }
    };

    checkStore();
    return undefined;
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Загрузка панели продавца...</p>
        </div>
      </div>
    );
  }

  if (state === 'no_store') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            Магазин не привязан
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Ваш Telegram-аккаунт не привязан ни к одному магазину.
            Пройдите регистрацию через бот — администратор вышлет вам ссылку для привязки.
          </p>
          <div className="bg-slate-100 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-1">Техническая информация:</p>
            <p className="text-xs text-slate-500 font-mono">{errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Ошибка</h1>
          <p className="text-sm text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}