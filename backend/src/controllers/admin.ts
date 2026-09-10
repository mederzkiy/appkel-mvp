import { Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { botManager } from '../bot/manager.js';
import { AdminRequest } from '../types/index.js';

export async function getPlatformMetrics(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const [storesRes, ordersRes] = await Promise.all([
      supabaseAdmin.from('stores').select('id, status, telegram_bot_token'),
      supabaseAdmin.from('orders').select('status, total_amount'),
    ]);
    const stores = storesRes.data || [];
    const orders = ordersRes.data || [];
    const activeStores = stores.filter((s) => s.status === 'active').length;
    let liveBots = 0;
    stores.forEach((s) => { if (s.telegram_bot_token && botManager.isBotOnline(s.id)) liveBots++; });
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const totalGmv = orders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    res.json({ metrics: { total_stores: stores.length, active_stores: activeStores, live_bots: liveBots, total_orders: orders.length, completed_orders: completedOrders, total_gmv: totalGmv } });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения метрик' }); }
}

export async function getStoresList(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: stores, error } = await supabaseAdmin.from('stores').select('*').order('created_at', { ascending: false });
    if (error) return void res.status(500).json({ error: error.message });
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const userEmailMap = new Map<string, string>();
    (users || []).forEach((u) => { if (u.email) userEmailMap.set(u.id, u.email); });
    const enriched = (stores || []).map((store) => ({ ...store, bot_online: botManager.isBotOnline(store.id), owner: { email: userEmailMap.get(store.owner_id) || null } }));
    res.json({ stores: enriched });
  } catch (err) { res.status(500).json({ error: 'Ошибка загрузки магазинов' }); }
}

export async function updateStoreByAdmin(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, subscription_expires_at, latitude, longitude } = req.body;
    const updatePayload: any = { status, subscription_expires_at: subscription_expires_at || null };
    if (latitude !== undefined) updatePayload.latitude = latitude;
    if (longitude !== undefined) updatePayload.longitude = longitude;
    const { data: updated, error } = await supabaseAdmin.from('stores').update(updatePayload).eq('id', id).select('*').single();
    if (error || !updated) return void res.status(400).json({ error: 'Ошибка обновления магазина' });
    if (updated.telegram_bot_token) {
      if (updated.status === 'active') await botManager.startBot(updated.id, updated.telegram_bot_token, updated.name);
      else await botManager.stopBot(updated.id);
    }
    res.json({ store: updated, message: 'Магазин успешно обновлён' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
}

export async function getGlobalProducts(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: products, error } = await supabaseAdmin.from('global_products').select(`id, name, barcode, photo_url, unit, category_id, categories(id, name)`).order('name');
    if (error) return void res.status(500).json({ error: error.message });
    res.json({ products: products || [] });
  } catch (err) { res.status(500).json({ error: 'Ошибка каталога' }); }
}

export async function createGlobalProduct(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, category_id, photo_url, barcode, unit, base64_image } = req.body;
    if (!name || !category_id) return void res.status(400).json({ error: 'Название и категория обязательны' });
    let finalPhotoUrl = photo_url || null;
    if (base64_image) {
      const matches = base64_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = matches[1].split('/')[1] || 'png';
        const filePath = `products/prod_${Date.now()}.${ext}`;
        await supabaseAdmin.storage.from('stores').upload(filePath, buffer, { contentType: matches[1], upsert: true });
        finalPhotoUrl = supabaseAdmin.storage.from('stores').getPublicUrl(filePath).data.publicUrl;
      }
    }
    const { data: product, error } = await supabaseAdmin.from('global_products').insert({ name: name.trim(), category_id, photo_url: finalPhotoUrl, barcode: barcode ? barcode.trim() : null, unit: unit || 'шт' }).select('*').single();
    if (error) return void res.status(400).json({ error: error.message });
    res.status(201).json({ product });
  } catch (err) { res.status(500).json({ error: 'Ошибка создания товара' }); }
}

export async function updateGlobalProduct(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, category_id, photo_url, barcode, unit, base64_image } = req.body;
    let finalPhotoUrl = photo_url;
    if (base64_image) {
      const matches = base64_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = matches[1].split('/')[1] || 'png';
        const filePath = `products/prod_${Date.now()}.${ext}`;
        await supabaseAdmin.storage.from('stores').upload(filePath, buffer, { contentType: matches[1], upsert: true });
        finalPhotoUrl = supabaseAdmin.storage.from('stores').getPublicUrl(filePath).data.publicUrl;
      }
    }
    const { data: product, error } = await supabaseAdmin.from('global_products').update({ name: name?.trim(), category_id, photo_url: finalPhotoUrl, barcode: barcode ? barcode.trim() : null, unit: unit || 'шт' }).eq('id', id).select('*').single();
    if (error) return void res.status(400).json({ error: error.message });
    res.json({ product });
  } catch (err) { res.status(500).json({ error: 'Ошибка обновления товара' }); }
}

export async function getCategoriesList(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: categories, error } = await supabaseAdmin.from('categories').select('*').order('sort_order', { ascending: true });
    if (error) return void res.status(500).json({ error: error.message });
    res.json({ categories: categories || [] });
  } catch (err) { res.status(500).json({ error: 'Ошибка загрузки категорий' }); }
}

export async function createCategory(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, sort_order } = req.body;
    if (!name) return void res.status(400).json({ error: 'Имя категории обязательно' });
    const { data: category, error } = await supabaseAdmin.from('categories').insert({ name: name.trim(), sort_order: sort_order || 0 }).select('*').single();
    if (error) return void res.status(400).json({ error: error.message });
    res.status(201).json({ category });
  } catch (err) { res.status(500).json({ error: 'Ошибка создания категории' }); }
}