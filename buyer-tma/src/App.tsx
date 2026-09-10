import { useEffect, useState } from 'react';
import { api } from './api/client';
import { useAppStore } from './store/app';
import CatalogView from './views/CatalogView';
import CartView from './views/CartView';
import CheckoutView from './views/CheckoutView';
import PaymentView from './views/PaymentView';
import OrderStatusView from './views/OrderStatusView';
import { StoreListView } from './views/StoreListView';
import { Loader2, AlertTriangle } from 'lucide-react';

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export default function App() {
  const currentView = useAppStore((s) => s.currentView);
  const setStoreId = useAppStore((s) => s.setStoreId);
  const setStoreInfo = useAppStore((s) => s.setStoreInfo);
  const goBack = useAppStore((s) => s.goBack);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Получаем store_id из query или start_param Telegram
  const params = new URLSearchParams(window.location.search);
  const targetStoreId =
    params.get('store_id') ||
    tg?.initDataUnsafe?.start_param ||
    '';

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.BackButton.onClick(goBack);
    }

    // Если store_id нет — не грузим магазин, сразу отдаем управление StoreListView
    if (!targetStoreId) {
      setLoading(false);
      return;
    }

    setStoreId(targetStoreId);

    // Загружаем инфо о конкретном магазине
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
  }, [targetStoreId, setStoreId, setStoreInfo, goBack]);

  // Сценарий 1: Пользователь зашел без store_id -> Показываем магазины поблизости
  if (!targetStoreId) {
    return <StoreListView />;
  }

  // Сценарий 2: Загрузка конкретного магазина
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-tg-bg text-tg-text">
        <Loader2 className="w-8 h-8 animate-spin text-tg-button" />
        <p className="mt-3 text-xs text-tg-hint">Загрузка магазина...</p>
      </div>
    );
  }

  // Сценарий 3: Ошибка при открытии магазина
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-tg-bg text-tg-text">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h2 className="text-base font-bold">Не удалось открыть витрину</h2>
        <p className="text-xs text-tg-hint mt-1 max-w-xs">{error}</p>
        <button
          onClick={() => {
            window.location.href = window.location.pathname;
          }}
          className="mt-4 px-4 py-2 bg-tg-button text-tg-button-text rounded-lg text-xs font-semibold"
        >
          Посмотреть другие магазины
        </button>
      </div>
    );
  }

  // Сценарий 4: Витрина конкретного магазина
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