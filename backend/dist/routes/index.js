"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const buyer_js_1 = require("./buyer.js");
const seller_js_1 = require("./seller.js");
const admin_js_1 = require("./admin.js");
const router = (0, express_1.Router)();
// Health check
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Модульные маршруты: СНАЧАЛА проверяем админку и продавцов
router.use('/admin', admin_js_1.adminRouter);
router.use('/seller', seller_js_1.sellerRouter);
// И только потом пропускаем остальные запросы в buyerRouter
router.use('/', buyer_js_1.buyerRouter);
exports.apiRouter = router;
