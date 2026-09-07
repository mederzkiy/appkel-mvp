import { useEffect, useState } from 'react';
import {
  Loader2, Package, Plus, X, ImageOff, Save,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';
import { useUIStore } from '../store/ui';

interface GlobalProduct {
  id: string;
  name: string;
  barcode: string | null;
  photo_url: string | null;
  category_name: string | null;
  stores_using: number;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export default function GlobalCatalogPage() {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const fetchData = async () => {
    try {
      const [prodData, catData] = await Promise.all([
        apiGet<{ products: GlobalProduct[] }>('/api/admin/global-products'),
        apiGet<{ categories: Category[] }>('/api/admin/categories'),
      ]);
      setProducts(prodData.products);
      setCategories(catData.categories);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка загрузки каталога', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-admin-50 flex items-center justify-center text-admin">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Глобальный мастер-каталог</h1>
            <p className="text-xs text-slate-500">{products.length} эталонных товаров</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-admin flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Добавить товар
        </button>
      </div>

      {/* Таблица мастер-товаров */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="th-cell w-14">Фото</th>
                <th className="th-cell">Наименование</th>
                <th className="th-cell">Категория</th>
                <th className="th-cell">Штрихкод</th>
                <th className="th-cell text-right">Магазинов используют</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="td-cell">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="td-cell">
                    <span className="font-bold text-slate-900">{p.name}</span>
                  </td>
                  <td className="td-cell">
                    {p.category_name ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                        {p.category_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="td-cell font-mono text-xs text-slate-500">
                    {p.barcode ?? '—'}
                  </td>
                  <td className="td-cell text-right">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-admin-50 text-admin-700 text-xs font-bold">
                      {p.stores_using}
                    </span>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-400">
                    Каталог пуст. Добавьте первый эталонный товар.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка добавления товара */}
      {showModal && (
        <AddProductModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AddProductModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Введите название товара', 'error');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/api/admin/global-products', {
        name: name.trim(),
        category_id: categoryId || null,
        photo_url: photoUrl.trim() || null,
        barcode: barcode.trim() || null,
      });
      addToast(`Товар «${name.trim()}» добавлен в каталог`, 'success');
      onCreated();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка добавления', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">Новый мастер-товар</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Молоко «Весёлый молочник» 3.2% 900мл"
              required
              autoFocus
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Категория</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-field">
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">URL фото (PNG/JPG)</label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/images/milk.jpg"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Штрихкод (EAN-13)</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="4870001234567"
              className="input-field font-mono"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Отмена</button>
            <button type="submit" disabled={saving} className="btn-admin flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Добавить в базу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}