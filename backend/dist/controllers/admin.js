"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformMetrics = getPlatformMetrics;
exports.getStoresList = getStoresList;
exports.updateStoreByAdmin = updateStoreByAdmin;
exports.getGlobalProducts = getGlobalProducts;
exports.createGlobalProduct = createGlobalProduct;
exports.updateGlobalProduct = updateGlobalProduct;
exports.getCategoriesList = getCategoriesList;
exports.createCategory = createCategory;
exports.getUsersList = getUsersList;
exports.createStore = createStore;
exports.deleteStore = deleteStore;
exports.deleteGlobalProduct = deleteGlobalProduct;
exports.makeProductGlobal = makeProductGlobal;
const supabase_js_1 = require("../lib/supabase.js");
const manager_js_1 = require("../bot/manager.js");
const storage_js_1 = require("../utils/storage.js");
async function getPlatformMetrics(req, res) {
    try {
        const [storesRes, ordersRes] = await Promise.all([
            supabase_js_1.supabaseAdmin.from('stores').select('id, status, telegram_bot_token'),
            supabase_js_1.supabaseAdmin.from('orders').select('status, total_amount'),
        ]);
        const stores = storesRes.data || [];
        const orders = ordersRes.data || [];
        const activeStores = stores.filter((s) => s.status === 'active').length;
        let liveBots = 0;
        stores.forEach((s) => { if (s.telegram_bot_token && manager_js_1.botManager.isBotOnline(s.id))
            liveBots++; });
        const completedOrders = orders.filter((o) => o.status === 'completed').length;
        const totalGmv = orders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        res.json({ metrics: { total_stores: stores.length, active_stores: activeStores, live_bots: liveBots, total_orders: orders.length, completed_orders: completedOrders, total_gmv: totalGmv } });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка получения метрик' });
    }
}
async function getStoresList(req, res) {
    try {
        const { data: stores, error } = await supabase_js_1.supabaseAdmin.from('stores').select('*, store_products(id)').order('created_at', { ascending: false });
        if (error)
            return void res.status(500).json({ error: error.message });
        const { data: { users } } = await supabase_js_1.supabaseAdmin.auth.admin.listUsers();
        const userEmailMap = new Map();
        (users || []).forEach((u) => { if (u.email)
            userEmailMap.set(u.id, u.email); });
        const enriched = (stores || []).map((store) => ({
            ...store,
            bot_online: manager_js_1.botManager.isBotOnline(store.id),
            owner: { email: userEmailMap.get(store.owner_id) || null },
            products_count: store.store_products?.length || 0
        }));
        // Remove the large array from the response
        enriched.forEach(s => delete s.store_products);
        res.json({ stores: enriched });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки магазинов' });
    }
}
async function updateStoreByAdmin(req, res) {
    try {
        const { id } = req.params;
        const { status, subscription_expires_at, latitude, longitude, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, payment_info } = req.body;
        const updatePayload = { status, subscription_expires_at: subscription_expires_at || null };
        if (latitude !== undefined)
            updatePayload.latitude = latitude;
        if (longitude !== undefined)
            updatePayload.longitude = longitude;
        if (delivery_radius_km !== undefined)
            updatePayload.delivery_radius_km = delivery_radius_km;
        if (delivery_base_fee !== undefined)
            updatePayload.delivery_base_fee = delivery_base_fee;
        if (delivery_per_km_fee !== undefined)
            updatePayload.delivery_per_km_fee = delivery_per_km_fee;
        if (payment_info !== undefined)
            updatePayload.payment_info = payment_info;
        const { data: updated, error } = await supabase_js_1.supabaseAdmin.from('stores').update(updatePayload).eq('id', id).select('*').single();
        if (error || !updated)
            return void res.status(400).json({ error: 'Ошибка обновления магазина' });
        if (updated.telegram_bot_token) {
            if (updated.status === 'active')
                await manager_js_1.botManager.startBot(updated.id, updated.telegram_bot_token, updated.name);
            else
                await manager_js_1.botManager.stopBot(updated.id);
        }
        res.json({ store: updated, message: 'Магазин успешно обновлён' });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
async function getGlobalProducts(req, res) {
    try {
        const { data: products, error } = await supabase_js_1.supabaseAdmin.from('global_products').select(`id, name, barcode, photo_url, unit, category_id, store_id`).order('name');
        if (error)
            return void res.status(500).json({ error: error.message });
        const { data: categories } = await supabase_js_1.supabaseAdmin.from('categories').select('id, name');
        const catMap = new Map();
        (categories || []).forEach(c => catMap.set(c.id, c));
        const { data: stores } = await supabase_js_1.supabaseAdmin.from('stores').select('id, name');
        const storeMap = new Map();
        (stores || []).forEach(s => storeMap.set(s.id, s.name));
        const enriched = (products || []).map(p => ({
            ...p,
            categories: p.category_id ? catMap.get(p.category_id) : { id: 'misc', name: 'Разное' },
            store_name: p.store_id ? storeMap.get(p.store_id) : null
        }));
        res.json({ products: enriched });
    }
    catch (err) {
        console.error('getGlobalProducts error:', err);
        res.status(500).json({ error: err.message || 'Ошибка каталога' });
    }
}
async function createGlobalProduct(req, res) {
    try {
        const { name, category_id, photo_url, barcode, unit, base64_image } = req.body;
        if (!name || !category_id)
            return void res.status(400).json({ error: 'Название и категория обязательны' });
        const finalPhotoUrl = await (0, storage_js_1.resolvePhotoUrl)(base64_image, photo_url, 'products');
        const { data: product, error } = await supabase_js_1.supabaseAdmin.from('global_products').insert({ name: name.trim(), category_id, photo_url: finalPhotoUrl, barcode: barcode ? barcode.trim() : null, unit: unit || 'шт' }).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.status(201).json({ product });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка создания товара' });
    }
}
async function updateGlobalProduct(req, res) {
    try {
        const { id } = req.params;
        const { name, category_id, photo_url, barcode, unit, base64_image } = req.body;
        const finalPhotoUrl = await (0, storage_js_1.resolvePhotoUrl)(base64_image, photo_url, 'products');
        const { data: product, error } = await supabase_js_1.supabaseAdmin.from('global_products').update({ name: name?.trim(), category_id, photo_url: finalPhotoUrl, barcode: barcode ? barcode.trim() : null, unit: unit || 'шт' }).eq('id', id).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ product });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка обновления товара' });
    }
}
async function getCategoriesList(req, res) {
    try {
        const { data: categories, error } = await supabase_js_1.supabaseAdmin.from('categories').select('*').order('sort_order', { ascending: true });
        if (error)
            return void res.status(500).json({ error: error.message });
        res.json({ categories: categories || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки категорий' });
    }
}
async function createCategory(req, res) {
    try {
        const { name, sort_order } = req.body;
        if (!name)
            return void res.status(400).json({ error: 'Имя категории обязательно' });
        const { data: category, error } = await supabase_js_1.supabaseAdmin.from('categories').insert({ name: name.trim(), sort_order: sort_order || 0 }).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.status(201).json({ category });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка создания категории' });
    }
}
// ======================= НОВЫЕ ФУНКЦИИ =======================
async function getUsersList(req, res) {
    try {
        const { data: { users }, error } = await supabase_js_1.supabaseAdmin.auth.admin.listUsers();
        if (error)
            return void res.status(500).json({ error: error.message });
        res.json({ users: (users || []).map(u => ({ id: u.id, email: u.email })) });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки пользователей' });
    }
}
async function createStore(req, res) {
    try {
        const { name, owner_id } = req.body;
        if (!name)
            return void res.status(400).json({ error: 'Название обязательно' });
        const { data: store, error } = await supabase_js_1.supabaseAdmin.from('stores').insert({
            name: name.trim(),
            owner_id: owner_id || null,
            status: 'active',
            delivery_radius_km: 1
        }).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.status(201).json({ store });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка создания магазина' });
    }
}
async function deleteStore(req, res) {
    try {
        const { id } = req.params;
        const { error } = await supabase_js_1.supabaseAdmin.from('stores').delete().eq('id', id);
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка удаления магазина' });
    }
}
async function deleteGlobalProduct(req, res) {
    try {
        const { id } = req.params;
        const { error } = await supabase_js_1.supabaseAdmin.from('global_products').delete().eq('id', id);
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ message: 'Товар удален' });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка удаления' });
    }
}
async function makeProductGlobal(req, res) {
    try {
        const { id } = req.params;
        const { data: updated, error } = await supabase_js_1.supabaseAdmin.from('global_products').update({ store_id: null }).eq('id', id).select('*').single();
        if (error)
            return void res.status(400).json({ error: error.message });
        res.json({ product: updated, message: 'Товар перенесен в глобальный каталог' });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка обновления' });
    }
}
