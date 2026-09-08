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

    // Надежно отрезаем слово Bearer и убираем любые случайные пробелы по краям
    const token = authHeader.replace('Bearer ', '').trim();

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    // Если токен не прошел проверку - отдаем ТОЧНУЮ причину во фронтенд
    if (userError || !user) {
      console.error('[Auth Error]:', userError);
      res.status(401).json({ 
        error: 'Недействительный токен', 
        details: userError?.message || 'Неизвестная ошибка Supabase'
      });
      return;
    }

    // Проверяем роль 'super_admin' в profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'super_admin') {
      res.status(403).json({ error: 'Доступ запрещён: требуются права суперадминистратора' });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    console.error('[Admin Auth Middleware Error]:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
}