/// <reference types="vite/client" />
const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
const API_BASE_URL = 'https://appkel-backend.onrender.com';

export interface StoreInfo {
  id: string;
  name: string;
  address: string;
  delivery_radius_km: number;
  delivery_base_fee: number;
  delivery_per_km_fee: number;
  free_delivery_threshold?: number; // Порог бесплатной доставки
  payment_info: {
    mbank_phone?: string;
    qr_code_url?: string;
    instructions?: string;
  };
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  old_price?: number | null;
  is_discount?: boolean;
  photo_url: string | null;
  barcode?: string | null;
  category_id?: string;
  category_name?: string;
  unit?: string;
}

export interface CreateOrderData {
  store_id: string;
  items: Array<{ product_id: string; quantity: number; }>;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  delivery_distance_km?: number;
  notes?: string;
  phone?: string;
}

async function request<T>(endpoint: string, storeId: string, options: RequestInit = {}): Promise<T> {
  const initData = tg?.initData || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `tma ${initData}`,
    'X-Store-Id': storeId,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP error ${response.status}`);
  return data as T;
}

export const api = {
  getStoreInfo: (storeId: string) =>
    request<{ store: StoreInfo }>(`/api/stores/${storeId}/info`, storeId),

  getCatalog: (storeId: string) =>
    request<{ catalog: ProductItem[] }>(`/api/stores/${storeId}/catalog`, storeId),

  createOrder: (storeId: string, payload: CreateOrderData) =>
    request<{ order_id: string; total_amount: number; subtotal: number; delivery_fee: number }>('/api/orders', storeId, { method: 'POST', body: JSON.stringify(payload) }),

  confirmPayment: (storeId: string, orderId: string) =>
    request<{ message: string; order_id: string }>(`/api/orders/${orderId}/confirm-payment`, storeId, { method: 'POST' }),

  // Вот наш новый метод, аккуратно добавленный внутрь объекта:
  getNearbyStores: () =>
    request<{ stores: (StoreInfo & { distance_km?: number })[] }>('/api/stores/nearby', ''),
};