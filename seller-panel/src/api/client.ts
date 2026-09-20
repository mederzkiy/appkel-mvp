/// <reference types="vite/client" />

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Получаем initData из Telegram WebApp.
 * Если TMA недоступно (десктоп, dev-режим) — вернём пустую строку,
 * и бэкенд ответит 401.
 */
function getTmaInitData(): string {
  try {
    return window.Telegram?.WebApp?.initData || '';
  } catch {
    return '';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * Клиент API для панели продавца.
 * Авторизация через Telegram Mini App initData (заголовок: Authorization: tma <initData>).
 */
export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const initData = getTmaInitData();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `tma ${initData}`,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || `Ошибка сервера: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return data as T;
}

export const apiGet = <T>(url: string) => api<T>(url);
export const apiPost = <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body });
export const apiPatch = <T>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body });
export const apiPut = <T>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body });