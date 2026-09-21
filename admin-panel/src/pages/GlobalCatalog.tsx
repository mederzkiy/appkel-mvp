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
  base64_image?: string;
  unit: string;
  category_id: string;
  categories?: Category;
  store_id?: string | null;
  store_name?: string | null;
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

  useEffect(() => {
    // Железобетонный вызов
    const init = async () => {
      await fetchData();
    };
    init();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem?.name || !editItem?.category_id) {
      addToast('Заполните название и категорию', 'error');
      return;
    }
    
    setSaving(true);
    try {
      if (editItem.id) {
        await apiPatch(`/api/admin/global-products/${editItem.id}`, {
          name: editItem.name,
          category_id: editItem.category_id,
          photo_url: editItem.photo_url,
          base64_image: editItem.base64_image,
          unit: editItem.unit
        });
        addToast('Товар успешно обновлен', 'success');
      } else {
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Точно удалить этот товар?')) return;
    try {
      await apiPost(`/api/admin/global-products/${id}/delete`, {});
      addToast('Товар удален', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления', 'error');
    }
  };

  const handleMakeGlobal = async (id: string) => {
    if (!window.confirm('Сделать товар глобальным? Он станет доступен всем магазинам.')) return;
    try {
      await apiPost(`/api/admin/global-products/${id}/make-global`, {});
      addToast('Товар перенесен в глобальный каталог', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Ошибка', 'error');
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const adminProducts = filtered.filter(p => !p.store_id);
  const storeProducts = filtered.filter(p => p.store_id);

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

      {adminProducts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Глобальные (Админ)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminProducts.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100 overflow-hidden">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff className="w-6 h-6 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{p.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.categories?.name} • {p.unit}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-50">
                  <button 
                    onClick={() => setEditItem(p)} 
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Удалить"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {storeProducts.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">От магазинов</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeProducts.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-3xl border border-amber-200 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100 overflow-hidden">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff className="w-6 h-6 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{p.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.categories?.name} • {p.unit}</p>
                    <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider">От: {p.store_name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-50">
                  <button 
                    onClick={() => handleMakeGlobal(p.id)} 
                    className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors text-[10px] font-bold"
                    title="В глобальный"
                  >
                    В глобальный
                  </button>
                  <button 
                    onClick={() => setEditItem(p)} 
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Удалить"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {editItem.photo_url ? (
                      <img src={editItem.photo_url} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Фото товара (Загрузить)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            setEditItem({...editItem, base64_image: ev.target.result as string, photo_url: ev.target.result as string});
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="w-full p-2 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Или вставьте ссылку на фото</label>
                  <input type="text" placeholder="https://..." value={editItem.photo_url?.startsWith('data:') ? '' : editItem.photo_url || ''} onChange={e => setEditItem({...editItem, photo_url: e.target.value, base64_image: undefined})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-slate-400" />
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