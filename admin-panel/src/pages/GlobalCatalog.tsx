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
  const [saving, setSaving] = useState(false);
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
    
    setSaving(true);
    try {
      if (editItem.id) {
        // Редактирование существующего
        await apiPatch(`/api/admin/global-products/${editItem.id}`, {
          name: editItem.name,
          category_id: editItem.category_id,
          photo_url: editItem.photo_url,
          unit: editItem.unit
        });
        addToast('Товар успешно обновлен', 'success');
      } else {
        // Создание нового
        await apiPost('/api/admin/global-products', editItem);
        addToast('Новый товар создан', 'success');
      }
      setEditItem(null);
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Глобальный каталог</h1>
          <p className="text-xs text-slate-500">Мастер-товары для магазинов ({products.length})</p>
        </div>
        <button onClick={() => setEditItem({ unit: 'шт', photo_url: '' })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-transform active:scale-95">
          <Plus className="w-4 h-4" /> Добавить товар
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100 overflow-hidden">
              {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff className="w-6 h-6 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{p.name}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{p.categories?.name} • {p.unit}</p>
            </div>
            <button 
              onClick={() => setEditItem(p)} 
              className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              title="Редактировать"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900">{editItem.id ? 'Редактировать товар' : 'Новый товар'}</h2>
              <button onClick={() => setEditItem(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Photo Preview */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {editItem.photo_url ? (
                    <img src={editItem.photo_url} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ссылка на фото</label>
                  <input type="url" placeholder="https://..." value={editItem.photo_url || ''} onChange={e => setEditItem({...editItem, photo_url: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Название *</label>
                <input type="text" placeholder="Молоко 1л" value={editItem.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-slate-400" required />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Категория *</label>
                  <select value={editItem.category_id || ''} onChange={e => setEditItem({...editItem, category_id: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-slate-400" required>
                    <option value="" disabled>Выберите...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ед. изм. *</label>
                  <input type="text" placeholder="шт, кг, л" value={editItem.unit || ''} onChange={e => setEditItem({...editItem, unit: e.target.value})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-slate-400" required />
                </div>
              </div>
              
              <button type="submit" disabled={saving} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                {editItem.id ? 'Сохранить изменения' : 'Создать товар'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}