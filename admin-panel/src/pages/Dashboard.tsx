import React, { useEffect, useState } from 'react';
import { Loader2, Store, ShoppingBag, DollarSign, Bot } from 'lucide-react';
import { apiGet } from '../api/client';
import { useUIStore } from '../store/ui';

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
  const addToast = useUIStore((s: any) => s.addToast);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiGet<{ metrics: Metrics }>('/api/admin/metrics');
        setMetrics(res.metrics);
      } catch (err: any) {
        addToast(err.message || 'Ошибка загрузки метрик', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    load();
    
    // ЭТОТ ВОЗВРАТ СПАСАЕТ ОТ ПАДЕНИЯ REACT ПРИ МИНИФИКАЦИИ VITE
    return undefined; 
  }, [addToast]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Дашборд платформы</h1>
        <p className="text-xs text-slate-500 mt-1">Общая статистика по всем магазинам</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Магазины</p>
            <p className="text-2xl font-black text-slate-900">{metrics?.total_stores || 0}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">Активных: {metrics?.active_stores || 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Telegram Боты</p>
            <p className="text-2xl font-black text-slate-900">{metrics?.live_bots || 0}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">Онлайн</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Всего заказов</p>
            <p className="text-2xl font-black text-slate-900">{metrics?.total_orders || 0}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Завершено: {metrics?.completed_orders || 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Оборот (GMV)</p>
            <p className="text-2xl font-black text-slate-900">
              {metrics?.total_gmv?.toLocaleString('ru-RU') || 0}
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Сом</p>
          </div>
        </div>
      </div>
    </div>
  );
}