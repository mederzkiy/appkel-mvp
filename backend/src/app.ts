import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';

export const app = express();

// Мидлвары безопасности и парсинга
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Основной API роутер
app.use('/api', apiRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Эндпоинт не найден' });
});

// Глобальный обработчик ошибок
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({ error: err?.message || 'Внутренняя ошибка сервера' });
});