import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Truck,
  MapPin,
  Phone,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Send,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../api/client';
import { useUIStore } from '../store/ui';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface Order {
  id: string;
  status: string;
  delivery_type: 'pickup' | 'delivery';
  payment_method?: 'qr' | 'cash';
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  delivery_address: string | null;
  payment_confirmed: boolean;
  notes: string | null;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string | null;
    username: string | null;
    phone: string | null;
  } | null;
  items: OrderItem[];
}

interface StoreStats {
  total_orders: number;
  total_revenue: number;
  deliveries_count: number;
  completed_orders: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Новый', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  processing: { label: 'В сборке', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ready: { label: 'Собран', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  delivering: { label: 'В пути', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  completed: { label: 'Завершён', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  cancelled: { label: 'Отменён', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const STATUS_ACTIONS: Record<string, { label: string; next: string; icon: any }[]> = {
  new: [{ label: 'Начать сборку', next: 'processing', icon: Package }],
  processing: [{ label: 'Передать в доставку', next: 'delivering', icon: Truck }],
  delivering: [{ label: 'Завершить заказ', next: 'completed', icon: CheckCircle2 }],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

  const [broadcastText, setBroadcastText] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const addToast = useUIStore((s: any) => s.addToast);

  const fetchData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const statusParam = filter === 'all' ? '' : `?status=${filter}`;
        const [ordersData, statsData] = await Promise.all([
          apiGet<{ orders: Order[] }>(`/api/seller/orders${statusParam}`),
          apiGet<StoreStats>(`/api/seller/stats?period=${statsPeriod}`),
        ]);
        setOrders(ordersData.orders || []);
        setStats(statsData);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Ошибка загрузки данных', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, statsPeriod, addToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiPatch(`/api/seller/orders/${orderId}/status`, { status: newStatus });
      const statusLabel = STATUS_CONFIG[newStatus]?.label ?? newStatus;
      addToast(`Статус обновлён: ${statusLabel}`, 'success');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка обновления статуса', 'error');
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setSendingBroadcast(true);
    try {
      await apiPost('/api/seller/push-campaign', { message: broadcastText.trim() });
      addToast('Рассылка успешно запущена!', 'success');
      setBroadcastText('');
    } catch (err: any) {
      addToast(err.message || 'Ошибка отправки рассылки', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Дашборд магазина</h1>
          <p className="text-xs text-slate-500 mt-0.5">Управление заказами и показателями</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors active:scale-95"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Ключевые показатели</span>
          </div>
          <div className="flex bg-slate-800 p-0.5 rounded-xl text-[11px] font-bold">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setStatsPeriod(p)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  statsPeriod === p ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'today' ? 'Сегодня' : p === '7d' ? '7 дней' : '30 дней'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl">
            <p className="text-[11px] text-slate-400 font-medium">Выручка</p>
            <p className="text-lg font-black text-emerald-400 mt-1">
              {(stats?.total_revenue || 0).toLocaleString('ru-RU')} сом
            </p>
          </div>
          <div className="bg-slate-800/80 p-3.5 rounded-2xl">
            <p className="text-[11px] text-slate-400 font-medium">Всего заказов</p>
            <p className="text-lg font-black text-white mt-1">{stats?.total_orders || 0}</p>
          </div>
          <div className="bg-slate-800/80 p-3.5 rounded-2xl">
            <p className="text-[11px] text-slate-400 font-medium">Доставок курьером</p>
            <p className="text-lg font-black text-white mt-1">{stats?.deliveries_count || 0}</p>
          </div>
          <div className="bg-slate-800/80 p-3.5 rounded-2xl">
            <p className="text-[11px] text-slate-400 font-medium">Завершено</p>
            <p className="text-lg font-black text-blue-400 mt-1">{stats?.completed_orders || 0}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['active', 'completed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'active' ? 'Активные' : f === 'completed' ? 'Завершённые' : 'Все заказы'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-bold text-sm">Заказов пока нет</p>
          <p className="text-xs text-slate-400 mt-0.5">Входящие заказы появятся здесь в реальном времени</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
          ))}
        </div>
      )}

      {/* ПОЛНОЦЕННЫЙ БЛОК РАССЫЛКИ В САМОМ НИЗУ */}
      <div className="mt-10 bg-blue-50/70 border border-blue-200 rounded-3xl p-5 space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-blue-900 flex items-center gap-2 text-sm">
            <Send className="w-4 h-4" /> Push-рассылка покупателям
          </span>
          <span className={broadcastText.length > 150 ? 'text-red-500 font-bold' : 'text-slate-500 font-medium'}>
            {broadcastText.length} / 150 знаков
          </span>
        </div>
        <textarea
          value={broadcastText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBroadcastText(e.target.value)}
          maxLength={150}
          rows={3}
          placeholder="Скидка 15% на всю категорию напитков до конца дня! Ждем ваших заказов."
          className="w-full text-sm p-4 rounded-2xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        <div className="flex justify-between items-center text-[11px] text-blue-700">
          <span className="bg-blue-100 px-2.5 py-1 rounded-lg font-semibold">Лимит: 1 раз в сутки</span>
          <button
            onClick={handleSendBroadcast}
            disabled={sendingBroadcast || !broadcastText.trim() || broadcastText.length > 150}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            {sendingBroadcast ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendingBroadcast ? 'Отправка...' : 'Отправить всем'}
          </button>
        </div>
      </div>
    </div>
  );
}

