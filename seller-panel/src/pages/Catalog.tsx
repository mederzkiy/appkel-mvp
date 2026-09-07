import { useEffect, useState } from 'react';
import { Loader2, ImageOff, Search, Save } from 'lucide-react';
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
}

interface ItemState {
  enabled: boolean;
  price: string;
  dirty: boolean;
  saving: boolean;
}

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<{ catalog: CatalogItem[] }>('/api/seller/catalog');
        setCatalog(data.catalog);

        const states: Record<string, ItemState> = {};
        for (const item of data.catalog) {
          states[item.global_product_id] = {
            enabled: item.enabled,
            price: item.custom_price?.toString() ?? '',
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
    setItemStates((prev) => ({
      ...prev,
      [gpId]: { ...prev[gpId], ...updates, dirty: true },
    }));
  };

  const saveItem = async (gpId: string) => {
    const state = itemStates[gpId];
    if (!state) return;

    const price = parseFloat(state.price);
    if (state.enabled && (isNaN(price) || price < 0)) {
      addToast('Укажите корректную цену товара', 'error');
      return;
    }

    setItemStates((prev) => ({
      ...prev,
      [gpId]: { ...prev[gpId], saving: true },
    }));

    try {
      await apiPost('/api/seller/catalog/toggle', {
        global_product_id: gpId,
        custom_price: price || 0,
        is_active: state.enabled,
      });

      setItemStates((prev) => ({
        ...prev,
        [gpId]: { ...prev[gpId], saving: false, dirty: false },
      }));

      addToast(state.enabled ? 'Товар включён в витрину' : 'Товар скрыт с витрины', 'success');
    } catch (err) {
      setItemStates((prev) => ({
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
    setItemStates((prev) => ({
      ...prev,
      [gpId]: { ...prev[gpId], enabled: newEnabled, dirty: true },
    }));

    if (!newEnabled || (state.price && parseFloat(state.price) > 0)) {
      const price = parseFloat(state.price) || 0;

      setItemStates((prev) => ({
        ...prev,
        [gpId]: { ...prev[gpId], enabled: newEnabled, saving: true },
      }));

      try {
        await apiPost('/api/seller/catalog/toggle', {
          global_product_id: gpId,
          custom_price: price,
          is_active: newEnabled,
        });

        setItemStates((prev) => ({
          ...prev,
          [gpId]: { ...prev[gpId], saving: false, dirty: false },
        }));

        addToast(newEnabled ? 'Товар включён' : 'Товар отключён', 'success');
      } catch (err) {
        setItemStates((prev) => ({
          ...prev,
          [gpId]: { ...prev[gpId], enabled: !newEnabled, saving: false },
        }));
        addToast(err instanceof Error ? err.message : 'Ошибка обновления', 'error');
      }
    }
  };

  const filtered = search.trim()
    ? catalog.filter((item) =>
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const activeCount = catalog.filter((i) => itemStates[i.global_product_id]?.enabled).length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Управление каталогом</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Включено {activeCount} из {catalog.length} мастер-товаров
        </p>
      </div>

      {/* Поиск */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или штрихкоду..."
          className="input-field pl-10"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-slate-400 py-12 text-sm">Товары не найдены</p>
      )}

      {/* Список товаров по категориям */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([catName, items]) => (
          <div key={catName}>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
              {catName}
            </h2>
            <div className="space-y-2">
              {items.map((item) => {
                const state = itemStates[item.global_product_id];
                if (!state) return null;

                return (
                  <div
                    key={item.global_product_id}
                    className={`card p-3 flex items-center gap-3 transition-opacity ${
                      !state.enabled ? 'opacity-60 bg-slate-50/70' : ''
                    }`}
                  >
                    {/* Фото */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
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

                    {/* Название */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.name}
                      </p>
                      {item.barcode && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">{item.barcode}</p>
                      )}
                    </div>

                    {/* Поле цены и тумблер */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          value={state.price}
                          onChange={(e) => updateItem(item.global_product_id, { price: e.target.value })}
                          onBlur={() => {
                            if (state.dirty && state.enabled) saveItem(item.global_product_id);
                          }}
                          disabled={!state.enabled}
                          placeholder="Цена"
                          className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>

                      {/* Кнопка ручного сохранения при редактировании */}
                      {state.dirty && state.enabled && (
                        <button
                          onClick={() => saveItem(item.global_product_id)}
                          disabled={state.saving}
                          className="p-1.5 rounded-lg bg-brand text-brand-dark transition-transform active:scale-90"
                        >
                          {state.saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Переключатель активен/неактивен */}
                      <button
                        onClick={() => toggleItem(item.global_product_id)}
                        disabled={state.saving}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                          state.enabled ? 'bg-brand' : 'bg-slate-300'
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
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}