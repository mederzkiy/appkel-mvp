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
// Сначала ищем магазины поблизости
router.get('/stores/nearby', getNearbyStores);
// Затем инфо и каталог конкретного магазина
router.get('/stores/:storeId/info', getStoreInfo);
router.get('/stores/:storeId/catalog', getStoreCatalog);

// === ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ ===
router.use(requireTmaAuth());

router.post('/orders', createOrder);
router.post('/orders/:orderId/confirm-payment', confirmPayment);
router.get('/orders', getMyOrders);

export const buyerRouter = router;