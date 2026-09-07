import { useEffect, useState } from 'react';
import {
  Loader2, Store, Wifi, WifiOff, X, Save, Calendar,
} from 'lucide-react';
import { apiGet, apiPatch } from '../api/client';
import { useUIStore } from '../store/ui';

interface StoreRow {
  id: string;
  name: string;
  status: string;
  subscription_plan: string;
  subscription_expires_at: string | null;
  telegram_bot_token: string | null;
  bot_online: boolean;
  owner: { email: string } | null;
  created_at: string;
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editStore, setEditStore] = useState<StoreRow | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  const fetchStores = async () => {
    try {
      const data = await apiGet<{ stores: StoreRow[] }>('/api/admin/stores');
      setStores(data.stores);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка загрузки магазинов', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-admin-50 flex items-center justify-center text-admin">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Управление магазинами</h1>
          <p className="text-xs text-slate-500">{stores.length} зарегистрировано на платформе</p>
        </div>
      </div>

      {/* Таблица магазинов */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="th-cell">Магазин</th>
                <th className="th-cell">Владелец</th>
                <th className="th-cell">Статус</th>
                <th className="th-cell">Telegram Бот</th>
                <th className="th-cell">Срок подписки</th>
                <th className="th-cell text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((store) => {
                const isExpired = store.subscription_expires_at
                  ? new Date(store.subscription_expires_at) < new Date()
                  : false;

                return (
                  <tr key={store.id} className="hover:bg-slate-50/50">
                    <td className="td-cell">
                      <p className="font-bold text-slate-900">{store.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{store.id.slice(0, 8)}</p>
                    </td>
                    <td className="td-cell text-slate-500 font-mono text-[11px]">
                      {store.owner?.email ?? '—'}
                    </td>
                    <td className="td-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        store.status === 'active'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {store.status === 'active' ? 'Активен' : 'Приостановлен'}
                      </span>
                    </td>
                    <td className="td-cell">
                      {store.telegram_bot_token ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          store.bot_online ? 'text-green-600' : 'text-slate-400'
                        }`}>
                          {store.bot_online
                            ? <><Wifi className="w-3.5 h-3.5" /> Онлайн</>
                            : <><WifiOff className="w-3.5 h-3.5" /> Остановлен</>
                          }
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Нет токена</span>
                      )}
                    </td>
                    <td className="td-cell">
                      {store.subscription_expires_at ? (
                        <span className={`text-xs font-medium ${isExpired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                          {new Date(store.subscription_expires_at).toLocaleDateString('ru-RU')}
                          {isExpired && ' (истекла)'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td-cell text-right">
                      <button
                        onClick={() => setEditStore(store)}
                        className="btn-outline text-xs"
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно редактирования магазина */}
      {editStore && (
        <EditStoreModal
          store={editStore}
          onClose={() => setEditStore(null)}
          onSaved={() => {
            setEditStore(null);
            fetchStores();
          }}
        />
      )}
    </div>
  );
}

function EditStoreModal({
  store,
  onClose,
  onSaved,
}: {
  store: StoreRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(store.status);
  const [expiresAt, setExpiresAt] = useState(
    store.subscription_expires_at
      ? store.subscription_expires_at.slice(0, 10)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/admin/stores/${store.id}`, {
        status,
        subscription_expires_at: expiresAt || null,
      });
      addToast(`Магазин «${store.name}» обновлён`, 'success');
      onSaved();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{store.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Статус */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Статус активности</label>
          <div className="flex gap-2">
            {(['active', 'suspended'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
                  status === s
                    ? s === 'active'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-500 bg-white'
                }`}
              >
                {s === 'active' ? 'Активен (Бот работает)' : 'Приостановлен'}
              </button>
            ))}
          </div>
        </div>

        {/* Дата подписки */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            Подписка действует до
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving} className="btn-admin flex-1 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}