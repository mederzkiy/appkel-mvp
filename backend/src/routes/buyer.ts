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

// Все эндпоинты защищены верификацией Telegram Web App initData
router.use(requireTmaAuth());

router.get('/stores/:storeId/info', getStoreInfo);
router.get('/stores/:storeId/catalog', getStoreCatalog);
router.post('/orders', createOrder);
router.post('/orders/:orderId/confirm-payment', confirmPayment);
router.get('/orders', getMyOrders);

export const buyerRouter = router;