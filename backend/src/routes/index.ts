import { Router } from 'express';
import { buyerRouter } from './buyer.js';
import { sellerRouter } from './seller.js';
import { adminRouter } from './admin.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Модульные маршруты
router.use('/', buyerRouter);
router.use('/seller', sellerRouter);
router.use('/admin', adminRouter);

export const apiRouter = router;