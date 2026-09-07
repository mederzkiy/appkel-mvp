import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

// Сервисный клиент (обходит RLS — для ботов, админки и верификации)
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Создание клиента с контекстом пользователя (RLS применяется автоматически)
export function createUserClient(jwt: string): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}