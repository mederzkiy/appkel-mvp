import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config/env.js';

// Хранилище для процесса привязки магазина: telegram_id -> store_id
const pendingSetups = new Map<number, string>();

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
      if (!ctx.from) return;
      const payload = ctx.match;

      // СЦЕНАРИЙ 1: Регистрация продавца (setup_ID)
      if (payload.startsWith('setup_')) {
        const storeId = payload.replace('setup_', '');

        // Проверяем, что магазин существует
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id, name')
          .eq('id', storeId)
          .single();

        if (!store) {
          await ctx.reply('❌ Магазин не найден. Проверьте ссылку или обратитесь к администратору.');
          return;
        }

        // Сохраняем связку в Map (безопасно — только через deeplink)
        pendingSetups.set(ctx.from.id, storeId);
        
        const reqKeyboard = new Keyboard()
          .requestContact('📱 Подтвердить номер продавца')
          .resized()
          .oneTime();

        await ctx.reply(
          `<b>Приветствуем партнера Appkel!</b> 🏪\n\n` +
          `Магазин: <b>«${store.name}»</b>\n\n` +
          `Чтобы привязать этот аккаунт Telegram для получения уведомлений о заказах, нажмите кнопку ниже:`,
          { reply_markup: reqKeyboard, parse_mode: 'HTML' }
        );
        return;
      }

      // СЦЕНАРИЙ 2: Вход по QR магазина (store_ID)
      if (payload.startsWith('store_')) {
        const storeId = payload.replace('store_', '');
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();

        const msg = store
          ? `Добро пожаловать в <b>«${store.name}»</b>!`
          : 'Магазин найден!';

        const kb = new InlineKeyboard().webApp(
          `🛍 Открыть магазин`,
          `${config.tma.buyerUrl}?store_id=${storeId}`
        );
        await ctx.reply(msg + `\nНажмите кнопку ниже:`, {
          reply_markup: kb,
          parse_mode: 'HTML',
        });
        return;
      }

      // СЦЕНАРИЙ 3: Обычный покупатель
      const requestKeyboard = new Keyboard()
        .requestContact('📱 Поделиться номером')
        .row()
        .requestLocation('📍 Поделиться локацией')
        .resized()
        .oneTime();

      await ctx.reply(
        `Здравствуйте! 👋\nДобро пожаловать в маркетплейс Appkel.\n\nПоделитесь контактом и локацией, чтобы мы подобрали ближайшие магазины.`,
        { reply_markup: requestKeyboard }
      );
    });

    bot.on('message:contact', async (ctx) => {
      if (!ctx.from) return;
      const contact = ctx.message.contact;
      if (contact.user_id !== ctx.from.id) return;

      // Проверяем, есть ли ожидающая привязка магазина для этого продавца
      const pendingStoreId = pendingSetups.get(ctx.from.id);

      if (pendingStoreId) {
        // --- СЦЕНАРИЙ ПРОДАВЦА: привязка магазина ---
        const { error: updateError } = await supabaseAdmin
          .from('stores')
          .update({ owner_chat_id: ctx.from.id })
          .eq('id', pendingStoreId);

        if (updateError) {
          await ctx.reply('❌ Ошибка привязки магазина. Попробуйте ещё раз или обратитесь к администратору.');
          return;
        }

        // Удаляем из очереди — привязка завершена
        pendingSetups.delete(ctx.from.id);

        const sellerUrl = config.tma.sellerUrl;
        const kb = new InlineKeyboard().webApp(`⚙️ Управление магазином`, sellerUrl);

        await ctx.reply(
          `✅ Магазин успешно привязан к вашему аккаунту Telegram!\n` +
          `Телефон: ${contact.phone_number}\n\n` +
          `Теперь вы будете получать сюда чеки заказов.\n` +
          `Отправьте геолокацию вашего магазина для настройки доставки.`,
          { reply_markup: kb }
        );
        return;
      }

      // --- СЦЕНАРИЙ ПОКУПАТЕЛЯ ---
      await supabaseAdmin.from('buyers').upsert({
        telegram_id: ctx.from.id.toString(),
        phone: contact.phone_number,
        first_name: ctx.from.first_name,
        username: ctx.from.username,
      });

      await ctx.reply(
        '✅ Контакт сохранен! Теперь нажмите кнопку отправки локации, чтобы найти ближайшие магазины.'
      );
    });

    bot.on('message:location', async (ctx) => {
      if (!ctx.from) return;
      const loc = ctx.message.location;

      // Проверяем, является ли отправитель владельцем магазина
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('owner_chat_id', ctx.from.id)
        .single();

      if (store) {
        await supabaseAdmin
          .from('stores')
          .update({ latitude: loc.latitude, longitude: loc.longitude })
          .eq('id', store.id);

        await ctx.reply('✅ Координаты вашего магазина успешно сохранены!', {
          reply_markup: { remove_keyboard: true },
        });
      }

      // Сохраняем локацию покупателя в любом случае
      await supabaseAdmin.from('buyers').upsert({
        telegram_id: ctx.from.id.toString(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        first_name: ctx.from.first_name,
        username: ctx.from.username,
      });

      if (!store) {
        await ctx.reply('✅ Локация сохранена!', {
          reply_markup: { remove_keyboard: true },
        });
        const kb = new InlineKeyboard().webApp(
          `🛍 Открыть маркетплейс`,
          config.tma.buyerUrl
        );
        await ctx.reply('Вход в приложение:', { reply_markup: kb });
      }
    });

    bot.start({
      onStart: (info) =>
        console.log(`[BotManager] Бот @${info.username} запущен`),
    });
  }

  async startBot(storeId?: string, token?: string, storeName?: string) {
    return true;
  }
  async stopBot(storeId?: string) {}
  isBotOnline(storeId?: string) {
    return this.mainBot !== null;
  }

  async notifyStoreOwner(storeId: string, message: string) {
    if (!this.mainBot) return;
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('owner_chat_id')
      .eq('id', storeId)
      .single();
    if (store?.owner_chat_id)
      await this.mainBot.api
        .sendMessage(store.owner_chat_id, message, { parse_mode: 'HTML' })
        .catch(() => null);
  }

  async notifyCustomer(storeId: string, tgId: number, msg: string) {
    if (this.mainBot)
      await this.mainBot.api
        .sendMessage(tgId, msg, { parse_mode: 'HTML' })
        .catch(() => null);
  }

  async broadcast(storeId: string, tgIds: number[], msg: string) {
    if (!this.mainBot) throw new Error('Бот оффлайн');
    let sent = 0,
      failed = 0;
    for (const tgId of tgIds) {
      try {
        await this.mainBot.api.sendMessage(tgId, msg);
        sent++;
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return { sent, failed };
  }
}

export const botManager = new BotManager();