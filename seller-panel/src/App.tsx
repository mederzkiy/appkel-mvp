import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import OrdersPage from './pages/Orders';
import CatalogPage from './pages/Catalog';
import MarketingPage from './pages/Marketing';
import SettingsPage from './pages/Settings';

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный маршрут */}
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Защищённые маршруты панели продавца */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Редирект для всех неизвестных путей */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}