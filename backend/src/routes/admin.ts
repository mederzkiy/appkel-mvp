import { Router } from 'express';
import { requireAdminAuth } from '../middleware/admin-auth.js';
import {
  getPlatformMetrics,
  getStoresList,
  updateStoreByAdmin,
  getGlobalProducts,
  createGlobalProduct,
  updateGlobalProduct,
  getCategoriesList,
  createCategory,
} from '../controllers/admin.js';

const router = Router();
router.use(requireAdminAuth);

router.get('/metrics', getPlatformMetrics);
router.get('/stores', getStoresList);
router.patch('/stores/:id', updateStoreByAdmin);

router.get('/global-products', getGlobalProducts);
router.post('/global-products', createGlobalProduct);
router.patch('/global-products/:id', updateGlobalProduct); // Новый роут!

router.get('/categories', getCategoriesList);
router.post('/categories', createCategory);

export const adminRouter = router;