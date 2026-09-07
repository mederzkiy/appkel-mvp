import { useState } from 'react';
import { Copy, Check, QrCode, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { useAppStore } from '../store/app';

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export default function PaymentView() {
  const storeId = useAppStore((s) => s.storeId);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const activeOrderId = useAppStore((s) => s.activeOrderId);
  const lastOrderTotal = useAppStore((s) => s.lastOrderTotal);
  const navigate = useAppStore((s) => s.navigate);

  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const mbankPhone = storeInfo?.payment_info?.mbank_phone || '0555 000 000';
  const qrUrl = storeInfo?.payment_info?.qr_code_url;
  const shortId = activeOrderId ? activeOrderId.slice(0, 8).toUpperCase() : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(mbankPhone.replace(/\s+/g, ''));
    setCopied(true);
    tg?.HapticFeedback?.notificationOccurred('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPaid = async () => {
    if (!activeOrderId) return;
    setConfirming(true);

    try {
      await api.confirmPayment(storeId, activeOrderId);
      tg?.HapticFeedback?.notificationOccurred('success');
      navigate('order-status');
    } catch (err) {
      console.error(err);
      navigate('order-status'); // В любом случае переводим на финальный экран
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="p-4 pb-28 text-center">
      <h1 className="text-xl font-bold text-tg-text">Оплата заказа #{shortId}</h1>
      <p className="text-xs text-tg-hint mt-1 mb-6">
        Переведите точную сумму через MBANK или QR-код
      </p>

      {/* Сумма к оплате */}
      <div className="bg-tg-secondary-bg rounded-2xl p-4 mb-4">
        <span className="text-xs text-tg-hint">Сумма к переводу:</span>
        <p className="text-2xl font-black text-tg-text mt-0.5">
          {lastOrderTotal.toLocaleString('ru-RU')} сом
        </p>
      </div>

      {/* Реквизиты MBANK */}
      <div className="bg-tg-secondary-bg rounded-2xl p-4 mb-4 text-left">
        <p className="text-xs font-semibold text-tg-hint uppercase tracking-wider mb-2">
          Номер MBANK / Элкарт
        </p>
        <div className="flex items-center justify-between bg-tg-bg rounded-xl p-3">
          <span className="text-base font-bold text-tg-text tracking-wide">
            {mbankPhone}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 bg-tg-button text-tg-button-text rounded-lg active:scale-90 transition-transform flex items-center gap-1 text-xs font-medium"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>

      {/* QR-код (если загружен продавцом) */}
      {qrUrl && (
        <div className="bg-tg-secondary-bg rounded-2xl p-4 mb-4 flex flex-col items-center">
          <p className="text-xs font-semibold text-tg-hint uppercase tracking-wider mb-3">
            Или отсканируйте QR-код
          </p>
          <div className="w-44 h-44 bg-white rounded-xl p-2 shadow-sm flex items-center justify-center">
            <img src={qrUrl} alt="QR Code" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {/* Подсказка */}
      <p className="text-[11px] text-tg-hint px-4 mb-6">
        После перевода нажмите кнопку ниже. Продавец сразу увидит ваш заказ и начнёт сборку.
      </p>

      {/* Кнопка "Я оплатил(а)" */}
      <div className="fixed bottom-4 left-4 right-4 z-30">
        <button
          onClick={handleConfirmPaid}
          disabled={confirming}
          className="w-full bg-green-600 text-white py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {confirming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>Я оплатил(а) заказ</span>
        </button>
      </div>
    </div>
  );
}