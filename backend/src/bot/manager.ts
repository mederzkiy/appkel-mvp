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
    
    // В MVP мы можем брать токен главного бота прямо из .env
    const mainBotToken = process.env.TELEGRAM_BOT_TOKEN; 
    
    if (!mainBotToken) {
      console.error('[BotManager] Ошибка: TELEGRAM_BOT_TOKEN не найден в .env');
      return;
    }

    await this.startMainBot(mainBotToken);
  }

  /**
   * Запуск главного бота маркетплейса
   */
  private async startMainBot(token: string): Promise<void> {
    try {
      this.mainBot = new Bot(token);
      const bot = this.mainBot;

      // 1. Обработка команды /start (с поддержкой перехода по QR коду)
      bot.command('start', async (ctx) => {
        // Если клиент пришел по ссылке магазина (deep link), параметр будет в ctx.match
        const deepLinkPayload = ctx.match; 
        
        // Создаем клавиатуру для запроса данных
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
        
        // Если был передан ID магазина в ссылке, можно сохранить его в сессию (в будущем)
        if (deepLinkPayload) {
          console.log(`[BotManager] Пользователь пришел в магазин: ${deepLinkPayload}`);
        }
      });

      // 2. Обработка получения контакта (Телефона)
      bot.on('message:contact', async (ctx) => {
        const contact = ctx.message.contact;
        
        // Защита: проверяем, что пользователь отправил свой номер, а не чужой
        if (contact.user_id !== ctx.from.id) return; 

        // Записываем данные в таблицу buyers
        await supabaseAdmin.from('buyers').upsert({
          telegram_id: ctx.from.id.toString(),
          phone: contact.phone_number,
          first_name: ctx.from.first_name,
          username: ctx.from.username
        });

        await ctx.reply('✅ Номер успешно сохранен! Теперь отправьте вашу локацию.');
      });

      // 3. Обработка получения локации (Геопозиции)
      bot.on('message:location', async (ctx) => {
        const location = ctx.message.location;

        // Обновляем данные покупателя координатами
        await supabaseAdmin.from('buyers').upsert({
          telegram_id: ctx.from.id.toString(),
          latitude: location.latitude,
          longitude: location.longitude,
          first_name: ctx.from.first_name, // на случай если локацию скинули первой
          username: ctx.from.username
        });

        // Прячем системную клавиатуру
        await ctx.reply('✅ Локация сохранена! Теперь мы подберем лучшие предложения.', {
          reply_markup: { remove_keyboard: true }
        });

        // Показываем кнопку входа в Mini App
        // Передаем глобальную ссылку (Mini App сам запросит магазины по радиусу)
        const webAppUrl = config.tma.baseUrl; 
        const inlineKeyboard = new InlineKeyboard().webApp(
          `🛍 Открыть маркетплейс`,
          webAppUrl
        );

        await ctx.reply('Нажмите кнопку ниже, чтобы войти в приложение:', {
          reply_markup: inlineKeyboard
        });
      });

      // Ловим ошибки
      bot.catch((err) => {
        console.error(`[BotManager] Ошибка в главном боте:`, err);
      });

      // Запуск
      bot.start({
        onStart: (info) => {
          console.log(`[BotManager] Главный бот @${info.username} успешно запущен`);
        },
      });

    } catch (err) {
      console.error(`[BotManager] Не удалось запустить главного бота:`, err);
    }
  }

  // === Методы для связи с магазинами оставляем (они понадобятся для уведомлений) ===

  async notifyStoreOwner(storeId: string, message: string): Promise<void> {
    if (!this.mainBot) return;
    
    // Получаем Telegram ID владельца магазина
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

  async notifyCustomer(telegramUserId: number, message: string): Promise<void> {
    if (!this.mainBot) return;
    try {
      await this.mainBot.api.sendMessage(telegramUserId, message, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`[BotManager] Ошибка уведомления покупателя ${telegramUserId}:`, err);
    }
  }
}

export const botManager = new BotManager();