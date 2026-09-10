import { useEffect, useState, useRef } from 'react';
import { ShoppingBag, Plus, Minus, ImageOff, Loader2, MapPin } from 'lucide-react';
import { api, ProductItem } from '../api/client';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';

export default function CatalogView() {
  const storeId = useAppStore((s) => s.storeId);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const navigate = useAppStore((s) => s.navigate);

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const totalItems = useCartStore((s) => s.totalItems());
  const subtotal = useCartStore((s) => s.subtotal());

  const [catalog, setCatalog] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    api
      .getCatalog(storeId)
      .then((res) => setCatalog(res.catalog))
      .catch((err) => console.error('Ошибка загрузки каталога:', err))
      .finally(() => setLoading(false));
  }, [storeId]);

  // Группировка товаров по категориям
  const categories = Array.from(
    new Set(catalog.map((p) => p.category_name || 'Разное'))
  );

  const filteredCatalog =
    activeCategory === 'all'
      ? catalog
      : catalog.filter((p) => (p.category_name || 'Разное') === activeCategory);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    if (cat === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = categoryRefs.current[cat];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenNearbyStores = () => {
    window.location.href = window.location.pathname;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        <p className="mt-3 text-sm text-tg-hint">Загрузка каталога...</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Шапка магазина с кнопкой перехода ко всем магазинам */}
      <div className="px-4 pt-4 pb-2 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-tg-text">{storeInfo?.name || 'Витрина магазина'}</h1>
          <p className="text-xs text-tg-hint mt-0.5">{storeInfo?.address || 'Быстрая доставка'}</p>
        </div>
        <button
          onClick={handleOpenNearbyStores}
          className="flex items-center gap-1 bg-tg-secondary-bg text-tg-text px-2.5 py-1.5 rounded-xl text-xs font-medium border border-black/5 active:scale-95 transition-transform"
        >
          <MapPin className="w-3.5 h-3.5 text-blue-500" />
          <span>Другие магазины</span>
        </button>
      </div>

      {/* Горизонтальные плашки категорий (Pills) */}
      <div className="sticky top-0 z-20 bg-tg-bg/95 backdrop-blur-sm py-2 px-4 border-b border-tg-secondary-bg overflow-x-auto no-scrollbar flex gap-2">
        <button
          onClick={() => scrollToCategory('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'all'
              ? 'bg-tg-button text-tg-button-text'
              : 'bg-tg-secondary-bg text-tg-text'
          }`}
        >
          Все товары
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => scrollToCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary-bg text-tg-text'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Сетка товаров */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {filteredCatalog.map((product) => {
          const qty = items[product.id]?.quantity || 0;
          const isDiscount = Boolean(product.old_price && product.old_price > product.price);

          return (
            <div
              key={product.id}
              className={`relative rounded-2xl p-2.5 flex flex-col justify-between transition-all ${
                isDiscount
                  ? 'bg-amber-50/50 border-2 border-amber-300 shadow-sm'
                  : 'bg-tg-secondary-bg'
              }`}
            >
              {/* Плашка Акция */}
              {isDiscount && (
                <span className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Акция
                </span>
              )}

              <div>
                {/* Фото товара */}
                <div className="aspect-square bg-tg-bg rounded-xl overflow-hidden flex items-center justify-center mb-2">
                  {product.photo_url ? (
                    <img
                      src={product.photo_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff className="w-8 h-8 text-tg-hint" />
                  )}
                </div>

                {/* Название */}
                <p className="text-xs font-semibold text-tg-text line-clamp-2 leading-tight">
                  {product.name}
                </p>

                {/* Блок цены со скидкой */}
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-tg-text">
                    {product.price.toLocaleString('ru-RU')} сом
                  </span>
                  {isDiscount && (
                    <span className="text-[11px] text-gray-400 line-through">
                      {product.old_price?.toLocaleString('ru-RU')} сом
                    </span>
                  )}
                </div>
              </div>

              {/* Кнопка добавления / счётчик */}
              <div className="mt-2.5">
                {qty === 0 ? (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full py-1.5 px-3 bg-tg-button text-tg-button-text rounded-xl text-xs font-medium flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" /> В корзину
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-tg-bg rounded-xl p-1">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-tg-text">{qty}</span>
                    <button
                      onClick={() => addItem(product)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-tg-button text-tg-button-text active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Плавающая нижняя кнопка перехода в корзину */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <button
            onClick={() => navigate('cart')}
            className="w-full bg-tg-button text-tg-button-text py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Корзина ({totalItems})</span>
            </div>
            <span>{subtotal.toLocaleString('ru-RU')} сом</span>
          </button>
        </div>
      )}
    </div>
  );
}