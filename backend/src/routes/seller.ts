import { Router } from 'express';
import { requireSellerAuth } from '../middleware/seller-auth.js';
import {
  getSellerStore,
  updateSellerStore,
  getSellerOrders,
  updateOrderStatus,
  getSellerCatalog,
  toggleSellerCatalogItem,
  sendPushCampaign,
} from '../controllers/seller.js';

const router = Router();

// Защищено Supabase Auth (JWT продавца + роль seller)
router.use(requireSellerAuth);

router.get('/store', getSellerStore);
router.put('/store', updateSellerStore);
router.get('/orders', getSellerOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);
router.get('/catalog', getSellerCatalog);
router.post('/catalog/toggle', toggleSellerCatalogItem);
router.post('/push-campaign', sendPushCampaign);

export const sellerRouter = router;