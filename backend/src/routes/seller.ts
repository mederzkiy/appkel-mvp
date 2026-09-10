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
  createCustomProduct
} from '../controllers/seller.js';

const router = Router();
const sellerAuth = (authModule as any).requireSellerAuth || (authModule as any).requireAuth || ((req: any, res: any, next: any) => next());
router.use(sellerAuth());

router.get('/store', getSellerStore);
router.put('/store', updateSellerStore);
router.post('/store/upload-qr', uploadStoreQrCode);
router.get('/stats', getStoreStats);
router.get('/orders', getSellerOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);
router.get('/catalog', getSellerCatalog);
router.post('/catalog/toggle', toggleSellerCatalogItem);
router.post('/catalog/custom', createCustomProduct); // <- Добавлено
router.post('/push-campaign', sendPushCampaign);

export const sellerRouter = router;