import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Edit, ImageOff, Search, Save, X } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../api/client';
import { useUIStore } from '../store/ui';

interface Category {
  id: string;
  name: string;
}

interface GlobalProduct {
  id: string;
  name: string;
  photo_url: string | null;
  barcode: string | null;
  unit: string;
  category_id: string;
  categories?: Category;
}

export default function GlobalCatalogPage() {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<Partial<GlobalProduct> | null>(null);
  const addToast = useUIStore((s: any) => s.addToast);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        apiGet<{ products: GlobalProduct[] }>('/api/admin/global-products'),
        apiGet<{ categories: Category[] }>('/api/admin/categories')
      ]);
      setProducts(prodRes.products || []);
      setCategories(catRes.categories || []);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки каталога', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem?.name || !editItem?.category_id) {
      addToast('Заполните название и категорию', 'error');
      return;
    }
    
    try {
      if (editItem.id) {
        await apiPatch(`/api/admin/global-products/${editItem.id}`, editItem);
        addToast('Товар обновлен', 'success');
      } else {
        await apiPost('/api/admin/global-products', editItem);
        addToast('Товар создан', 'success');
      }
      setEditItem(null);
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения', 'error');
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Глобальный каталог</h1>
          <p className="text-xs text-slate-500">Мастер-товары для магазинов ({products.length})</p>
        </div>
        <button onClick={() => setEditItem({ unit: 'шт' })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить товар
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или штрихкоду..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover rounded-2xl" /> : <ImageOff className="w-6 h-6 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{p.name}</h3>
              <p className="text-[10px] text-slate-500">{p.categories?.name} • {p.unit}</p>
              {p.barcode && <p className="text-[10px] font-mono text-slate-400 mt-1">{p.barcode}</p>}
            </div>
            <button onClick={() => setEditItem(p)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl">
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{editItem.id ? 'Редактировать' : 'Новый товар'}</h2>
              <button onClick={() => setEditItem(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Название *" value={editItem.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-xs border border-slate-200" required />
              <div className="grid grid-cols-2 gap-3">
                <select value={editItem.category_id || ''} onChange={e => setEditItem({...editItem, category_id: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-xs border border-slate-200" required>
                  <option value="" disabled>Категория *</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Ед. изм. (шт, кг)" value={editItem.unit || ''} onChange={e => setEditItem({...editItem, unit: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-xs border border-slate-200" required />
              </div>
              <input type="text" placeholder="Штрихкод (опционально)" value={editItem.barcode || ''} onChange={e => setEditItem({...editItem, barcode: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-xs border border-slate-200 font-mono" />
              <input type="url" placeholder="URL фото (опционально)" value={editItem.photo_url || ''} onChange={e => setEditItem({...editItem, photo_url: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-xs border border-slate-200" />
              <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Сохранить
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}