import { Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { botManager } from '../bot/manager.js';
import { SellerRequest } from '../types/index.js';

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['processing', 'cancelled'], processing: ['ready', 'delivering', 'cancelled'],
  ready: ['delivering', 'completed', 'cancelled'], delivering: ['completed', 'cancelled'],
};

export async function getSellerStore(req: SellerRequest, res: Response): Promise<void> {
  res.json({ store: req.store! });
}

export async function updateSellerStore(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { name, address, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, free_delivery_threshold, payment_info, owner_chat_id } = req.body;
    const { data: updated, error } = await req.scopedSupabase!.from('stores')
      .update({ name, address, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, free_delivery_threshold: free_delivery_threshold !== undefined ? Number(free_delivery_threshold) : 0, payment_info, owner_chat_id: owner_chat_id ? parseInt(owner_chat_id, 10) : null })
      .eq('id', store.id).select('*').single();
    if (error) return void res.status(400).json({ error: error.message });
    res.json({ store: updated });
  } catch (err) { res.status(500).json({ error: 'Ошибка обновления' }); }
}

export async function uploadStoreQrCode(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { base64_image } = req.body;
    if (!base64_image) return void res.status(400).json({ error: 'Отсутствует изображение' });
    const matches = base64_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return void res.status(400).json({ error: 'Неверный формат' });
    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = `store_${store.id}/qr_${Date.now()}.${matches[1].split('/')[1] || 'png'}`;
    await supabaseAdmin.storage.from('stores').upload(filePath, buffer, { contentType: matches[1], upsert: true });
    const publicUrl = supabaseAdmin.storage.from('stores').getPublicUrl(filePath).data.publicUrl;
    await req.scopedSupabase!.from('stores').update({ payment_info: { ...(store.payment_info || {}), qr_code_url: publicUrl } }).eq('id', store.id);
    res.json({ qr_code_url: publicUrl });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getStoreStats(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const period = (req.query.period as string) || 'today';
    const dateFilter = new Date();
    if (period === 'today') dateFilter.setHours(0, 0, 0, 0);
    else if (period === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
    else if (period === '30d') dateFilter.setDate(dateFilter.getDate() - 30);
    const { data: orders } = await req.scopedSupabase!.from('orders').select('total_amount, delivery_type, status').eq('store_id', store.id).gte('created_at', dateFilter.toISOString());
    const completed = (orders || []).filter((o) => o.status === 'completed');
    res.json({ total_orders: (orders || []).length, total_revenue: completed.reduce((sum, o) => sum + Number(o.total_amount), 0), deliveries_count: (orders || []).filter((o) => o.delivery_type === 'delivery').length, completed_orders: completed.length });
  } catch (err) { res.status(500).json({ error: 'Ошибка статистики' }); }
}

export async function getSellerOrders(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const status = req.query.status as string;
    let query = req.scopedSupabase!.from('orders').select(`*, customers(first_name, last_name, username, phone), order_items(*)`).eq('store_id', store.id).order('created_at', { ascending: false });
    if (status === 'active') query = query.in('status', ['new', 'processing', 'ready', 'delivering']);
    else if (status === 'completed') query = query.in('status', ['completed', 'cancelled']);
    else if (status) query = query.eq('status', status);
    const { data: orders } = await query;
    res.json({ orders: (orders || []).map((o: any) => ({ ...o, customer: o.customers, items: o.order_items })) });
  } catch (err) { res.status(500).json({ error: 'Ошибка заказов' }); }
}

