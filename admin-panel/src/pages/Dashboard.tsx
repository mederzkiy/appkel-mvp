import { useEffect, useState } from 'react';
import { Loader2, Store, ShoppingCart, BadgeDollarSign, Wifi, TrendingUp } from 'lucide-react';
import { apiGet } from '../api/client';

interface Metrics {
  total_stores: number;
  active_stores: number;
  live_bots: number;
  total_orders: number;
  completed_orders: number;
  total_gmv: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ metrics: Metrics }>('/api/admin/metrics')
      .then((d) => setMetrics(d.metrics))
      .catch((err) => console.error('Ошибка метрик:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <p className="text-center text-xs text-slate-400 py-24">
        Не удалось загрузить метрики платформы
      </p>
    );
  }

  const cards: { label: string; value: string; sub?: string; icon: typeof Store; color: string }[] = [
    {
      label: 'Всего магазинов',
      value: metrics.total_stores.toString(),
      sub: `${metrics.active_stores} активных на платформе`,
      icon: Store,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Live боты',
      value: metrics.live_bots.toString(),
      sub: 'Запущены и онлайн сейчас',
      icon: Wifi,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Всего заказов',
      value: metrics.total_orders.toLocaleString('ru-RU'),
      sub: `${metrics.completed_orders} успешно завершено`,
      icon: ShoppingCart,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'GMV (Оборот платформы)',
      value: metrics.total_gmv.toLocaleString('ru-RU') + ' сом',
      sub: 'Общий объём заказов за всё время',
      icon: BadgeDollarSign,
      color: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-admin-50 flex items-center justify-center text-admin">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500">Сводная аналитика и ключевые показатели платформы Appkel</p>
        </div>
      </div>

      {/* Метрические карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{card.value}</p>
            {card.sub && <p className="text-[11px] text-slate-400 mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}