import { Router } from 'express';
import { requireTmaAuth } from '../middleware/auth.js';
import {
  getStoreInfo,
  getStoreCatalog,
  createOrder,
  confirmPayment,
  getMyOrders,
} from '../controllers/buyer.js';

const router = Router();

// === ПУБЛИЧНЫЕ ЭНДПОИНТЫ ===
// Позволяют просматривать меню и информацию о магазине из обычного браузера
router.get('/stores/:storeId/info', getStoreInfo);
router.get('/stores/:storeId/catalog', getStoreCatalog);

// === ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ ===
// Все маршруты ниже требуют авторизации через Telegram Mini App
router.use(requireTmaAuth());

router.post('/orders', createOrder);
router.post('/orders/:orderId/confirm-payment', confirmPayment);
router.get('/orders', getMyOrders);

export const buyerRouter = router;