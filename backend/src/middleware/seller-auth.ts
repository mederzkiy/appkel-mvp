import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { SellerRequest } from '../types/index.js';

/**
 * Middleware авторизации продавца через Telegram Mini App initData.
 *
 * Протокол:
 *   Authorization: tma <initData>
 *
 * 1. Валидирует HMAC подпись через единый токен бота
 * 2. Проверяет auth_date (не старше 24 часов)
 * 3. Извлекает telegram_id из user data
 * 4. Ищет магазин с owner_chat_id == telegram_id и status == 'active'
 * 5. Если найден — кладёт store в req и пропускает
 */
export async function requireSellerAuth(
  req: SellerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('tma ')) {
      res.status(401).json({ error: 'Требуется авторизация Telegram Mini App (Authorization: tma <initData>)' });
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Токен бота не настроен на сервере' });
      return;
    }

    const initDataRaw = authHeader.slice(4);
    const urlParams = new URLSearchParams(initDataRaw);
    const hash = urlParams.get('hash');

    if (!hash) {
      res.status(401).json({ error: 'Параметр hash отсутствует в initData' });
      return;
    }

    // Формируем data_check_string
    urlParams.delete('hash');
    const paramsArray: string[] = [];
    urlParams.forEach((val, key) => paramsArray.push(`${key}=${val}`));
    paramsArray.sort();
    const dataCheckString = paramsArray.join('\n');

    // HMAC_SHA256(data_check_string, HMAC_SHA256("WebAppData", bot_token))
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
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
      res.status(401).json({ error: 'Срок действия сессии Telegram истёк (более 24 часов)' });
      return;
    }

    // Извлекаем telegram_id из user данных
    const userRaw = urlParams.get('user');
    if (!userRaw) {
      res.status(400).json({ error: 'Данные пользователя отсутствуют в initData' });
      return;
    }

    const tgUser = JSON.parse(userRaw);
    const telegramId = Number(tgUser.id);

    if (!telegramId) {
      res.status(400).json({ error: 'Не удалось определить Telegram ID' });
      return;
    }

    // Ищем магазин, привязанный к этому Telegram аккаунту
    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_chat_id', telegramId)
      .eq('status', 'active')
      .single();

    if (storeErr || !store) {
      res.status(403).json({
        error: 'Магазин не найден. Убедитесь, что вы прошли регистрацию через бот.',
      });
      return;
    }

    // Инжектируем данные в запрос
    req.telegram_id = telegramId;
    req.store = store;

    next();
  } catch (err) {
    console.error('[Seller TMA Auth Error]:', err);
    res.status(500).json({ error: 'Ошибка верификации сессии продавца' });
  }
}