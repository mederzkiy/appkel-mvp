import { Bot, InlineKeyboard } from 'grammy';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config/env.js';

class BotManager {
  private bots: Map<string, Bot> = new Map();

  /**
   * Инициализация ботов всех активных магазинов при старте сервера
   */
  async init(): Promise<void> {
    console.log('[BotManager] Загрузка активных ботов...');

    const { data: stores, error } = await supabaseAdmin
      .from('stores')
      .select('id, name, telegram_bot_token, status')
      .eq('status', 'active')
      .not('telegram_bot_token', 'is', null);

    if (error) {
      console.error('[BotManager] Ошибка загрузки магазинов:', error);
      return;
    }

    for (const store of stores || []) {
      if (store.telegram_bot_token) {
        await this.startBot(store.id, store.telegram_bot_token, store.name);
      }
    }

    console.log(`[BotManager] Успешно запущено ботов: ${this.bots.size}`);
  }

  /**
   * Запуск или перезапуск отдельного бота
   */
  async startBot(storeId: string, token: string, storeName?: string): Promise<boolean> {
    try {
      // Если бот уже был запущен, сначала останавливаем
      if (this.bots.has(storeId)) {
        await this.stopBot(storeId);
      }

      const bot = new Bot(token);

      // Команда /start для покупателя
      bot.command('start', async (ctx) => {
        const webAppUrl = `${config.tma.baseUrl}?store_id=${storeId}`;

        const keyboard = new InlineKeyboard().webApp(
          `🛍 Открыть ${storeName || 'магазин'}`,
          webAppUrl
        );

        await ctx.reply(
          `Здравствуйте, ${ctx.from?.first_name || 'дорогой клиент'}!\n\n` +
          `Добро пожаловать в онлайн-витрину магазина "${storeName || 'Appkel'}". ` +
          `Нажмите кнопку ниже, чтобы выбрать товары и оформить заказ:`,
          { reply_markup: keyboard }
        );
      });

      // Ловим ошибки, чтобы падение одного бота не роняло весь сервер
      bot.catch((err) => {
        console.error(`[BotManager] Ошибка в боте магазина ${storeId}:`, err);
      });

      // Запуск long polling в фоне
      bot.start({
        onStart: (info) => {
          console.log(`[BotManager] Бот @${info.username} (Store: ${storeId}) активен`);
        },
      });

      this.bots.set(storeId, bot);
      return true;
    } catch (err) {
      console.error(`[BotManager] Не удалось запустить бота для магазина ${storeId}:`, err);
      return false;
    }
  }

  /**
   * Остановка бота (при приостановке подписки магазина)
   */
  async stopBot(storeId: string): Promise<void> {
    const bot = this.bots.get(storeId);
    if (bot) {
      try {
        await bot.stop();
        this.bots.delete(storeId);
        console.log(`[BotManager] Бот магазина ${storeId} остановлен`);
      } catch (err) {
        console.error(`[BotManager] Ошибка при остановке бота ${storeId}:`, err);
      }
    }
  }

  /**
   * Проверка, запущен ли бот магазина
   */
  isBotOnline(storeId: string): boolean {
    return this.bots.has(storeId);
  }

  /**
   * Уведомление продавца о новом заказе в Telegram
   */
  async notifyStoreOwner(storeId: string, message: string): Promise<void> {
    const bot = this.bots.get(storeId);
    if (!bot) return;

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('owner_chat_id')
      .eq('id', storeId)
      .single();

    if (store?.owner_chat_id) {
      try {
        await bot.api.sendMessage(store.owner_chat_id, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error(`[BotManager] Ошибка отправки уведомления владельцу магазина ${storeId}:`, err);
      }
    }
  }

  /**
   * Уведомление покупателя об изменении статуса заказа
   */
  async notifyCustomer(storeId: string, telegramUserId: number, message: string): Promise<void> {
    const bot = this.bots.get(storeId);
    if (!bot) return;

    try {
      await bot.api.sendMessage(telegramUserId, message, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`[BotManager] Ошибка уведомления покупателя ${telegramUserId}:`, err);
    }
  }

  /**
   * Массовая рассылка (Push-кампания) по базе покупателей магазина
   */
  async broadcast(
    storeId: string,
    customerTelegramIds: number[],
    messageText: string
  ): Promise<{ sent: number; failed: number }> {
    const bot = this.bots.get(storeId);
    if (!bot) throw new Error('Бот магазина не запущен');

    let sent = 0;
    let failed = 0;

    for (const tgId of customerTelegramIds) {
      try {
        await bot.api.sendMessage(tgId, messageText);
        sent++;
      } catch {
        failed++;
      }
      // Rate limiting: пауза 50мс между сообщениями, чтобы не ловить 429 от Telegram
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return { sent, failed };
  }
}

export const botManager = new BotManager();