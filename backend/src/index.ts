import { app } from './app.js';
import { config } from './config/env.js';
import { botManager } from './bot/manager.js';

async function bootstrap() {
  try {
    console.log('[Bootstrap] Запуск сервисов Appkel...');

    // 1. Инициализация всех активных Telegram ботов магазинов
    await botManager.init();

    // 2. Старт HTTP сервера
    app.listen(config.port, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${config.port}`);
      console.log(`📡 Окружение: ${config.nodeEnv}`);
    });
  } catch (err) {
    console.error('[Bootstrap Failed]:', err);
    process.exit(1);
  }
}

bootstrap();