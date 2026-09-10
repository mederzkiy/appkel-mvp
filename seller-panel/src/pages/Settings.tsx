import React, { useEffect, useState } from 'react';
import { Loader2, Save, Upload, QrCode, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../api/client';
import { useUIStore } from '../store/ui';

interface StoreData {
  name: string;
  address: string;
  delivery_radius_km: number;
  delivery_base_fee: number;
  delivery_per_km_fee: number;
  free_delivery_threshold?: number;
  payment_info: {
    mbank_phone?: string;
    qr_code_url?: string;
  };
  owner_chat_id: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const addToast = useUIStore((s: any) => s.addToast);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [perKmFee, setPerKmFee] = useState('');
  const [freeThreshold, setFreeThreshold] = useState('');
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
        setFreeThreshold(s.free_delivery_threshold?.toString() || '0');
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Пожалуйста, выберите файл изображения (PNG, JPG)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadingQr(true);
      try {
        const res = await apiPost<{ qr_code_url: string }>('/api/seller/store/upload-qr', {
          base64_image: base64,
          file_name: file.name,
        });
        setQrCodeUrl(res.qr_code_url);
        addToast('QR-код успешно загружен и прикреплен!', 'success');
      } catch (err: any) {
        addToast(err.message || 'Ошибка загрузки изображения', 'error');
      } finally {
        setUploadingQr(false);
      }
    };
    reader.readAsDataURL(file);
  };

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
        free_delivery_threshold: parseFloat(freeThreshold) || 0,
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
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Настройки магазина</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Конфигурация параметров витрины, условий доставки и платёжных реквизитов
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Основная информация */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Основная информация</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Название магазина *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Мини-маркет «Байсал»"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Фактический адрес точки
            </label>
            <input
              type="text"
              value={address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
              placeholder="г. Бишкек, ул. Киевская 120"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Условия доставки */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Условия доставки</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Радиус (км)
              </label>
              <input
                type="number"
                value={radiusKm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRadiusKm(e.target.value)}
                min="0"
                step="0.5"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Базовая плата (сом)
              </label>
              <input
                type="number"
                value={baseFee}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseFee(e.target.value)}
                min="0"
                step="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                За 1 км (сом)
              </label>
              <input
                type="number"
                value={perKmFee}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPerKmFee(e.target.value)}
                min="0"
                step="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Бесплатная доставка от суммы (сом)
            </label>
            <input
              type="number"
              value={freeThreshold}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreeThreshold(e.target.value)}
              min="0"
              placeholder="0 (если акции нет)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Если сумма корзины превышает это число, доставка курьером для клиента становится бесплатной (0 сом).
            </p>
          </div>
        </div>

        {/* Платёжные реквизиты и QR-код */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Приём платежей</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Номер телефона MBANK / Элкарт
            </label>
            <input
              type="text"
              value={mbankPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMbankPhone(e.target.value)}
              placeholder="0555 123 456"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              QR-код магазина (MBank / О!Деньги)
            </label>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Превью QR-кода */}
              <div className="w-24 h-24 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain p-1" />
                ) : (
                  <QrCode className="w-8 h-8 text-slate-300" />
                )}
              </div>

              <div className="space-y-2 flex-1">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95">
                  {uploadingQr ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Загрузка...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Загрузить фото QR</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingQr}
                    className="hidden"
                  />
                </label>
                {qrCodeUrl && (
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> QR-код сохранён в хранилище
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Загрузите скриншот QR-кода из приложения MBANK. Покупатели смогут сканировать его при оформлении заказа.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Chat ID */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telegram-уведомления</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ваш Telegram Chat ID (для получения алертов о заказах)
            </label>
            <input
              type="text"
              value={ownerChatId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOwnerChatId(e.target.value)}
              placeholder="Например: 123456789"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Узнайте свой ID через бота @userinfobot в Telegram и отправьте команду /start главному боту, чтобы получать мгновенные чеки заказов.
            </p>
          </div>
        </div>

        {/* Кнопка отправки */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Сохранение настроек...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Сохранить изменения</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}