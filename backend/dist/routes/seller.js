"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sellerRouter = void 0;
const express_1 = require("express");
const seller_auth_js_1 = require("../middleware/seller-auth.js");
const seller_js_1 = require("../controllers/seller.js");
const router = (0, express_1.Router)();
router.use(seller_auth_js_1.requireSellerAuth);
router.get('/store', seller_js_1.getSellerStore);
router.put('/store', seller_js_1.updateSellerStore);
router.post('/store/upload-qr', seller_js_1.uploadStoreQrCode);
router.get('/stats', seller_js_1.getStoreStats);
router.get('/orders', seller_js_1.getSellerOrders);
router.patch('/orders/:orderId/status', seller_js_1.updateOrderStatus);
router.get('/catalog', seller_js_1.getSellerCatalog);
router.post('/catalog/toggle', seller_js_1.toggleSellerCatalogItem);
router.post('/catalog/custom', seller_js_1.createCustomProduct); // <- Добавлено
router.post('/push-campaign', seller_js_1.sendPushCampaign);
exports.sellerRouter = router;
