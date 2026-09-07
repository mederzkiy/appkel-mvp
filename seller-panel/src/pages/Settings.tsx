import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { apiGet, apiPut } from '../api/client';
import { useUIStore } from '../store/ui';

interface StoreData {
  name: string;
  address: string;
  delivery_radius_km: number;
  delivery_base_fee: number;
  delivery_per_km_fee: number;
  payment_info: {
    mbank_phone?: string;
    qr_code_url?: string;
  };
  owner_chat_id: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [perKmFee, setPerKmFee] = useState('');
  const [mbankPhone, setMbankPhone] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [ownerChatId, setOwnerChatId] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<{ store: StoreData }>('/api/seller/store');
        const s = data.store;
        setName(s.name || '');
        setAddress(s.address || '');
        setRadiusKm(s.delivery_radius_km?.toString() || '5');
        setBaseFee(s.delivery_base_fee?.toString() || '0');
        setPerKmFee(s.delivery_per_km_fee?.toString() || '0');
        setMbankPhone(s.payment_info?.mbank_phone || '');
        setQrCodeUrl(s.payment_info?.qr_code_url || '');
        setOwnerChatId(s.owner_chat_id?.toString() || '');
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Ошибка загрузки настроек', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await apiPut('/api/seller/store', {
        name: name.trim(),
        address: address.trim(),
        delivery_radius_km: parseFloat(radiusKm) || 5,
        delivery_base_fee: parseFloat(baseFee) || 0,
        delivery_per_km_fee: parseFloat(perKmFee) || 0,
        payment_info: {
          mbank_phone: mbankPhone.trim() || undefined,
          qr_code_url: qrCodeUrl.trim() || undefined,
        },
        owner_chat_id: ownerChatId.trim() || undefined,
      });

      addToast('Настройки магазина успешно сохранены', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка при сохранении', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Настройки магазина</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Конфигурация параметров витрины, доставки и платежей
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Данные точки */}
        <div className="card p-5 space-y-3.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Основная информация</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Название магазина *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мини-маркет «Байсал»"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Фактический адрес
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="г. Бишкек, ул. Киевская 120"
              className="input-field"
            />
          </div>
        </div>

        {/* Настройки доставки */}
        <div className="card p-5 space-y-3.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Условия доставки</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Радиус (км)
              </label>
              <input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                min="0"
                step="0.5"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Базовая плата (сом)
              </label>
              <input
                type="number"
                value={baseFee}
                onChange={(e) => setBaseFee(e.target.value)}
                min="0"
                step="1"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                За 1 км (сом)
              </label>
              <input
                type="number"
                value={perKmFee}
                onChange={(e) => setPerKmFee(e.target.value)}
                min="0"
                step="1"
                className="input-field"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Формула расчёта: Базовая плата + (За км × расстояние). Если доставка фиксированная, поставьте «За 1 км» равным 0.
          </p>
        </div>

        {/* Оплата */}
        <div className="card p-5 space-y-3.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Приём платежей</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Номер телефона MBANK / Элкарт
            </label>
            <input
              type="text"
              value={mbankPhone}
              onChange={(e) => setMbankPhone(e.target.value)}
              placeholder="0555 123 456"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Прямая ссылка на QR-код (URL картинки)
            </label>
            <input
              type="url"
              value={qrCodeUrl}
              onChange={(e) => setQrCodeUrl(e.target.value)}
              placeholder="https://storage.yoursite.com/qr.png"
              className="input-field"
            />
          </div>
        </div>

        {/* Telegram Chat ID владельца */}
        <div className="card p-5 space-y-3.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Уведомления в Telegram</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ваш Telegram Chat ID (для получения новых заказов)
            </label>
            <input
              type="text"
              value={ownerChatId}
              onChange={(e) => setOwnerChatId(e.target.value)}
              placeholder="Например: 123456789"
              className="input-field font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Узнать свой ID можно через бота @userinfobot в Telegram. Обязательно отправьте команду /start своему боту магазина, чтобы он мог присылать вам сообщения.
            </p>
          </div>
        </div>

        {/* Кнопка сохранения */}
        <button
          type="submit"
          disabled={saving}
          className="btn-brand w-full flex items-center justify-center gap-2 py-3 shadow-md"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Сохранить настройки</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}