import { Router } from 'express';
// Забираем мидлвар авторизации с правильным именем
import { requireSuperAdminAuth } from '../middleware/admin-auth.js';
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
router.use(requireSuperAdminAuth);

router.get('/metrics', getPlatformMetrics);
router.get('/stores', getStoresList);
router.patch('/stores/:id', updateStoreByAdmin);

router.get('/global-products', getGlobalProducts);
router.post('/global-products', createGlobalProduct);
router.patch('/global-products/:id', updateGlobalProduct);

router.get('/categories', getCategoriesList);
router.post('/categories', createCategory);

export const adminRouter = router;