export async function updateOrderStatus(req: SellerRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { status: nextStatus } = req.body;
    const store = req.store!;
    const { data: order } = await supabaseAdmin.from('orders').select('id, status, customers(telegram_id)').eq('id', orderId).eq('store_id', store.id).single();
    if (!order) return void res.status(404).json({ error: 'Заказ не найден' });
    await supabaseAdmin.from('orders').update({ status: nextStatus }).eq('id', orderId);
    const customerTgId = (order.customers as any)?.telegram_id;
    if (customerTgId) {
      const msgs: any = { processing: '📦 Заказ собирается.', ready: '✨ Заказ готов.', delivering: '🚚 Курьер в пути!', completed: '✅ Заказ завершён. Оцените покупку!', cancelled: '❌ Заказ отменён.' };
      await botManager.notifyCustomer(store.id, Number(customerTgId), `<b>Заказ #${order.id.slice(0, 8).toUpperCase()}</b>\n\n${msgs[nextStatus] || ''}`);
    }
    res.json({ message: 'Ок', status: nextStatus });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
}

export async function getSellerCatalog(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { data: globalProducts } = await supabaseAdmin.from('global_products').select(`*, categories(id, name)`).order('name');
    const { data: storeProducts } = await req.scopedSupabase!.from('store_products').select('*').eq('store_id', store.id);
    const storeProdMap = new Map<string, any>();
    (storeProducts || []).forEach((sp) => storeProdMap.set(sp.global_product_id, sp));
    const catalog = (globalProducts || []).map((gp: any) => {
      const sp = storeProdMap.get(gp.id);
      return { global_product_id: gp.id, name: gp.name, photo_url: gp.photo_url, barcode: gp.barcode, category: gp.categories, store_product_id: sp?.id || null, enabled: Boolean(sp?.is_active), custom_price: sp?.custom_price !== undefined ? Number(sp.custom_price) : null, old_price: sp?.old_price !== null ? Number(sp.old_price) : null };
    });
    res.json({ catalog });
  } catch (err) { res.status(500).json({ error: 'Ошибка каталога' }); }
}

export async function toggleSellerCatalogItem(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { global_product_id, custom_price, old_price, is_active } = req.body;
    const finalOldPrice = old_price === null || old_price === '' || isNaN(old_price) ? null : Number(old_price);
    const { data, error } = await req.scopedSupabase!.from('store_products').upsert({ store_id: store.id, global_product_id, custom_price: custom_price || 0, old_price: finalOldPrice, is_active: Boolean(is_active) }, { onConflict: 'store_id,global_product_id' }).select('*').single();
    if (error) return void res.status(400).json({ error: error.message });
    res.json({ success: true, item: data });
  } catch (err) { res.status(500).json({ error: 'Ошибка сохранения' }); }
}

export async function createCustomProduct(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { name, category_id, photo_url, price, base64_image } = req.body;
    let finalPhotoUrl = photo_url || null;
    if (base64_image) {
      const matches = base64_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = matches[1].split('/')[1] || 'png';
        const filePath = `products/custom_${Date.now()}.${ext}`;
        await supabaseAdmin.storage.from('stores').upload(filePath, buffer, { contentType: matches[1], upsert: true });
        finalPhotoUrl = supabaseAdmin.storage.from('stores').getPublicUrl(filePath).data.publicUrl;
      }
    }
    const { data: gp } = await supabaseAdmin.from('global_products').insert({ name: name.trim(), category_id, photo_url: finalPhotoUrl, unit: 'шт' }).select('id').single();
    await req.scopedSupabase!.from('store_products').insert({ store_id: store.id, global_product_id: gp!.id, custom_price: price || 0, is_active: true });
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка создания кастомного товара' }); }
}

export async function sendPushCampaign(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { message } = req.body;
    if (!message || message.trim().length > 150) return void res.status(400).json({ error: 'Ошибка лимита' });
    const { data: storeOrders } = await supabaseAdmin.from('orders').select('customers(telegram_id)').eq('store_id', store.id);
    const tgIds = Array.from(new Set((storeOrders || []).map((o: any) => o.customers?.telegram_id).filter(Boolean).map(Number)));
    if (tgIds.length === 0) return void res.status(400).json({ error: 'Нет клиентов' });
    const result = await botManager.broadcast(store.id, tgIds, message.trim());
    res.json({ message: 'Ок', sent: result.sent, failed: result.failed });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
}