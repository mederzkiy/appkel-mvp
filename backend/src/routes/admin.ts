import { Router } from 'express';
import { requireSuperAdminAuth } from '../middleware/admin-auth.js';
import {
  getPlatformMetrics,
  getStoresList,
  updateStoreByAdmin,
  getGlobalProducts,
  createGlobalProduct,
  getCategoriesList,
  createCategory,
} from '../controllers/admin.js';

const router = Router();

// Защищено Supabase Auth (JWT + роль super_admin)
router.use(requireSuperAdminAuth);

router.get('/metrics', getPlatformMetrics);
router.get('/stores', getStoresList);
router.patch('/stores/:id', updateStoreByAdmin);
router.get('/global-products', getGlobalProducts);
router.post('/global-products', createGlobalProduct);
router.get('/categories', getCategoriesList);
router.post('/categories', createCategory);

export const adminRouter = router;