import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export default function CartView() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.subtotal());
  const navigate = useAppStore((s) => s.navigate);

  const cartList = Object.values(items);

  const handleClear = () => {
    tg?.HapticFeedback?.notificationOccurred('warning');
    clearCart();
    navigate('catalog');
  };

  if (cartList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <ShoppingBag className="w-16 h-16 text-tg-hint mb-4" />
        <h2 className="text-lg font-bold text-tg-text">Ваша корзина пуста</h2>
        <p className="text-xs text-tg-hint mt-1 mb-6">
          Выберите нужные товары в каталоге магазина
        </p>
        <button
          onClick={() => navigate('catalog')}
          className="bg-tg-button text-tg-button-text px-6 py-2.5 rounded-xl font-medium text-sm active:scale-95 transition-transform"
        >
          Перейти к покупкам
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28">
      {/* Шапка корзины */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-tg-text">Корзина</h1>
        <button
          onClick={handleClear}
          className="text-xs text-red-500 font-medium flex items-center gap-1 active:opacity-70"
        >
          <Trash2 className="w-3.5 h-3.5" /> Очистить
        </button>
      </div>

      {/* Список товаров */}
      <div className="space-y-2.5">
        {cartList.map(({ product, quantity }) => (
          <div
            key={product.id}
            className="bg-tg-secondary-bg rounded-2xl p-3 flex items-center gap-3"
          >
            {/* Картинка */}
            <div className="w-14 h-14 bg-tg-bg rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-tg-hint" />
              )}
            </div>

            {/* Название и цена */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-tg-text truncate">{product.name}</p>
              <p className="text-sm font-bold text-tg-text mt-0.5">
                {(product.price * quantity).toLocaleString('ru-RU')} сом
              </p>
              <p className="text-[10px] text-tg-hint">
                {product.price} сом / шт.
              </p>
            </div>

            {/* Контролы количества */}
            <div className="flex items-center gap-2 bg-tg-bg rounded-xl p-1">
              <button
                onClick={() => removeItem(product.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-tg-text min-w-4 text-center">
                {quantity}
              </span>
              <button
                onClick={() => addItem(product)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-tg-button text-tg-button-text active:scale-90 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Итоговая строка и переход к заказу */}
      <div className="fixed bottom-4 left-4 right-4 z-30">
        <button
          onClick={() => navigate('checkout')}
          className="w-full bg-tg-button text-tg-button-text py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span>Оформить заказ</span>
          <div className="flex items-center gap-1.5">
            <span>{subtotal.toLocaleString('ru-RU')} сом</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}