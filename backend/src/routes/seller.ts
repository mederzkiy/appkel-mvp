import { Router } from 'express';
import * as authModule from '../middleware/auth.js';
import {
  getSellerStore,
  updateSellerStore,
  uploadStoreQrCode,
  getStoreStats,
  getSellerOrders,
  updateOrderStatus,
  getSellerCatalog,
  toggleSellerCatalogItem,
  sendPushCampaign,
} from '../controllers/seller.js';

const router = Router();

// Определяем мидлвар авторизации продавца
const sellerAuth = (authModule as any).requireSellerAuth || (authModule as any).requireAuth || ((req: any, res: any, next: any) => next());
router.use(sellerAuth());

// Профиль магазина и загрузка QR
router.get('/store', getSellerStore);
router.put('/store', updateSellerStore);
router.post('/store/upload-qr', uploadStoreQrCode);

// Аналитика дашборда
router.get('/stats', getStoreStats);

// Заказы
router.get('/orders', getSellerOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);

// Каталог
router.get('/catalog', getSellerCatalog);
router.post('/catalog/toggle', toggleSellerCatalogItem);
router.post('/catalog/custom', createCustomProduct);

// Рассылка
router.post('/push-campaign', sendPushCampaign);

export const sellerRouter = router;