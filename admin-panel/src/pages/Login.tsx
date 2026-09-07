import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-admin-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-admin-100 shadow-sm">
            <Shield className="w-7 h-7 text-admin" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Appkel Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Вход для администраторов платформы</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@appkel.kg"
              required
              autoFocus
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input-field"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-admin w-full flex items-center justify-center gap-2 py-2.5">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Вход...</> : 'Войти в панель'}
          </button>
        </form>
      </div>
    </div>
  );
}