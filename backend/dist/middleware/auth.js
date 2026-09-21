"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTmaAuth = requireTmaAuth;
const crypto_1 = __importDefault(require("crypto"));
const supabase_js_1 = require("../lib/supabase.js");
/**
 * Валидация Telegram Mini App initData по алгоритму Telegram Web App:
 * HMAC_SHA256(data_check_string, HMAC_SHA256("WebAppData", bot_token)) === hash
 */
function requireTmaAuth() {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const storeId = (req.headers['x-store-id'] || req.query.store_id);
            if (!authHeader || !authHeader.startsWith('tma ')) {
                res.status(401).json({ error: 'Необходима авторизация Telegram Mini App (tma <initData>)' });
                return;
            }
            const initDataRaw = authHeader.slice(4);
            const urlParams = new URLSearchParams(initDataRaw);
            const hash = urlParams.get('hash');
            if (!hash) {
                res.status(401).json({ error: 'Параметр hash отсутствует в initData' });
                return;
            }
            // В single-bot архитектуре используем глобальный токен
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                res.status(500).json({ error: 'Не настроен TELEGRAM_BOT_TOKEN' });
                return;
            }
            // Формируем data_check_string
            urlParams.delete('hash');
            const paramsArray = [];
            urlParams.forEach((val, key) => paramsArray.push(`${key}=${val}`));
            paramsArray.sort();
            const dataCheckString = paramsArray.join('\n');
            // Вычисляем HMAC
            const secretKey = crypto_1.default
                .createHmac('sha256', 'WebAppData')
                .update(botToken)
                .digest();
            const calculatedHash = crypto_1.default
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
            const tgUser = JSON.parse(userRaw);
            // Синхронизируем покупателя в таблице customers
            const { data: customer, error: custErr } = await supabase_js_1.supabaseAdmin
                .from('customers')
                .upsert({
                telegram_id: tgUser.id,
                first_name: tgUser.first_name,
                last_name: tgUser.last_name || null,
                username: tgUser.username || null,
            }, { onConflict: 'telegram_id' })
                .select('id')
                .single();
            if (custErr || !customer) {
                res.status(500).json({ error: 'Ошибка сохранения покупателя в БД' });
                return;
            }
            // Привязываем покупателя к конкретному магазину, только если передан storeId
            if (storeId) {
                await supabase_js_1.supabaseAdmin
                    .from('store_customers')
                    .upsert({ store_id: storeId, customer_id: customer.id }, { onConflict: 'store_id,customer_id' });
            }
            // Передаём в запрос
            req.customer = tgUser;
            req.customerId = customer.id;
            if (storeId) {
                req.storeId = storeId;
            }
            next();
        }
        catch (err) {
            console.error('[TMA Auth Middleware Error]:', err);
            res.status(500).json({ error: 'Внутренняя ошибка проверки авторизации' });
        }
    };
}
