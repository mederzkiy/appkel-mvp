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

    // Считаем активные live боты (теперь у нас Единый бот, проверяем глобальный онлайн)
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
 * Список всех магазинов платформы
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
 * Обновление статуса магазина и срока подписки
 * PATCH /api/admin/stores/:id
 */
export async function updateStoreByAdmin(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, subscription_expires_at, latitude, longitude } = req.body;

    const updatePayload: any = {
      status,
      subscription_expires_at: subscription_expires_at || null,
    };

    if (latitude !== undefined) updatePayload.latitude = latitude;
    if (longitude !== undefined) updatePayload.longitude = longitude;

    const { data: updated, error } = await supabaseAdmin
      .from('stores')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      res.status(400).json({ error: 'Ошибка обновления магазина' });
      return;
    }

    // Если боты индивидуальные, запускаем/останавливаем. 
    // Для Единого бота это просто заглушка совместимости.
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
 * Получение глобального каталога товаров
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
        unit,
        category_id,
        categories (
          id,
          name
        )
      `)
      .order('name');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ products: products || [] });
  } catch (err) {
    console.error('[Admin getGlobalProducts Error]:', err);
    res.status(500).json({ error: 'Ошибка каталога' });
  }
}

/**
 * Добавление нового мастер-товара
 * POST /api/admin/global-products
 */
export async function createGlobalProduct(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, category_id, photo_url, barcode, unit } = req.body;

    if (!name || !category_id) {
      res.status(400).json({ error: 'Название и категория обязательны' });
      return;
    }

    const { data: product, error } = await supabaseAdmin
      .from('global_products')
      .insert({
        name: name.trim(),
        category_id,
        photo_url: photo_url || null,
        barcode: barcode ? barcode.trim() : null,
        unit: unit || 'шт',
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
 * Обновление мастер-товара
 * PATCH /api/admin/global-products/:id
 */
export async function updateGlobalProduct(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, category_id, photo_url, barcode, unit } = req.body;

    const { data: product, error } = await supabaseAdmin
      .from('global_products')
      .update({
        name: name?.trim(),
        category_id,
        photo_url: photo_url || null,
        barcode: barcode ? barcode.trim() : null,
        unit: unit || 'шт',
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ product });
  } catch (err) {
    console.error('[Admin updateGlobalProduct Error]:', err);
    res.status(500).json({ error: 'Ошибка обновления товара' });
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