import { supabase } from '../lib/supabase';

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Требуется авторизация');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Ошибка сервера: ${res.status}`);
  }

  return data as T;
}

export const apiGet = <T>(url: string) => api<T>(url);
export const apiPost = <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body });
export const apiPatch = <T>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body });