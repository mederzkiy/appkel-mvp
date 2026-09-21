"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botManager = void 0;
const grammy_1 = require("grammy");
const supabase_js_1 = require("../lib/supabase.js");
const env_js_1 = require("../config/env.js");
const pendingSetups = new Map();
class BotManager {
    mainBot = null;
    async init() {
        console.log('[BotManager] Запуск Единого Telegram-бота...');
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token)
            return console.error('Нет токена бота');
        await this.startMainBot(token);
    }
    async startMainBot(token) {
        this.mainBot = new grammy_1.Bot(token);
        const bot = this.mainBot;
        // ===================== /start =====================
        bot.command('start', async (ctx) => {
            if (!ctx.from)
                return;
            const payload = ctx.match;
            // СЦЕНАРИЙ 1: Регистрация продавца (/start setup_<store_id>)
            if (payload.startsWith('setup_')) {
                const storeId = payload.replace('setup_', '');
                const { data: store } = await supabase_js_1.supabaseAdmin
                    .from('stores')
                    .select('id, name')
                    .eq('id', storeId)
                    .single();
                if (!store) {
                    await ctx.reply('❌ Магазин не найден. Проверьте ссылку или обратитесь к администратору.');
                    return;
                }
                // Сохраняем стейт: ждём контакт
                pendingSetups.set(ctx.from.id, {
                    storeId,
                    stage: 'contact_pending',
                });
                const kb = new grammy_1.Keyboard()
                    .requestContact('📱 Подтвердить номер продавца')
                    .resized()
                    .oneTime();
                await ctx.reply(`<b>Приветствуем партнера Appkel!</b> 🏪\n\n` +
                    `Магазин: <b>«${store.name}»</b>\n\n` +
                    `<b>Шаг 1 из 2:</b> Нажмите кнопку ниже, чтобы подтвердить номер телефона.`, { reply_markup: kb, parse_mode: 'HTML' });
                return;
            }
            // СЦЕНАРИЙ 2: Покупатель входит по QR магазина (/start store_<id>)
            if (payload.startsWith('store_')) {
                const storeId = payload.replace('store_', '');
                const { data: store } = await supabase_js_1.supabaseAdmin
                    .from('stores')
                    .select('name')
                    .eq('id', storeId)
                    .single();
                const msg = store
                    ? `Добро пожаловать в <b>«${store.name}»</b>!`
                    : 'Магазин найден!';
                const kb = new grammy_1.InlineKeyboard().webApp('🛍 Открыть магазин', `${env_js_1.config.tma.buyerUrl}?store_id=${storeId}`);
                await ctx.reply(msg + '\nНажмите кнопку ниже:', {
                    reply_markup: kb,
                    parse_mode: 'HTML',
                });
                return;
            }
            // СЦЕНАРИЙ 3: Обычный покупатель (без payload)
            const kb = new grammy_1.Keyboard()
                .requestContact('📱 Поделиться номером')
                .row()
                .requestLocation('📍 Поделиться локацией')
                .resized()
                .oneTime();
            await ctx.reply('Здравствуйте! 👋\nДобро пожаловать в маркетплейс Appkel.\n\nПоделитесь контактом и локацией, чтобы мы подобрали ближайшие магазины.', { reply_markup: kb });
        });
        // ===================== Контакт =====================
        bot.on('message:contact', async (ctx) => {
            if (!ctx.from)
                return;
            const contact = ctx.message.contact;
            if (contact.user_id !== ctx.from.id)
                return;
            const pending = pendingSetups.get(ctx.from.id);
            // --- СЦЕНАРИЙ ПРОДАВЦА: контакт получен, запрашиваем локацию ---
            if (pending && pending.stage === 'contact_pending') {
                // Переводим в следующий стейт
                pending.phone = contact.phone_number;
                pending.stage = 'location_pending';
                pendingSetups.set(ctx.from.id, pending);
                const kb = new grammy_1.Keyboard()
                    .requestLocation('📍 Отправить геолокацию магазина')
                    .resized()
                    .oneTime();
                await ctx.reply(`✅ Телефон подтверждён: ${contact.phone_number}\n\n` +
                    `<b>Шаг 2 из 2:</b> Теперь отправьте геолокацию вашего магазина для настройки зоны доставки.`, { reply_markup: kb, parse_mode: 'HTML' });
                return;
            }
            // --- СЦЕНАРИЙ ПОКУПАТЕЛЯ ---
            await supabase_js_1.supabaseAdmin.from('buyers').upsert({
                telegram_id: ctx.from.id.toString(),
                phone: contact.phone_number,
                first_name: ctx.from.first_name,
                username: ctx.from.username,
            });
            await ctx.reply('✅ Контакт сохранен! Теперь нажмите кнопку отправки локации, чтобы найти ближайшие магазины.');
        });
        // ===================== Локация =====================
        bot.on('message:location', async (ctx) => {
            if (!ctx.from)
                return;
            const loc = ctx.message.location;
            const pending = pendingSetups.get(ctx.from.id);
            // --- СЦЕНАРИЙ ПРОДАВЦА: локация получена, завершаем привязку ---
            if (pending && pending.stage === 'location_pending') {
                const { error: updateError } = await supabase_js_1.supabaseAdmin
                    .from('stores')
                    .update({
                    owner_chat_id: ctx.from.id,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                })
                    .eq('id', pending.storeId);
                if (updateError) {
                    await ctx.reply('❌ Ошибка привязки магазина. Попробуйте ещё раз.');
                    return;
                }
                // Очищаем стейт — онбординг завершён
                pendingSetups.delete(ctx.from.id);
                const kb = new grammy_1.InlineKeyboard().webApp('⚙️ Управление магазином', env_js_1.config.tma.sellerUrl);
                await ctx.reply('✅ <b>Магазин успешно настроен!</b>\n\n' +
                    `📱 Телефон: ${pending.phone}\n` +
                    `📍 Координаты сохранены\n\n` +
                    'Теперь вы будете получать уведомления о заказах прямо сюда.\n' +
                    'Нажмите кнопку ниже, чтобы открыть панель управления:', { reply_markup: kb, parse_mode: 'HTML' });
                return;
            }
            // --- СЦЕНАРИЙ ПОКУПАТЕЛЯ / ОБНОВЛЕНИЕ ЛОКАЦИИ ВЛАДЕЛЬЦА ---
            // Проверяем, является ли отправитель владельцем магазина
            const { data: store } = await supabase_js_1.supabaseAdmin
                .from('stores')
                .select('id')
                .eq('owner_chat_id', ctx.from.id)
                .single();
            if (store) {
                await supabase_js_1.supabaseAdmin
                    .from('stores')
                    .update({ latitude: loc.latitude, longitude: loc.longitude })
                    .eq('id', store.id);
                await ctx.reply('✅ Координаты вашего магазина обновлены!', {
                    reply_markup: { remove_keyboard: true },
                });
                return;
            }
            // Обычный покупатель — сохраняем его локацию
            await supabase_js_1.supabaseAdmin.from('buyers').upsert({
                telegram_id: ctx.from.id.toString(),
                latitude: loc.latitude,
                longitude: loc.longitude,
                first_name: ctx.from.first_name,
                username: ctx.from.username,
            });
            await ctx.reply('✅ Локация сохранена!', {
                reply_markup: { remove_keyboard: true },
            });
            const buyerKb = new grammy_1.InlineKeyboard().webApp('🛍 Открыть маркетплейс', env_js_1.config.tma.buyerUrl);
            await ctx.reply('Вход в приложение:', { reply_markup: buyerKb });
        });
        bot.start({
            onStart: (info) => console.log(`[BotManager] Бот @${info.username} запущен`),
        });
    }
    async startBot(storeId, token, storeName) {
        return true;
    }
    async stopBot(storeId) { }
    isBotOnline(storeId) {
        return this.mainBot !== null;
    }
    async notifyStoreOwner(storeId, message) {
        if (!this.mainBot)
            return;
        const { data: store } = await supabase_js_1.supabaseAdmin
            .from('stores')
            .select('owner_chat_id')
            .eq('id', storeId)
            .single();
        if (store?.owner_chat_id)
            await this.mainBot.api
                .sendMessage(store.owner_chat_id, message, { parse_mode: 'HTML' })
                .catch(() => null);
    }
    async notifyCustomer(storeId, tgId, msg) {
        if (this.mainBot)
            await this.mainBot.api
                .sendMessage(tgId, msg, { parse_mode: 'HTML' })
                .catch(() => null);
    }
    async broadcast(storeId, tgIds, msg) {
        if (!this.mainBot)
            throw new Error('Бот оффлайн');
        let sent = 0, failed = 0;
        for (const tgId of tgIds) {
            try {
                await this.mainBot.api.sendMessage(tgId, msg);
                sent++;
            }
            catch {
                failed++;
            }
            await new Promise((r) => setTimeout(r, 50));
        }
        return { sent, failed };
    }
}
exports.botManager = new BotManager();