const OrderCard: React.FC<{
  order: Order;
  onUpdateStatus: (id: string, status: string) => Promise<void> | void;
}> = ({ order, onUpdateStatus }) => {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
  const actions = STATUS_ACTIONS[order.status] ?? [];
  const shortId = order.id.slice(0, 8).toUpperCase();
  const customerName = order.customer
    ? `${order.customer.first_name}${order.customer.last_name ? ' ' + order.customer.last_name : ''}`
    : 'Покупатель';
  const timeAgo = getTimeAgo(order.created_at);
  const canCancel = ['new', 'processing', 'ready'].includes(order.status);

  const handleAction = async (nextStatus: string) => {
    setActing(true);
    await onUpdateStatus(order.id, nextStatus);
    setActing(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:border-slate-300 transition-all">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm text-slate-900">#{shortId}</span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${config.bg} ${config.color}`}>
              {config.label}
            </span>

            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
              {order.payment_method === 'cash' ? (
                <><Banknote className="w-3 h-3" /> Наличными</>
              ) : (
                <><CreditCard className="w-3 h-3 text-blue-500" /> QR-перевод</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              {order.delivery_type === 'delivery' ? <Truck className="w-3.5 h-3.5 text-blue-600" /> : <MapPin className="w-3.5 h-3.5 text-amber-600" />}
              {order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}
            </span>
            {order.customer?.phone && (
              <span className="flex items-center gap-1 font-medium">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {order.customer.phone}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" /> {timeAgo}
            </span>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs font-semibold text-slate-700">{customerName}</span>
            <span className="text-base font-black text-slate-900">
              {Number(order.total_amount).toLocaleString('ru-RU')} сом
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 mt-1 text-slate-400">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-slate-50/50">
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{item.name} × <b>{item.quantity}</b></span>
                <span className="text-slate-900 font-bold">{item.line_total.toLocaleString('ru-RU')} сом</span>
              </div>
            ))}
            {Number(order.delivery_fee) > 0 && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-slate-200">
                <span className="text-slate-500">Доставка</span>
                <span className="text-slate-700 font-semibold">{Number(order.delivery_fee).toLocaleString('ru-RU')} сом</span>
              </div>
            )}
          </div>

          {order.delivery_address && (
            <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-2xl p-2.5">
              📍 <b>Адрес:</b> {order.delivery_address}
            </div>
          )}

          {order.notes && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-2.5">
              💬 <b>Комментарий:</b> {order.notes}
            </div>
          )}

          {(actions.length > 0 || canCancel) && (
            <div className="flex gap-2 pt-2">
              {actions.map((action) => (
                <button
                  key={action.next}
                  onClick={() => handleAction(action.next)}
                  disabled={acting}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <action.icon className="w-4 h-4" />}
                  {action.label}
                </button>
              ))}
              {canCancel && (
                <button
                  onClick={() => handleAction('cancelled')}
                  disabled={acting}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <XCircle className="w-4 h-4" /> <span>Отменить</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}