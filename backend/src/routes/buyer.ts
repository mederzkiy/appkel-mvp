import { Router } from 'express';
import { requireTmaAuth } from '../middleware/auth.js';
import {
  getStoreInfo,
  getStoreCatalog,
  createOrder,
  confirmPayment,
  getMyOrders,
  getNearbyStores
} from '../controllers/buyer.js';

const router = Router();

// === ПУБЛИЧНЫЕ ЭНДПОИНТЫ ===
// Инфо и каталог конкретного магазина
router.get('/stores/:storeId/info', getStoreInfo);
router.get('/stores/:storeId/catalog', getStoreCatalog);

// === ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ ===
router.use(requireTmaAuth());

router.get('/stores/nearby', getNearbyStores);
router.post('/orders', createOrder);
router.post('/orders/:orderId/confirm-payment', confirmPayment);
router.get('/orders', getMyOrders);

export const buyerRouter = router;