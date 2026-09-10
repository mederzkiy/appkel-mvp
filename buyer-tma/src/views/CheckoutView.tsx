import { useState } from 'react';
import { Truck, Store, MapPin, Phone, MessageSquare, Loader2, QrCode, Banknote, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export default function CheckoutView() {
  const storeId = useAppStore((s) => s.storeId);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const navigate = useAppStore((s) => s.navigate);
  const setActiveOrder = useAppStore((s) => s.setActiveOrder);

  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Тарифы доставки
  const baseFee = Number(storeInfo?.delivery_base_fee || 0);
  const perKmFee = Number(storeInfo?.delivery_per_km_fee || 0);
  const maxRadius = Number(storeInfo?.delivery_radius_km || 5);
  const freeThreshold = Number(storeInfo?.free_delivery_threshold || 0);

  // Расчет бесплатной доставки
  const isFreeDelivery = deliveryType === 'delivery' && freeThreshold > 0 && subtotal >= freeThreshold;
  const deliveryFee = deliveryType === 'delivery' ? (isFreeDelivery ? 0 : baseFee + distanceKm * perKmFee) : 0;
  const totalAmount = subtotal + deliveryFee;

  const handleSubmit = async () => {
    if (deliveryType === 'delivery' && !address.trim()) {
      setError('Пожалуйста, укажите адрес доставки');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderPayload: any = {
        store_id: storeId,
        items: Object.values(items).map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? address.trim() : undefined,
        delivery_distance_km: deliveryType === 'delivery' ? distanceKm : undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_method: paymentMethod,
      };

      const res = await api.createOrder(storeId, orderPayload);
      tg?.HapticFeedback?.notificationOccurred('success');

      setActiveOrder(res.order_id, res.total_amount);
      navigate('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при оформлении заказа');
      tg?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-32">
      <h1 className="text-xl font-bold text-tg-text mb-4">Оформление заказа</h1>

      {/* Баннер условий бесплатной доставки */}
      {freeThreshold > 0 && deliveryType === 'delivery' && (
        <div className={`mb-4 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
          isFreeDelivery 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
            : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
        }`}>
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          {isFreeDelivery ? (
            <span>Поздравляем! Вам доступна <b>бесплатная доставка</b>.</span>
          ) : (
            <span>Закажите еще на <b>{(freeThreshold - subtotal).toLocaleString('ru-RU')} сом</b> для бесплатной доставки!</span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Контактный телефон */}
        <div>
          <label className="block text-xs font-medium text-tg-hint mb-1">
            Номер телефона для связи
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-tg-hint absolute left-3 top-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0555 123 456"
              className="w-full bg-tg-secondary-bg text-tg-text pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Адрес доставки (если выбрана доставка) */}
        {deliveryType === 'delivery' && (
          <>
            <div>
              <label className="block text-xs font-medium text-tg-hint mb-1">
                Адрес доставки (улица, дом, кв.) *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-tg-hint absolute left-3 top-3" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ул. Киевская 120, кв. 45"
                  className="w-full bg-tg-secondary-bg text-tg-text pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Слайдер расстояния */}
            <div className="bg-tg-secondary-bg p-3 rounded-xl">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-tg-hint">Примерное расстояние:</span>
                <span className="font-bold text-tg-text">{distanceKm} км</span>
              </div>
              <input
                type="range"
                min="0.5"
                max={maxRadius}
                step="0.5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
                className="w-full accent-tg-button cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-tg-hint mt-1">
                <span>0.5 км</span>
                <span>Макс. {maxRadius} км</span>
              </div>
            </div>
          </>
        )}

        {/* Комментарий к заказу */}
        <div>
          <label className="block text-xs font-medium text-tg-hint mb-1">
            Комментарий к заказу
          </label>
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-tg-hint absolute left-3 top-3" />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Код домофона, ориентир или пожелания"
              className="w-full bg-tg-secondary-bg text-tg-text pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Способ оплаты */}
        <div className="pt-2">
          <label className="block text-xs font-medium text-tg-hint mb-1.5">
            Способ оплаты
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('qr')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'qr'
                  ? 'bg-tg-button text-tg-button-text border-transparent shadow-sm'
                  : 'bg-tg-secondary-bg text-tg-text border-transparent'
              }`}
            >
              <QrCode className="w-4 h-4" /> QR-перевод
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'cash'
                  ? 'bg-tg-button text-tg-button-text border-transparent shadow-sm'
                  : 'bg-tg-secondary-bg text-tg-text border-transparent'
              }`}
            >
              <Banknote className="w-4 h-4" /> Наличными
            </button>
          </div>
        </div>

        {/* Переключатель Доставка / Самовывоз (перенесен вниз) */}
        <div className="pt-2">
          <label className="block text-xs font-medium text-tg-hint mb-1.5">
            Способ получения
          </label>
          <div className="grid grid-cols-2 gap-2 bg-tg-secondary-bg p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                deliveryType === 'delivery'
                  ? 'bg-tg-button text-tg-button-text shadow-sm'
                  : 'text-tg-hint'
              }`}
            >
              <Truck className="w-4 h-4" /> Доставка
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                deliveryType === 'pickup'
                  ? 'bg-tg-button text-tg-button-text shadow-sm'
                  : 'text-tg-hint'
              }`}
            >
              <Store className="w-4 h-4" /> Самовывоз
            </button>
          </div>
        </div>
      </div>

      {/* Детализация стоимости */}
      <div className="mt-5 bg-tg-secondary-bg rounded-2xl p-4 space-y-2 text-xs">
        <div className="flex justify-between text-tg-hint">
          <span>Сумма товаров:</span>
          <span className="text-tg-text font-medium">{subtotal.toLocaleString('ru-RU')} сом</span>
        </div>
        {deliveryType === 'delivery' && (
          <div className="flex justify-between text-tg-hint">
            <span>Доставка ({distanceKm} км):</span>
            <span className={`font-medium ${isFreeDelivery ? 'text-emerald-500 font-bold' : 'text-tg-text'}`}>
              {isFreeDelivery ? 'Бесплатно' : `${deliveryFee.toLocaleString('ru-RU')} сом`}
            </span>
          </div>
        )}
        <div className="pt-2 border-t border-tg-bg flex justify-between text-sm font-bold text-tg-text">
          <span>Итого к оплате:</span>
          <span>{totalAmount.toLocaleString('ru-RU')} сом</span>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500 text-center font-medium">{error}</p>
      )}

      {/* Кнопка подтверждения */}
      <div className="fixed bottom-4 left-4 right-4 z-30">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-tg-button text-tg-button-text py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Создание заказа...</span>
            </>
          ) : (
            <span>Перейти к оплате • {totalAmount.toLocaleString('ru-RU')} сом</span>
          )}
        </button>
      </div>
    </div>
  );
}