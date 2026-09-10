import { Router } from 'express';
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
  getUsersList,
  createStore,
  deleteStore
} from '../controllers/admin.js';

const router = Router();
router.use(requireSuperAdminAuth);

router.get('/metrics', getPlatformMetrics);
router.get('/users', getUsersList);

router.get('/stores', getStoresList);
router.post('/stores', createStore);
router.patch('/stores/:id', updateStoreByAdmin);
router.post('/stores/:id/delete', deleteStore); // Используем POST для удаления, чтобы не конфликтовать со старым клиентом

router.get('/global-products', getGlobalProducts);
router.post('/global-products', createGlobalProduct);
router.patch('/global-products/:id', updateGlobalProduct);

router.get('/categories', getCategoriesList);
router.post('/categories', createCategory);

export const adminRouter = router;