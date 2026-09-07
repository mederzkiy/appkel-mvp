import { Response, NextFunction } from 'express';
import { supabaseAdmin, createUserClient } from '../lib/supabase.js';
import { SellerRequest } from '../types/index.js';

/**
 * Валидация сессии продавца по Supabase JWT (Bearer токен).
 * Проверяет роль 'seller' и права на управление своим магазином.
 */
export async function requireSellerAuth(
  req: SellerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Требуется авторизация Bearer токеном' });
      return;
    }

    const token = authHeader.slice(7);

    // Проверяем валидность токена через Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      res.status(401).json({ error: 'Недействительный или просроченный токен' });
      return;
    }

    // Проверяем роль в profiles
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || (profile?.role !== 'seller' && profile?.role !== 'super_admin')) {
      res.status(403).json({ error: 'Доступ запрещён: требуется роль продавца' });
      return;
    }

    // Находим магазин, принадлежащий этому пользователю
    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (storeErr || !store) {
      res.status(404).json({ error: 'Магазин, привязанный к вашему аккаунту, не найден' });
      return;
    }

    // Инжектируем данные и клиент со скоупом пользователя (для соблюдения RLS)
    req.user = user;
    req.store = store;
    req.scopedSupabase = createUserClient(token);

    next();
  } catch (err) {
    console.error('[Seller Auth Middleware Error]:', err);
    res.status(500).json({ error: 'Ошибка верификации сессии продавца' });
  }
}