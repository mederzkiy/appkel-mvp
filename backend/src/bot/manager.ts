import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config/env.js';

class BotManager {
  private mainBot: Bot | null = null;

  async init(): Promise<void> {
    console.log('[BotManager] Запуск Единого Telegram-бота...');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return console.error('Нет токена бота');
    await this.startMainBot(token);
  }

  private async startMainBot(token: string): Promise<void> {
    this.mainBot = new Bot(token);
    const bot = this.mainBot;

    bot.command('start', async (ctx) => {
      const payload = ctx.match;

      // СЦЕНАРИЙ 1: Регистрация продавца (setup_ID)
      if (payload.startsWith('setup_')) {
        const storeId = payload.replace('setup_', '');
        ctx.session = { pendingStoreSetup: storeId }; // Сохраняем в память (в реале можно через кеш, но для MVP хватит контекста)
        
        const reqKeyboard = new Keyboard().requestContact('📱 Подтвердить номер продавца').resized().oneTime();
        await ctx.reply(`<b>Приветствуем партнера Appkel!</b> 🏪\n\nЧтобы привязать этот аккаунт Telegram для получения уведомлений о заказах, нажмите кнопку ниже:`, { reply_markup: reqKeyboard, parse_mode: 'HTML' });
        // Для передачи store_id в следующие шаги, передаем его через текст
        await ctx.reply(`[Технический ID: ${storeId}]`);
        return;
      }

      // СЦЕНАРИЙ 2: Вход по QR магазина (store_ID)
      if (payload.startsWith('store_')) {
        const storeId = payload.replace('store_', '');
        const { data: store } = await supabaseAdmin.from('stores').select('name').eq('id', storeId).single();
        const msg = store ? `Добро пожаловать в <b>«${store.name}»</b>!` : 'Магазин найден!';
        const kb = new InlineKeyboard().webApp(`🛍 Открыть магазин`, `${config.tma.baseUrl}?store_id=${storeId}`);
        await ctx.reply(msg + `\nНажмите кнопку ниже:`, { reply_markup: kb, parse_mode: 'HTML' });
        return;
      }

      // СЦЕНАРИЙ 3: Обычный покупатель
      const requestKeyboard = new Keyboard().requestContact('📱 Поделиться номером').row().requestLocation('📍 Поделиться локацией').resized().oneTime();
      await ctx.reply(`Здравствуйте! 👋\nДобро пожаловать в маркетплейс Appkel.\n\nПоделитесь контактом и локацией, чтобы мы подобрали ближайшие магазины.`, { reply_markup: requestKeyboard });
    });

    bot.on('message:contact', async (ctx) => {
      const contact = ctx.message.contact;
      if (contact.user_id !== ctx.from.id) return;

      // Проверяем, есть ли выше сообщение с техническим ID (регистрация продавца)
      // В production лучше использовать сессии grammy, здесь обходимся простым сохранением
      
      await supabaseAdmin.from('buyers').upsert({
        telegram_id: ctx.from.id.toString(), phone: contact.phone_number, first_name: ctx.from.first_name, username: ctx.from.username
      });
      await ctx.reply('✅ Контакт сохранен! Теперь нажмите кнопку отправки локации (для покупателей) или отправьте гео-позицию вашего магазина (для продавцов).');
    });

    bot.on('message:location', async (ctx) => {
      const loc = ctx.message.location;

      // Ищем, не присылал ли этот юзер недавно запрос на setup. Если он владелец — обновляем магаз.
      // Для упрощения MVP: сохраняем его в покупатели с координатами в любом случае.
      await supabaseAdmin.from('buyers').upsert({
        telegram_id: ctx.from.id.toString(), latitude: loc.latitude, longitude: loc.longitude, first_name: ctx.from.first_name, username: ctx.from.username
      });

      await ctx.reply('✅ Геолокация сохранена!', { reply_markup: { remove_keyboard: true } });
      const kb = new InlineKeyboard().webApp(`🛍 Открыть маркетплейс`, config.tma.baseUrl);
      await ctx.reply('Вход в приложение:', { reply_markup: kb });
    });

    // Обработка сообщений продавца с привязкой
    bot.hears(/\[Технический ID: (.*?)\]/, async (ctx) => {
       const storeId = ctx.match[1];
       // Продавец прислал ответ (переслал или ответил на это сообщение с гео)
       await supabaseAdmin.from('stores').update({ owner_chat_id: ctx.from.id }).eq('id', storeId);
       await ctx.reply(`✅ Магазин привязан к вашему Telegram!\nПанель управления: https://appkel-seller.vercel.app`);
    });

    bot.start({ onStart: (info) => console.log(`[BotManager] Бот @${info.username} запущен`) });
  }

  async startBot() { return true; }
  async stopBot() {}
  isBotOnline() { return this.mainBot !== null; }
  
  async notifyStoreOwner(storeId: string, message: string) {
    if (!this.mainBot) return;
    const { data: store } = await supabaseAdmin.from('stores').select('owner_chat_id').eq('id', storeId).single();
    if (store?.owner_chat_id) await this.mainBot.api.sendMessage(store.owner_chat_id, message, { parse_mode: 'HTML' }).catch(()=>null);
  }

  async notifyCustomer(_s: string, tgId: number, msg: string) {
    if (this.mainBot) await this.mainBot.api.sendMessage(tgId, msg, { parse_mode: 'HTML' }).catch(()=>null);
  }

  async broadcast(_s: string, tgIds: number[], msg: string) {
    if (!this.mainBot) throw new Error('Бот оффлайн');
    let sent = 0, failed = 0;
    for (const tgId of tgIds) {
      try { await this.mainBot.api.sendMessage(tgId, msg); sent++; } catch { failed++; }
      await new Promise((r) => setTimeout(r, 50));
    }
    return { sent, failed };
  }
}
export const botManager = new BotManager();