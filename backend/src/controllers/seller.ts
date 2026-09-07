import { Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { botManager } from '../bot/manager.js';
import { SellerRequest } from '../types/index.js';

// Допустимые переходы статусов заказа
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['processing', 'cancelled'],
  processing: ['ready', 'delivering', 'cancelled'],
  ready: ['delivering', 'completed', 'cancelled'],
  delivering: ['completed', 'cancelled'],
};

/**
 * Получение профиля магазина продавца
 * GET /api/seller/store
 */
export async function getSellerStore(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    res.json({ store });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки данных магазина' });
  }
}

/**
 * Обновление настроек магазина (комиссии, MBANK, Chat ID)
 * PUT /api/seller/store
 */
export async function updateSellerStore(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const {
      name,
      address,
      delivery_radius_km,
      delivery_base_fee,
      delivery_per_km_fee,
      payment_info,
      owner_chat_id,
    } = req.body;

    const { data: updated, error } = await req.scopedSupabase!
      .from('stores')
      .update({
        name,
        address,
        delivery_radius_km,
        delivery_base_fee,
        delivery_per_km_fee,
        payment_info,
        owner_chat_id: owner_chat_id ? parseInt(owner_chat_id, 10) : null,
      })
      .eq('id', store.id)
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ store: updated });
  } catch (err) {
    console.error('[Seller updateSellerStore Error]:', err);
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
}

/**
 * Список входящих заказов продавца с фильтрацией
 * GET /api/seller/orders
 */
export async function getSellerOrders(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const status = req.query.status as string;

    let query = req.scopedSupabase!
      .from('orders')
      .select(`
        id,
        status,
        delivery_type,
        subtotal,
        delivery_fee,
        total_amount,
        delivery_address,
        payment_confirmed,
        notes,
        created_at,
        customers (
          first_name,
          last_name,
          username,
          phone
        ),
        order_items (
          id,
          name,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.in('status', ['new', 'processing', 'ready', 'delivering']);
    } else if (status === 'completed') {
      query = query.in('status', ['completed', 'cancelled']);
    } else if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Ошибка получения списка заказов' });
      return;
    }

    // Преобразуем имя связи customers -> customer
    const formattedOrders = (orders || []).map((o: any) => ({
      ...o,
      customer: o.customers,
      items: o.order_items,
    }));

    res.json({ orders: formattedOrders });
  } catch (err) {
    console.error('[Seller getSellerOrders Error]:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Смена статуса заказа с Telegram-оповещением клиента
 * PATCH /api/seller/orders/:orderId/status
 */
export async function updateOrderStatus(req: SellerRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { status: nextStatus } = req.body;
    const store = req.store!;

    // 1. Получаем текущий статус и данные покупателя
    const { data: order, error: findErr } = await supabaseAdmin
      .from('orders')
      .select('id, status, customers(telegram_id)')
      .eq('id', orderId)
      .eq('store_id', store.id)
      .single();

    if (findErr || !order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    // 2. Валидация перехода статуса
    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(nextStatus)) {
      res.status(400).json({
        error: `Недопустимый переход статуса из "${order.status}" в "${nextStatus}"`,
      });
      return;
    }

    // 3. Обновляем статус
    await supabaseAdmin
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    // 4. Оповещаем покупателя в Telegram через бота магазина
    const customerTgId = (order.customers as any)?.telegram_id;
    if (customerTgId) {
      const shortId = order.id.slice(0, 8).toUpperCase();
      let statusText = '';
      switch (nextStatus) {
        case 'processing':
          statusText = '👩‍🍳 Ваш заказ принят магазином и собирается.';
          break;
        case 'ready':
          statusText = '📦 Заказ собран и готов к выдаче / отправке.';
          break;
        case 'delivering':
          statusText = '🚗 Заказ передан курьеру и доставляется к вам!';
          break;
        case 'completed':
          statusText = '✅ Заказ успешно выполнен. Спасибо за покупку!';
          break;
        case 'cancelled':
          statusText = '❌ Заказ был отменён магазином.';
          break;
      }

      await botManager.notifyCustomer(
        store.id,
        customerTgId,
        `<b>Заказ #${shortId}</b>\n\n${statusText}`
      );
    }

    res.json({ message: 'Статус успешно обновлён', status: nextStatus });
  } catch (err) {
    console.error('[Seller updateOrderStatus Error]:', err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
}

/**
 * Получение полного мастер-каталога с отметками включенных товаров для магазина
 * GET /api/seller/catalog
 */
export async function getSellerCatalog(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;

    // 1. Получаем все глобальные товары
    const { data: globalProducts, error: gpErr } = await supabaseAdmin
      .from('global_products')
      .select(`
        id,
        name,
        photo_url,
        barcode,
        categories (
          id,
          name,
          sort_order
        )
      `)
      .order('name');

    if (gpErr) {
      res.status(500).json({ error: 'Ошибка загрузки мастер-товаров' });
      return;
    }

    // 2. Получаем настроенные цены и активность для текущего магазина
    const { data: storeProducts, error: spErr } = await req.scopedSupabase!
      .from('store_products')
      .select('id, global_product_id, custom_price, is_active')
      .eq('store_id', store.id);

    if (spErr) {
      res.status(500).json({ error: 'Ошибка загрузки каталога магазина' });
      return;
    }

    const storeProdMap = new Map<string, any>();
    (storeProducts || []).forEach((sp) => storeProdMap.set(sp.global_product_id, sp));

    // 3. Сопоставляем
    const catalog = (globalProducts || []).map((gp: any) => {
      const sp = storeProdMap.get(gp.id);
      return {
        global_product_id: gp.id,
        name: gp.name,
        photo_url: gp.photo_url,
        barcode: gp.barcode,
        category: gp.categories,
        store_product_id: sp?.id || null,
        enabled: Boolean(sp?.is_active),
        custom_price: sp?.custom_price !== undefined ? Number(sp.custom_price) : null,
      };
    });

    res.json({ catalog });
  } catch (err) {
    console.error('[Seller getSellerCatalog Error]:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Включение / выключение товара и сохранение цены в магазине продавца
 * POST /api/seller/catalog/toggle
 */
export async function toggleSellerCatalogItem(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { global_product_id, custom_price, is_active } = req.body;

    if (!global_product_id) {
      res.status(400).json({ error: 'Не указан global_product_id' });
      return;
    }

    const { data, error } = await req.scopedSupabase!
      .from('store_products')
      .upsert(
        {
          store_id: store.id,
          global_product_id,
          custom_price: custom_price || 0,
          is_active: Boolean(is_active),
        },
        { onConflict: 'store_id,global_product_id' }
      )
      .select('id, is_active, custom_price')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, item: data });
  } catch (err) {
    console.error('[Seller toggleCatalogItem Error]:', err);
    res.status(500).json({ error: 'Ошибка сохранения товара' });
  }
}

