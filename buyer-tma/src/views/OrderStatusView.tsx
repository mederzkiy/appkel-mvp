import { CheckCircle, ArrowLeft, PackageCheck } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';

export default function OrderStatusView() {
  const activeOrderId = useAppStore((s) => s.activeOrderId);
  const lastOrderTotal = useAppStore((s) => s.lastOrderTotal);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const navigate = useAppStore((s) => s.navigate);
  const clearCart = useCartStore((s) => s.clearCart);

  const shortId = activeOrderId ? activeOrderId.slice(0, 8).toUpperCase() : '';

  const handleBackToStore = () => {
    clearCart();
    navigate('catalog');
  };

  return (
    <div className="p-6 min-h-[85vh] flex flex-col justify-between items-center text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Иконка успеха */}
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-5 shadow-inner">
          <CheckCircle className="w-10 h-10" />
        </div>

        <h1 className="text-xl font-black text-tg-text">Заказ оформлен!</h1>
        <p className="text-sm font-bold text-tg-button mt-1">#{shortId}</p>

        <p className="text-xs text-tg-hint mt-3 max-w-xs leading-relaxed">
          Магазин «{storeInfo?.name || 'Appkel'}» уже получил ваш заказ и начинает его собирать.
          Статус заказа будет приходить прямо в этот чат с ботом.
        </p>

        {/* Детализация */}
        <div className="mt-6 bg-tg-secondary-bg rounded-2xl p-4 w-full max-w-xs text-xs space-y-2 text-left">
          <div className="flex items-center gap-2 font-semibold text-tg-text">
            <PackageCheck className="w-4 h-4 text-green-600" />
            <span>Статус: Принят в обработку</span>
          </div>
          <div className="flex justify-between text-tg-hint pt-2 border-t border-tg-bg">
            <span>Сумма к оплате:</span>
            <span className="font-bold text-tg-text">
              {lastOrderTotal.toLocaleString('ru-RU')} сом
            </span>
          </div>
        </div>
      </div>

      {/* Кнопка возврата в каталог */}
      <div className="w-full max-w-xs">
        <button
          onClick={handleBackToStore}
          className="w-full bg-tg-button text-tg-button-text py-3.5 px-5 rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Вернуться в каталог</span>
        </button>
      </div>
    </div>
  );
}