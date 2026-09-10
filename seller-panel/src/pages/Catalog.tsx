import React, { useEffect, useState } from 'react';
import { Loader2, ImageOff, Search, Save, Tag } from 'lucide-react';
import { apiGet, apiPost } from '../api/client';
import { useUIStore } from '../store/ui';

interface CatalogItem {
  global_product_id: string;
  name: string;
  barcode: string | null;
  photo_url: string | null;
  category: { id: string; name: string; sort_order: number } | null;
  store_product_id: string | null;
  enabled: boolean;
  custom_price: number | null;
  old_price: number | null;
}

interface ItemState {
  enabled: boolean;
  price: string;
  oldPrice: string;
  dirty: boolean;
  saving: boolean;
}

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const addToast = useUIStore((s: any) => s.addToast);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<{ catalog: CatalogItem[] }>('/api/seller/catalog');
        setCatalog(data.catalog || []);

        const states: Record<string, ItemState> = {};
        for (const item of data.catalog || []) {
          states[item.global_product_id] = {
            enabled: item.enabled,
            price: item.custom_price?.toString() ?? '',
            oldPrice: item.old_price?.toString() ?? '',
            dirty: false,
            saving: false,
          };
        }
        setItemStates(states);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Ошибка загрузки каталога', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [addToast]);

  const updateItem = (gpId: string, updates: Partial<ItemState>) => {
    setItemStates((prev: Record<string, ItemState>) => ({
      ...prev,
      [gpId]: { ...prev[gpId], ...updates, dirty: true },
    }));
  };

  const saveItem = async (gpId: string) => {
    const state = itemStates[gpId];
    if (!state) return;

    const price = parseFloat(state.price);
    const oldPrice = state.oldPrice ? parseFloat(state.oldPrice) : null;

    if (state.enabled && (isNaN(price) || price < 0)) {
      addToast('Укажите корректную цену продажи', 'error');
      return;
    }

    if (oldPrice !== null && oldPrice <= price) {
      addToast('Старая цена должна быть выше текущей цены продажи', 'error');
      return;
    }

    setItemStates((prev: Record<string, ItemState>) => ({
      ...prev,
      [gpId]: { ...prev[gpId], saving: true },
    }));

    try {
      await apiPost('/api/seller/catalog/toggle', {
        global_product_id: gpId,
        custom_price: price || 0,
        old_price: oldPrice,
        is_active: state.enabled,
      });

      setItemStates((prev: Record<string, ItemState>) => ({
        ...prev,
        [gpId]: { ...prev[gpId], saving: false, dirty: false },
      }));

      addToast(state.enabled ? 'Товар обновлён на витрине' : 'Товар скрыт с витрины', 'success');
    } catch (err) {
      setItemStates((prev: Record<string, ItemState>) => ({
        ...prev,
        [gpId]: { ...prev[gpId], saving: false },
      }));
      addToast(err instanceof Error ? err.message : 'Ошибка сохранения', 'error');
    }
  };

  const toggleItem = async (gpId: string) => {
    const state = itemStates[gpId];
    if (!state) return;

    const newEnabled = !state.enabled;
    const price = parseFloat(state.price) || 0;
    const oldPrice = state.oldPrice ? parseFloat(state.oldPrice) : null;

    setItemStates((prev: Record<string, ItemState>) => ({
      ...prev,
      [gpId]: { ...prev[gpId], enabled: newEnabled, saving: true },
    }));

    try {
      await apiPost('/api/seller/catalog/toggle', {
        global_product_id: gpId,
        custom_price: price,
        old_price: oldPrice,
        is_active: newEnabled,
      });

      setItemStates((prev: Record<string, ItemState>) => ({
        ...prev,
        [gpId]: { ...prev[gpId], enabled: newEnabled, saving: false, dirty: false },
      }));

      addToast(newEnabled ? 'Товар включён' : 'Товар отключён', 'success');
    } catch (err) {
      setItemStates((prev: Record<string, ItemState>) => ({
        ...prev,
        [gpId]: { ...prev[gpId], enabled: !newEnabled, saving: false },
      }));
      addToast(err instanceof Error ? err.message : 'Ошибка обновления', 'error');
    }
  };

  const filtered = search.trim()
    ? catalog.filter((item: CatalogItem) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      )
    : catalog;

  const grouped = new Map<string, CatalogItem[]>();
  for (const item of filtered) {
    const catName = item.category?.name ?? 'Разное';
    if (!grouped.has(catName)) grouped.set(catName, []);
    grouped.get(catName)!.push(item);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const activeCount = catalog.filter((i: CatalogItem) => itemStates[i.global_product_id]?.enabled).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Управление каталогом</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Включено {activeCount} из {catalog.length} товаров. Задавайте скидки через поле «Старая цена».
          </p>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder="Поиск по названию или штрихкоду..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-slate-400 py-12 text-sm">Товары не найдены</p>
      )}

      {/* Список товаров по категориям */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([catName, items]: [string, CatalogItem[]]) => (
          <div key={catName} className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {catName}
            </h2>
            <div className="space-y-2">
              {items.map((item: CatalogItem) => {
                const state = itemStates[item.global_product_id];
                if (!state) return null;

                const currentP = parseFloat(state.price);
                const oldP = parseFloat(state.oldPrice);
                const hasDiscount = Boolean(oldP && currentP && oldP > currentP);
                const discountPercent = hasDiscount ? Math.round(((oldP - currentP) / oldP) * 100) : 0;

                return (
                  <div
                    key={item.global_product_id}
                    className={`bg-white border rounded-3xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      !state.enabled
                        ? 'opacity-50 bg-slate-50/70 border-slate-100'
                        : hasDiscount
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Инфо о товаре */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.photo_url ? (
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageOff className="w-5 h-5 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {item.name}
                          </p>
                          {hasDiscount && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" /> -{discountPercent}%
                            </span>
                          )}
                        </div>
                        {item.barcode && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">{item.barcode}</p>
                        )}
                      </div>
                    </div>

                    {/* Поля цен и тумблер */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Старая цена (для акции) */}
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 font-medium">Старая (акция)</span>
                        <input
                          type="number"
                          value={state.oldPrice}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateItem(item.global_product_id, { oldPrice: e.target.value })
                          }
                          onBlur={() => {
                            if (state.dirty && state.enabled) saveItem(item.global_product_id);
                          }}
                          disabled={!state.enabled}
                          placeholder="—"
                          className="w-20 px-2 py-1.5 rounded-xl border border-dashed border-slate-200 text-xs font-medium text-right text-slate-500 focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-300"
                        />
                      </div>

                      {/* Цена продажи */}
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 font-medium">Цена сом *</span>
                        <input
                          type="number"
                          value={state.price}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateItem(item.global_product_id, { price: e.target.value })
                          }
                          onBlur={() => {
                            if (state.dirty && state.enabled) saveItem(item.global_product_id);
                          }}
                          disabled={!state.enabled}
                          placeholder="0"
                          className="w-20 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-300"
                        />
                      </div>

                      {/* Кнопка сохранения изменений */}
                      {state.dirty && state.enabled && (
                        <button
                          onClick={() => saveItem(item.global_product_id)}
                          disabled={state.saving}
                          className="p-2 rounded-xl bg-slate-900 text-white transition-transform active:scale-90 self-end"
                          title="Сохранить цену"
                        >
                          {state.saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Тумблер вкл/выкл */}
                      <div className="flex flex-col items-center self-end">
                        <span className="text-[9px] text-slate-400 font-medium mb-1">Витрина</span>
                        <button
                          onClick={() => toggleItem(item.global_product_id)}
                          disabled={state.saving}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                            state.enabled ? 'bg-slate-900' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                              state.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}