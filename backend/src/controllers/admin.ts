import { Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { botManager } from '../bot/manager.js';
import { AdminRequest } from '../types/index.js';

/**
 * Главные метрики платформы (GMV, магазины, боты, заказы)
 * GET /api/admin/metrics
 */
export async function getPlatformMetrics(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const [storesRes, ordersRes] = await Promise.all([
      supabaseAdmin.from('stores').select('id, status, telegram_bot_token'),
      supabaseAdmin.from('orders').select('status, total_amount'),
    ]);

    const stores = storesRes.data || [];
    const orders = ordersRes.data || [];

    const totalStores = stores.length;
    const activeStores = stores.filter((s) => s.status === 'active').length;

    // Считаем активные live боты
    let liveBots = 0;
    stores.forEach((s) => {
      if (s.telegram_bot_token && botManager.isBotOnline(s.id)) {
        liveBots++;
      }
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const totalGmv = orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    res.json({
      metrics: {
        total_stores: totalStores,
        active_stores: activeStores,
        live_bots: liveBots,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_gmv: totalGmv,
      },
    });
  } catch (err) {
    console.error('[Admin getPlatformMetrics Error]:', err);
    res.status(500).json({ error: 'Ошибка получения метрик' });
  }
}

/**
 * Список всех магазинов платформы со статусом ботов
 * GET /api/admin/stores
 */
export async function getStoresList(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: stores, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Собираем email владельцев через Auth Admin API
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const userEmailMap = new Map<string, string>();
    (users || []).forEach((u) => {
      if (u.email) userEmailMap.set(u.id, u.email);
    });

    const enriched = (stores || []).map((store) => ({
      ...store,
      bot_online: botManager.isBotOnline(store.id),
      owner: {
        email: userEmailMap.get(store.owner_id) || null,
      },
    }));

    res.json({ stores: enriched });
  } catch (err) {
    console.error('[Admin getStoresList Error]:', err);
    res.status(500).json({ error: 'Ошибка загрузки магазинов' });
  }
}

/**
 * Обновление статуса магазина и срока подписки (с динамическим стартом/стопом бота)
 * PATCH /api/admin/stores/:id
 */
export async function updateStoreByAdmin(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, subscription_expires_at } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('stores')
      .update({
        status,
        subscription_expires_at: subscription_expires_at || null,
      })
      .eq('id', id)
      .select('id, name, status, telegram_bot_token')
      .single();

    if (error || !updated) {
      res.status(400).json({ error: 'Ошибка обновления магазина' });
      return;
    }

    // Управление жизненным циклом бота
    if (updated.telegram_bot_token) {
      if (updated.status === 'active') {
        await botManager.startBot(updated.id, updated.telegram_bot_token, updated.name);
      } else {
        await botManager.stopBot(updated.id);
      }
    }

    res.json({ store: updated, message: 'Магазин успешно обновлён' });
  } catch (err) {
    console.error('[Admin updateStore Error]:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получение глобального каталога товаров с количеством использующих магазинов
 * GET /api/admin/global-products
 */
export async function getGlobalProducts(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('global_products')
      .select(`
        id,
        name,
        barcode,
        photo_url,
        categories (
          id,
          name
        ),
        store_products (
          id
        )
      `)
      .order('name');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const formatted = (products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      photo_url: p.photo_url,
      category_name: p.categories?.name || null,
      stores_using: p.store_products ? p.store_products.length : 0,
    }));

    res.json({ products: formatted });
  } catch (err) {
    console.error('[Admin getGlobalProducts Error]:', err);
    res.status(500).json({ error: 'Ошибка каталога' });
  }
}

/**
 * Добавление нового мастер-товара в глобальный каталог
 * POST /api/admin/global-products
 */
export async function createGlobalProduct(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, category_id, photo_url, barcode } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Название товара обязательно' });
      return;
    }

    const { data: product, error } = await supabaseAdmin
      .from('global_products')
      .insert({
        name: name.trim(),
        category_id: category_id || null,
        photo_url: photo_url || null,
        barcode: barcode ? barcode.trim() : null,
      })
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ product });
  } catch (err) {
    console.error('[Admin createGlobalProduct Error]:', err);
    res.status(500).json({ error: 'Ошибка создания товара' });
  }
}

/**
 * Список категорий
 * GET /api/admin/categories
 */
export async function getCategoriesList(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ categories: categories || [] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки категорий' });
  }
}

/**
 * Добавление новой категории
 * POST /api/admin/categories
 */
export async function createCategory(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, sort_order } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Имя категории обязательно' });
      return;
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name: name.trim(),
        sort_order: sort_order || 0,
      })
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ category });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания категории' });
  }
}