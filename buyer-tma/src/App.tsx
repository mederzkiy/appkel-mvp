import { useEffect, useState } from 'react';
import { api } from './api/client';
import { useAppStore } from './store/app';
import CatalogView from './views/CatalogView';
import CartView from './views/CartView';
import CheckoutView from './views/CheckoutView';
import PaymentView from './views/PaymentView';
import OrderStatusView from './views/OrderStatusView';
import { Loader2, AlertTriangle } from 'lucide-react';

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export default function App() {
  const currentView = useAppStore((s) => s.currentView);
  const storeId = useAppStore((s) => s.storeId);
  const setStoreId = useAppStore((s) => s.setStoreId);
  const setStoreInfo = useAppStore((s) => s.setStoreInfo);
  const goBack = useAppStore((s) => s.goBack);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Инициализация Telegram WebApp
    if (tg) {
      tg.ready();
      tg.expand();

      // Привязываем системную кнопку «Назад»
      tg.BackButton.onClick(goBack);
    }

    // 2. Получение store_id из query или startapp параметра
    const params = new URLSearchParams(window.location.search);
    const targetStoreId =
      params.get('store_id') ||
      tg?.initDataUnsafe?.start_param ||
      '';

    if (!targetStoreId) {
      setError('Не указан идентификатор магазина (store_id). Откройте бота заново.');
      setLoading(false);
      return;
    }

    setStoreId(targetStoreId);

    // 3. Загружаем информацию о магазине
    api
      .getStoreInfo(targetStoreId)
      .then((res) => {
        setStoreInfo(res.store);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Ошибка загрузки магазина');
        setLoading(false);
      });

    return () => {
      tg?.BackButton.offClick(goBack);
    };
  }, [setStoreId, setStoreInfo, goBack]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-tg-bg text-tg-text">
        <Loader2 className="w-8 h-8 animate-spin text-tg-button" />
        <p className="mt-3 text-xs text-tg-hint">Загрузка магазина...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-tg-bg text-tg-text">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h2 className="text-base font-bold">Не удалось открыть витрину</h2>
        <p className="text-xs text-tg-hint mt-1 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      {currentView === 'catalog' && <CatalogView />}
      {currentView === 'cart' && <CartView />}
      {currentView === 'checkout' && <CheckoutView />}
      {currentView === 'payment' && <PaymentView />}
      {currentView === 'order-status' && <OrderStatusView />}
    </div>
  );
}