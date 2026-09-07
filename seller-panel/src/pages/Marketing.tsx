import { useState } from 'react';
import { Megaphone, Send, Loader2 } from 'lucide-react';
import { apiPost } from '../api/client';
import { useUIStore } from '../store/ui';

export default function MarketingPage() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  const handleSend = async () => {
    if (!message.trim()) {
      addToast('Введите текст рассылки', 'error');
      return;
    }

    setSending(true);
    try {
      const data = await apiPost<{
        campaign: { sent: number; failed: number; total_recipients: number };
        message: string;
      }>('/api/seller/push-campaign', { message: message.trim() });

      setLastResult({
        sent: data.campaign.sent,
        failed: data.campaign.failed,
        total: data.campaign.total_recipients,
      });

      addToast(data.message, 'success');
      setMessage('');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка отправки рассылки', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Рассылка клиентам</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Мгновенно отправьте сообщение всем вашим покупателям в Telegram через бота магазина
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-800">
          <Megaphone className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold text-sm">Текст сообщения</h2>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Например: 🥖 Свежий хлеб и выпечка только что из печи! Сегодня скидка 15% на всё до 21:00. Заказывайте!"
          rows={5}
          maxLength={1000}
          className="input-field resize-none text-sm"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {message.length} / 1000 символов
          </span>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="btn-brand flex items-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Отправка...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Отправить всем</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Результат последней кампании */}
      {lastResult && (
        <div className="card p-4 mt-4 bg-green-50 border-green-200">
          <p className="text-xs font-bold text-green-900">
            ✅ Рассылка успешно проведена
          </p>
          <div className="flex gap-4 mt-2 text-xs text-green-800 font-medium">
            <span>Доставлено: <b>{lastResult.sent}</b></span>
            {lastResult.failed > 0 && (
              <span className="text-red-600">Ошибок: <b>{lastResult.failed}</b></span>
            )}
            <span>Всего в базе: <b>{lastResult.total}</b></span>
          </div>
        </div>
      )}

      {/* Советы */}
      <div className="card p-4 mt-4 bg-slate-50 border-slate-200">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Советы по эффективным рассылкам
        </p>
        <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
          <li>✨ Используйте эмодзи в начале строк — они повышают открываемость.</li>
          <li>⏰ Отправляйте сообщения перед обедом (11:30) или ужином (17:30).</li>
          <li>💡 Предлагайте конкретную выгоду: скидка, новинки, свежий привоз.</li>
        </ul>
      </div>
    </div>
  );
}