"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyerRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const buyer_js_1 = require("../controllers/buyer.js");
const router = (0, express_1.Router)();
// === ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ ===
router.use((0, auth_js_1.requireTmaAuth)());
router.get('/stores/:storeId/info', buyer_js_1.getStoreInfo);
router.get('/stores/:storeId/catalog', buyer_js_1.getStoreCatalog);
router.get('/stores/nearby', buyer_js_1.getNearbyStores);
router.post('/orders', buyer_js_1.createOrder);
router.post('/orders/:orderId/confirm-payment', buyer_js_1.confirmPayment);
router.get('/orders', buyer_js_1.getMyOrders);
exports.buyerRouter = router;
