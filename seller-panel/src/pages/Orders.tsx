import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { apiGet, apiPatch } from '../api/client';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Новый', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  processing: { label: 'Готовится', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ready: { label: 'Готов', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  delivering: { label: 'Доставляется', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  completed: { label: 'Выполнен', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  cancelled: { label: 'Отменён', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const STATUS_ACTIONS: Record<string, { label: string; next: string; icon: typeof ArrowRight }[]> = {
  new: [{ label: 'Принять заказ', next: 'processing', icon: CheckCircle2 }],
  processing: [{ label: 'Отправить / Готов', next: 'delivering', icon: Truck }],
  delivering: [{ label: 'Завершить', next: 'completed', icon: CheckCircle2 }],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const addToast = useUIStore((s) => s.addToast);

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const statusParam = filter === 'all' ? '' : `?status=${filter}`;
      const data = await apiGet<{ orders: Order[] }>(`/api/seller/orders${statusParam}`);
      setOrders(data.orders);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка загрузки заказов', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, addToast]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiPatch(`/api/seller/orders/${orderId}/status`, { status: newStatus });
      const statusLabel = STATUS_CONFIG[newStatus]?.label ?? newStatus;
      addToast(`Статус обновлён: ${statusLabel}`, 'success');
      fetchOrders();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка обновления статуса', 'error');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Заголовок и кнопка обновления */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Заказы</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {orders.length} заказ(ов)
          </p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="btn-outline flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-2 mb-4">
        {(['active', 'completed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-brand-dark text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'active' ? 'Активные' : f === 'completed' ? 'Завершённые' : 'Все'}
          </button>
        ))}
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && orders.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Нет заказов</p>
          <p className="text-xs text-slate-400 mt-1">Новые заказы появятся здесь</p>
        </div>
      )}

      {/* Список заказов */}
      {!loading && (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: Order;
  onUpdateStatus: (id: string, status: string) => void;
}) {
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
    <div className="card overflow-hidden">
      {/* Кликабельная шапка карточки */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-900">#{shortId}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.bg} ${config.color}`}>
              {config.label}
            </span>
            {order.payment_confirmed && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
                💳 Оплачен
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1 font-medium">
              {order.delivery_type === 'delivery' ? (
                <Truck className="w-3.5 h-3.5" />
              ) : (
                <MapPin className="w-3.5 h-3.5" />
              )}
              {order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}
            </span>
            {order.customer?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {order.customer.phone}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <span className="text-xs font-medium text-slate-700">{customerName}</span>
            <span className="text-base font-extrabold text-slate-900">
              {Number(order.total_amount).toLocaleString('ru-RU')} сом
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 mt-1 text-slate-400">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Раскрывающийся состав заказа */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {item.name} × {item.quantity}
                </span>
                <span className="text-slate-900 font-semibold">
                  {item.line_total.toLocaleString('ru-RU')} сом
                </span>
              </div>
            ))}
            {Number(order.delivery_fee) > 0 && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-slate-200">
                <span className="text-slate-500">Доставка</span>
                <span className="text-slate-700 font-semibold">
                  {Number(order.delivery_fee).toLocaleString('ru-RU')} сом
                </span>
              </div>
            )}
          </div>

          {order.delivery_address && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
              📍 <b>Адрес:</b> {order.delivery_address}
            </div>
          )}

          {order.notes && (
            <div className="text-xs text-amber-900 bg-amber-50 rounded-xl p-2.5">
              💬 <b>Заметка:</b> {order.notes}
            </div>
          )}

          {/* Кнопки управления */}
          {(actions.length > 0 || canCancel) && (
            <div className="flex gap-2 pt-2">
              {actions.map((action) => (
                <button
                  key={action.next}
                  onClick={() => handleAction(action.next)}
                  disabled={acting}
                  className="btn-brand flex-1 flex items-center justify-center gap-1.5"
                >
                  {acting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <action.icon className="w-4 h-4" />
                  )}
                  {action.label}
                </button>
              ))}
              {canCancel && (
                <button
                  onClick={() => handleAction('cancelled')}
                  disabled={acting}
                  className="btn-danger flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Отмена</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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