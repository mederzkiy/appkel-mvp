"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const manager_js_1 = require("./bot/manager.js");
async function bootstrap() {
    try {
        console.log('[Bootstrap] Запуск сервисов Appkel...');
        // 1. Инициализация всех активных Telegram ботов магазинов
        await manager_js_1.botManager.init();
        // 2. Старт HTTP сервера
        app_js_1.app.listen(env_js_1.config.port, () => {
            console.log(`🚀 Сервер запущен на http://localhost:${env_js_1.config.port}`);
            console.log(`📡 Окружение: ${env_js_1.config.nodeEnv}`);
        });
    }
    catch (err) {
        console.error('[Bootstrap Failed]:', err);
        process.exit(1);
    }
}
bootstrap();
