import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config/env.js';

class BotManager {
  private mainBot: Bot | null = null;

  /**
   * Инициализация Единого бота при старте сервера
   */
  async init(): Promise<void> {
    console.log('[BotManager] Запуск Единого Telegram-бота...');
    const mainBotToken = process.env.TELEGRAM_BOT_TOKEN; 
    
    if (!mainBotToken) {
      console.error('[BotManager] Ошибка: TELEGRAM_BOT_TOKEN не найден в .env');
      return;
    }
    await this.startMainBot(mainBotToken);
  }

  private async startMainBot(token: string): Promise<void> {
    try {
      this.mainBot = new Bot(token);
      const bot = this.mainBot;

      bot.command('start', async (ctx) => {
        const deepLinkPayload = ctx.match; 
        
        const requestKeyboard = new Keyboard()
          .requestContact('📱 Поделиться номером').row()
          .requestLocation('📍 Поделиться локацией')
          .resized()
          .oneTime();

        await ctx.reply(
          `Здравствуйте, ${ctx.from?.first_name || 'дорогой клиент'}! 👋\n\n` +
          `Добро пожаловать в маркетплейс Appkel.\n` +
          `Чтобы мы могли показать ближайшие магазины и рассчитать стоимость доставки, пожалуйста, поделитесь номером телефона и вашей локацией (используйте кнопки ниже).`,
          { reply_markup: requestKeyboard }
        );
      });

      bot.on('message:contact', async (ctx) => {
        const contact = ctx.message.contact;
        if (contact.user_id !== ctx.from.id) return; 

        await supabaseAdmin.from('buyers').upsert({
          telegram_id: ctx.from.id.toString(),
          phone: contact.phone_number,
          first_name: ctx.from.first_name,
          username: ctx.from.username
        });

        await ctx.reply('✅ Номер успешно сохранен! Теперь отправьте вашу локацию.');
      });

      bot.on('message:location', async (ctx) => {
        const location = ctx.message.location;

        await supabaseAdmin.from('buyers').upsert({
          telegram_id: ctx.from.id.toString(),
          latitude: location.latitude,
          longitude: location.longitude,
          first_name: ctx.from.first_name,
          username: ctx.from.username
        });

        await ctx.reply('✅ Локация сохранена! Теперь мы подберем лучшие предложения.', {
          reply_markup: { remove_keyboard: true }
        });

        const webAppUrl = config.tma.baseUrl; 
        const inlineKeyboard = new InlineKeyboard().webApp(
          `🛍 Открыть маркетплейс`,
          webAppUrl
        );

        await ctx.reply('Нажмите кнопку ниже, чтобы войти в приложение:', {
          reply_markup: inlineKeyboard
        });
      });

      bot.catch((err) => {
        console.error(`[BotManager] Ошибка в главном боте:`, err);
      });

      bot.start({
        onStart: (info) => {
          console.log(`[BotManager] Главный бот @${info.username} успешно запущен`);
        },
      });

    } catch (err) {
      console.error(`[BotManager] Не удалось запустить главного бота:`, err);
    }
  }

  // =====================================================================
  // АДАПТЕРЫ ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ КОНТРОЛЛЕРОВ
  // =====================================================================

  async startBot(storeId: string, token: string, storeName?: string): Promise<boolean> {
    // Заглушка: бот теперь единый, отдельные запускать не нужно
    return true;
  }

  async stopBot(storeId: string): Promise<void> {
    // Заглушка: ничего не делаем
  }

  isBotOnline(storeId: string): boolean {
    // Если главный бот работает, значит всё онлайн
    return this.mainBot !== null;
  }

  async notifyStoreOwner(storeId: string, message: string): Promise<void> {
    if (!this.mainBot) return;
    
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('owner_chat_id')
      .eq('id', storeId)
      .single();

    if (store?.owner_chat_id) {
      try {
        await this.mainBot.api.sendMessage(store.owner_chat_id, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error(`[BotManager] Ошибка уведомления магазина ${storeId}:`, err);
      }
    }
  }

  // seller.ts ожидает 3 аргумента, возвращаем их
  async notifyCustomer(storeId: string, telegramUserId: number, message: string): Promise<void> {
    if (!this.mainBot) return;
    try {
      await this.mainBot.api.sendMessage(telegramUserId, message, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`[BotManager] Ошибка уведомления покупателя ${telegramUserId}:`, err);
    }
  }

  // Метод рассылки
  async broadcast(
    storeId: string,
    customerTelegramIds: number[],
    messageText: string
  ): Promise<{ sent: number; failed: number }> {
    if (!this.mainBot) throw new Error('Главный бот не запущен');

    let sent = 0;
    let failed = 0;

    for (const tgId of customerTelegramIds) {
      try {
        await this.mainBot.api.sendMessage(tgId, messageText);
        sent++;
      } catch {
        failed++;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return { sent, failed };
  }
}

export const botManager = new BotManager();