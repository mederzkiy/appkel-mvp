import { Request } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';

export interface CustomerUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  status: 'active' | 'suspended';
  telegram_bot_token: string | null;
  owner_chat_id: number | null;
  delivery_radius_km: number;
  delivery_base_fee: number;
  delivery_per_km_fee: number;
  payment_info: {
    mbank_phone?: string;
    qr_code_url?: string;
    instructions?: string;
  };
  subscription_expires_at: string | null;
}

// Request от покупателя (авторизация через Telegram initData)
export interface BuyerRequest extends Request {
  customer?: CustomerUser;
  customerId?: string; // UUID в таблице customers
  storeId?: string;
}

// Request от продавца (авторизация через Supabase JWT)
export interface SellerRequest extends Request {
  user?: User;
  store?: Store;
  scopedSupabase?: SupabaseClient; // клиент с RLS продавца
}

// Request от суперадмина
export interface AdminRequest extends Request {
  user?: User;
}

export interface CreateOrderPayload {
  store_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  delivery_distance_km?: number;
  notes?: string;
  phone?: string;
}