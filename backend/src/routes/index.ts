import { Router } from 'express';
import { buyerRouter } from './buyer.js';
import { sellerRouter } from './seller.js';
import { adminRouter } from './admin.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Модульные маршруты: СНАЧАЛА проверяем админку и продавцов
router.use('/admin', adminRouter);
router.use('/seller', sellerRouter);

// И только потом пропускаем остальные запросы в buyerRouter
router.use('/', buyerRouter);

export const apiRouter = router;