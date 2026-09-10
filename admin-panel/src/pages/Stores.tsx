import React, { useEffect, useState, useRef } from 'react';
import {
  Loader2,
  Store,
  Wifi,
  WifiOff,
  X,
  Save,
  Calendar,
  QrCode,
  Download,
  Printer,
  MapPin,
} from 'lucide-react';
import { apiGet, apiPatch } from '../api/client';
import { useUIStore } from '../store/ui';

interface StoreRow {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  const [qrStore, setQrStore] = useState<StoreRow | null>(null);
  const addToast = useUIStore((s: any) => s.addToast);

  const fetchStores = async () => {
    try {
      const data = await apiGet<{ stores: StoreRow[] }>('/api/admin/stores');
      setStores(data.stores || []);
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
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Магазины платформы</h1>
            <p className="text-xs text-slate-500">{stores.length} зарегистрировано в системе</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
              <tr>
                <th className="p-4">Магазин</th>
                <th className="p-4">Координаты</th>
                <th className="p-4">Владелец</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Telegram Бот</th>
                <th className="p-4">Подписка</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((store) => {
                const isExpired = store.subscription_expires_at
                  ? new Date(store.subscription_expires_at) < new Date()
                  : false;

                return (
                  <tr key={store.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-black text-slate-900">{store.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{store.id.slice(0, 8)}</p>
                      {store.address && <p className="text-[11px] text-slate-500 truncate max-w-xs">{store.address}</p>}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                      {store.latitude && store.longitude ? (
                        <span className="text-slate-700">
                          {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Не указаны
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                      {store.owner?.email ?? '—'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          store.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {store.status === 'active' ? 'Активен' : 'Приостановлен'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <Wifi className="w-3.5 h-3.5" /> Единый бот
                      </span>
                    </td>
                    <td className="p-4">
                      {store.subscription_expires_at ? (
                        <span className={`font-medium ${isExpired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                          {new Date(store.subscription_expires_at).toLocaleDateString('ru-RU')}
                          {isExpired && ' (истекла)'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setQrStore(store)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold active:scale-95 transition-transform"
                      >
                        <QrCode className="w-3.5 h-3.5 inline mr-1" />
                        QR
                      </button>
                      <button
                        onClick={() => setEditStore(store)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 active:scale-95 transition-transform"
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

      {qrStore && (
        <StoreQrModal
          store={qrStore}
          onClose={() => setQrStore(null)}
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
  const [latitude, setLatitude] = useState(store.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(store.longitude?.toString() || '');
  const [expiresAt, setExpiresAt] = useState(
    store.subscription_expires_at ? store.subscription_expires_at.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s: any) => s.addToast);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/admin/stores/${store.id}`, {
        status,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{store.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Статус магазина</label>
          <div className="flex gap-2">
            {(['active', 'suspended'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${
                  status === s
                    ? s === 'active'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-500 bg-white'
                }`}
              >
                {s === 'active' ? 'Активен' : 'Приостановлен'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            Координаты магазина (для поиска поблизости)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="Широта (напр. 42.8746)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="Долгота (напр. 74.5698)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            Подписка действует до
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="w-1/2 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-1/2 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function StoreQrModal({ store, onClose }: { store: StoreRow; onClose: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const botUsername = 'appkelbot';
  const directLink = `https://t.me/${botUsername}?start=store_${store.id}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(directLink)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">QR-код витрины</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={qrRef} className="p-4 bg-slate-50 border border-slate-200 rounded-3xl inline-block">
          <img src={qrApiUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl shadow-sm" />
          <p className="mt-3 text-xs font-black text-slate-900">{store.name}</p>
          <p className="text-[10px] text-slate-400">Сканируйте для перехода к заказу</p>
        </div>

        <div className="text-[11px] font-mono bg-slate-100 p-2 rounded-xl text-slate-600 break-all select-all">
          {directLink}
        </div>

        <div className="flex gap-2">
          <a
            href={qrApiUrl}
            download={`qr_${store.name}.png`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" /> Скачать
          </a>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" /> Печать
          </button>
        </div>
      </div>
    </div>
  );
}