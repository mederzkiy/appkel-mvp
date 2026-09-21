"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSellerStore = getSellerStore;
exports.updateSellerStore = updateSellerStore;
exports.uploadStoreQrCode = uploadStoreQrCode;
exports.getStoreStats = getStoreStats;
exports.getSellerOrders = getSellerOrders;
exports.updateOrderStatus = updateOrderStatus;
exports.getSellerCatalog = getSellerCatalog;
exports.toggleSellerCatalogItem = toggleSellerCatalogItem;
exports.createCustomProduct = createCustomProduct;
exports.sendPushCampaign = sendPushCampaign;
const supabase_js_1 = require("../lib/supabase.js");
const manager_js_1 = require("../bot/manager.js");
const storage_js_1 = require("../utils/storage.js");
const ALLOWED_STATUS_TRANSITIONS = {
    new: ['processing', 'cancelled'], processing: ['ready', 'delivering', 'cancelled'],
    ready: ['delivering', 'completed', 'cancelled'], delivering: ['completed', 'cancelled'],
};
async function getSellerStore(req, res) {
    res.json({ store: req.store });
}
async function updateSellerStore(req, res) {
    try {
        const store = req.store;
        const { name, address, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, free_delivery_threshold, payment_info, owner_chat_id } = req.body;
        const { data: updated, error } = await supabase_js_1.supabaseAdmin.from('stores')
            .update({ name, address, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, free_delivery_threshold: free_delivery_threshold !== undefined ? Number(free_delivery_threshold) : 0, payment_info, owner_chat_id: owner_chat_id ? parseInt(owner_chat_id, 10) : null })
            .eq('id', store.id).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ store: updated });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка обновления' });
    }
}
async function uploadStoreQrCode(req, res) {
    try {
        const store = req.store;
        const { base64_image } = req.body;
        if (!base64_image)
            return void res.status(400).json({ error: 'Отсутствует изображение' });
        const publicUrl = await (0, storage_js_1.uploadBase64Image)(base64_image, `store_${store.id}`);
        if (!publicUrl)
            return void res.status(400).json({ error: 'Неверный формат' });
        let pInfo = store.payment_info || {};
        if (typeof pInfo === 'string') {
            try {
                pInfo = JSON.parse(pInfo);
            }
            catch (e) {
                pInfo = {};
            }
        }
        await supabase_js_1.supabaseAdmin.from('stores').update({ payment_info: { ...pInfo, qr_code_url: publicUrl } }).eq('id', store.id);
        res.json({ qr_code_url: publicUrl });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function getStoreStats(req, res) {
    try {
        const store = req.store;
        const period = req.query.period || 'today';
        const dateFilter = new Date();
        if (period === 'today')
            dateFilter.setHours(0, 0, 0, 0);
        else if (period === '7d')
            dateFilter.setDate(dateFilter.getDate() - 7);
        else if (period === '30d')
            dateFilter.setDate(dateFilter.getDate() - 30);
        const { data: orders } = await supabase_js_1.supabaseAdmin.from('orders').select('total_amount, delivery_type, status').eq('store_id', store.id).gte('created_at', dateFilter.toISOString());
        const completed = (orders || []).filter((o) => o.status === 'completed');
        res.json({ total_orders: (orders || []).length, total_revenue: completed.reduce((sum, o) => sum + Number(o.total_amount), 0), deliveries_count: (orders || []).filter((o) => o.delivery_type === 'delivery').length, completed_orders: completed.length });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка статистики' });
    }
}
async function getSellerOrders(req, res) {
    try {
        const store = req.store;
        const status = req.query.status;
        let query = supabase_js_1.supabaseAdmin.from('orders').select(`*, customers(first_name, last_name, username, phone), order_items(*)`).eq('store_id', store.id).order('created_at', { ascending: false });
        if (status === 'active')
            query = query.in('status', ['new', 'processing', 'ready', 'delivering']);
        else if (status === 'completed')
            query = query.in('status', ['completed', 'cancelled']);
        else if (status)
            query = query.eq('status', status);
        const { data: orders } = await query;
        res.json({ orders: (orders || []).map((o) => ({ ...o, customer: o.customers, items: o.order_items })) });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка заказов' });
    }
}
async function updateOrderStatus(req, res) {
    try {
        const { orderId } = req.params;
        const { status: nextStatus } = req.body;
        const store = req.store;
        if (!nextStatus) {
            res.status(400).json({ error: 'Не указан новый статус' });
            return;
        }
        const { data: order } = await supabase_js_1.supabaseAdmin
            .from('orders')
            .select('id, status, customers(telegram_id)')
            .eq('id', orderId)
            .eq('store_id', store.id)
            .single();
        if (!order) {
            res.status(404).json({ error: 'Заказ не найден' });
            return;
        }
        // Валидация перехода статусов
        const currentStatus = order.status;
        const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus];
        if (!allowedNext) {
            res.status(400).json({
                error: `Заказ в статусе «${currentStatus}» не может быть изменён`,
            });
            return;
        }
        if (!allowedNext.includes(nextStatus)) {
            res.status(400).json({
                error: `Нельзя перевести заказ из «${currentStatus}» в «${nextStatus}». Доступные: ${allowedNext.join(', ')}`,
            });
            return;
        }
        await supabase_js_1.supabaseAdmin.from('orders').update({ status: nextStatus }).eq('id', orderId);
        const customerTgId = order.customers?.telegram_id;
        if (customerTgId) {
            const msgs = {
                processing: '📦 Заказ собирается.',
                ready: '✨ Заказ готов.',
                delivering: '🚚 Курьер в пути!',
                completed: '✅ Заказ завершён. Оцените покупку!',
                cancelled: '❌ Заказ отменён.',
            };
            await manager_js_1.botManager.notifyCustomer(store.id, Number(customerTgId), `<b>Заказ #${order.id.slice(0, 8).toUpperCase()}</b>\n\n${msgs[nextStatus] || ''}`);
        }
        res.json({ message: 'Ок', status: nextStatus });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка' });
    }
}
async function getSellerCatalog(req, res) {
    try {
        const store = req.store;
        // Fetch global products and categories separately to avoid foreign key ambiguity errors
        const { data: globalProducts } = await supabase_js_1.supabaseAdmin.from('global_products').select('*').order('name');
        const { data: categories } = await supabase_js_1.supabaseAdmin.from('categories').select('*');
        const catMap = new Map();
        (categories || []).forEach(c => catMap.set(c.id, c));
        const { data: storeProducts } = await supabase_js_1.supabaseAdmin.from('store_products').select('*').eq('store_id', store.id);
        const storeProdMap = new Map();
        (storeProducts || []).forEach((sp) => storeProdMap.set(sp.global_product_id, sp));
        const catalog = (globalProducts || []).map((gp) => {
            const sp = storeProdMap.get(gp.id);
            return {
                global_product_id: gp.id,
                name: gp.name,
                photo_url: gp.photo_url,
                barcode: gp.barcode,
                category: gp.category_id ? catMap.get(gp.category_id) : { name: 'Разное' },
                store_product_id: sp?.id || null,
                enabled: Boolean(sp?.is_active),
                custom_price: sp?.custom_price != null ? Number(sp.custom_price) : null,
                old_price: sp?.old_price != null ? Number(sp.old_price) : null
            };
        });
        res.json({ catalog });
    }
    catch (err) {
        console.error('getSellerCatalog error:', err);
        res.status(500).json({ error: err.message || 'Ошибка каталога' });
    }
}
async function toggleSellerCatalogItem(req, res) {
    try {
        const store = req.store;
        const { global_product_id, custom_price, old_price, is_active } = req.body;
        const finalOldPrice = old_price === null || old_price === '' || isNaN(old_price) ? null : Number(old_price);
        const { data, error } = await supabase_js_1.supabaseAdmin.from('store_products').upsert({ store_id: store.id, global_product_id, custom_price: custom_price || 0, old_price: finalOldPrice, is_active: Boolean(is_active) }, { onConflict: 'store_id,global_product_id' }).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ success: true, item: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
}
async function createCustomProduct(req, res) {
    try {
        const store = req.store;
        const { name, category_id, photo_url, price, base64_image } = req.body;
        const finalPhotoUrl = await (0, storage_js_1.resolvePhotoUrl)(base64_image, photo_url, 'products');
        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const { data: existingCat } = await supabase_js_1.supabaseAdmin.from('categories').select('id').eq('name', 'Разное').maybeSingle();
            if (existingCat) {
                finalCategoryId = existingCat.id;
            }
            else {
                const { data: newCat } = await supabase_js_1.supabaseAdmin.from('categories').insert({ name: 'Разное', sort_order: 999 }).select('id').single();
                if (newCat)
                    finalCategoryId = newCat.id;
            }
        }
        const { data: gp, error: insertError } = await supabase_js_1.supabaseAdmin.from('global_products').insert({ name: name.trim(), category_id: finalCategoryId, photo_url: finalPhotoUrl, unit: 'шт', store_id: store.id }).select('id').single();
        if (insertError) {
            console.error('Error creating custom product in global_products:', insertError);
            return void res.status(400).json({ error: 'Ошибка БД: ' + insertError.message });
        }
        await supabase_js_1.supabaseAdmin.from('store_products').insert({ store_id: store.id, global_product_id: gp.id, custom_price: price || 0, is_active: true });
        res.status(201).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка создания кастомного товара' });
    }
}
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
async function sendPushCampaign(req, res) {
    try {
        const store = req.store;
        const { message } = req.body;
        if (!message || message.trim().length > 150)
            return void res.status(400).json({ error: 'Ошибка лимита' });
        const { data: buyers } = await supabase_js_1.supabaseAdmin.from('buyers').select('telegram_id, latitude, longitude');
        const storeLat = store.latitude;
        const storeLon = store.longitude;
        const radius = store.delivery_radius_km || 1;
        let tgIds = [];
        if (storeLat && storeLon && buyers) {
            tgIds = buyers.filter((b) => {
                if (!b.latitude || !b.longitude)
                    return false;
                const dist = getDistanceFromLatLonInKm(storeLat, storeLon, b.latitude, b.longitude);
                return dist <= radius;
            }).map((b) => Number(b.telegram_id));
        }
        if (tgIds.length === 0)
            return void res.status(400).json({ error: 'Нет пользователей в радиусе доставки' });
        const result = await manager_js_1.botManager.broadcast(store.id, tgIds, message.trim());
        res.json({ message: 'Ок', sent: result.sent, failed: result.failed });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка' });
    }
}
