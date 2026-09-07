import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { AdminRequest } from '../types/index.js';

/**
 * Валидация доступа суперадминистратора платформы
 */
export async function requireSuperAdminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Требуется токен авторизации' });
      return;
    }

    const token = authHeader.slice(7);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }

    // Проверяем роль 'super_admin' в profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      res.status(403).json({ error: 'Доступ запрещён: требуются права суперадминистратора' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Admin Auth Middleware Error]:', err);
    res.status(500).json({ error: 'Ошибка проверки прав суперадминистратора' });
  }
}