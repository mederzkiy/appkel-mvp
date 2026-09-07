import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { BuyerRequest, CustomerUser } from '../types/index.js';

/**
 * Валидация Telegram Mini App initData по алгоритму Telegram Web App:
 * HMAC_SHA256(data_check_string, HMAC_SHA256("WebAppData", bot_token)) === hash
 */
export function requireTmaAuth() {
  return async (req: BuyerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const storeId = (req.headers['x-store-id'] || req.query.store_id) as string;

      if (!authHeader || !authHeader.startsWith('tma ')) {
        res.status(401).json({ error: 'Необходима авторизация Telegram Mini App (tma <initData>)' });
        return;
      }

      if (!storeId) {
        res.status(400).json({ error: 'Не передан store_id (в заголовке X-Store-Id или query)' });
        return;
      }

      const initDataRaw = authHeader.slice(4);
      const urlParams = new URLSearchParams(initDataRaw);
      const hash = urlParams.get('hash');

      if (!hash) {
        res.status(401).json({ error: 'Параметр hash отсутствует в initData' });
        return;
      }

      // Достаём токен бота магазина для сверки HMAC
      const { data: store, error: storeErr } = await supabaseAdmin
        .from('stores')
        .select('telegram_bot_token')
        .eq('id', storeId)
        .single();

      if (storeErr || !store?.telegram_bot_token) {
        res.status(404).json({ error: 'Магазин или токен бота не найден' });
        return;
      }

      // Формируем data_check_string
      urlParams.delete('hash');
      const paramsArray: string[] = [];
      urlParams.forEach((val, key) => paramsArray.push(`${key}=${val}`));
      paramsArray.sort();
      const dataCheckString = paramsArray.join('\n');

      // Вычисляем HMAC
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(store.telegram_bot_token)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (calculatedHash !== hash) {
        res.status(401).json({ error: 'Подпись Telegram initData недействительна' });
        return;
      }

      // Проверяем срок годности (auth_date не старше 24 часов)
      const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        res.status(401).json({ error: 'Срок действия сессии Telegram истёк' });
        return;
      }

      // Достаём данные пользователя
      const userRaw = urlParams.get('user');
      if (!userRaw) {
        res.status(400).json({ error: 'Данные пользователя отсутствуют в initData' });
        return;
      }

      const tgUser: CustomerUser = JSON.parse(userRaw);

      // Синхронизируем покупателя в таблице customers
      const { data: customer, error: custErr } = await supabaseAdmin
        .from('customers')
        .upsert(
          {
            telegram_id: tgUser.id,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name || null,
            username: tgUser.username || null,
          },
          { onConflict: 'telegram_id' }
        )
        .select('id')
        .single();

      if (custErr || !customer) {
        res.status(500).json({ error: 'Ошибка сохранения покупателя в БД' });
        return;
      }

      // Привязываем покупателя к конкретному магазину (store_customers)
      await supabaseAdmin
        .from('store_customers')
        .upsert(
          { store_id: storeId, customer_id: customer.id },
          { onConflict: 'store_id,customer_id' }
        );

      // Передаём в запрос
      req.customer = tgUser;
      req.customerId = customer.id;
      req.storeId = storeId;

      next();
    } catch (err) {
      console.error('[TMA Auth Middleware Error]:', err);
      res.status(500).json({ error: 'Внутренняя ошибка проверки авторизации' });
    }
  };
}