"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("./routes/index.js");
exports.app = (0, express_1.default)();
// Мидлвары безопасности и парсинга
exports.app.use((0, cors_1.default)({ origin: true, credentials: true }));
exports.app.use(express_1.default.json({ limit: '10mb' }));
// Основной API роутер
exports.app.use('/api', index_js_1.apiRouter);
// 404 Handler
exports.app.use((_req, res) => {
    res.status(404).json({ error: 'Эндпоинт не найден' });
});
// Глобальный обработчик ошибок
exports.app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]:', err);
    res.status(500).json({ error: err?.message || 'Внутренняя ошибка сервера' });
});