/**
 * Отправка массовой рассылки покупателям магазина через бота
 * POST /api/seller/push-campaign
 */
export async function sendPushCampaign(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Текст рассылки не может быть пустым' });
      return;
    }

    // Получаем базу покупателей данного магазина
    const { data: storeCustomers, error: custErr } = await supabaseAdmin
      .from('store_customers')
      .select('customers(telegram_id)')
      .eq('store_id', store.id);

    if (custErr) {
      res.status(500).json({ error: 'Ошибка получения списка покупателей' });
      return;
    }

    const tgIds: number[] = (storeCustomers || [])
      .map((sc: any) => sc.customers?.telegram_id)
      .filter(Boolean);

    if (tgIds.length === 0) {
      res.status(400).json({ error: 'У вашего магазина пока нет зарегистрированных клиентов' });
      return;
    }

    // Запускаем рассылку через BotManager
    const result = await botManager.broadcast(store.id, tgIds, message.trim());

    // Сохраняем статистику кампании в push_campaigns
    await supabaseAdmin.from('push_campaigns').insert({
      store_id: store.id,
      message_text: message.trim(),
      total_recipients: tgIds.length,
      successful_count: result.sent,
      failed_count: result.failed,
    });

    res.json({
      message: `Рассылка успешно завершена: доставлено ${result.sent} из ${tgIds.length}`,
      campaign: {
        total_recipients: tgIds.length,
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (err) {
    console.error('[Seller sendPushCampaign Error]:', err);
    res.status(500).json({ error: 'Ошибка при проведении рассылки' });
  }
}