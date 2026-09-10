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
 * Обновление настроек магазина (порог доставки, комиссии, MBANK, Chat ID)
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
      free_delivery_threshold,
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
        free_delivery_threshold: free_delivery_threshold !== undefined ? Number(free_delivery_threshold) : 0,
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
 * Загрузка изображения QR-кода оплаты в Supabase Storage
 * POST /api/seller/store/upload-qr
 */
export async function uploadStoreQrCode(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { base64_image, file_name } = req.body;

    if (!base64_image) {
      res.status(400).json({ error: 'Отсутствует изображение' });
      return;
    }

    const matches = base64_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'Неверный формат base64 изображения' });
      return;
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const filePath = `store_${store.id}/qr_${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('stores')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabaseAdmin.storage
      .from('stores')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    const updatedPaymentInfo = {
      ...(store.payment_info || {}),
      qr_code_url: publicUrl,
    };

    await req.scopedSupabase!
      .from('stores')
      .update({ payment_info: updatedPaymentInfo })
      .eq('id', store.id);

    res.json({ qr_code_url: publicUrl });
  } catch (err: any) {
    console.error('[Seller uploadStoreQrCode Error]:', err);
    res.status(500).json({ error: err.message || 'Ошибка загрузки QR-кода' });
  }
}

/**
 * Статистика магазина для дашборда
 * GET /api/seller/stats?period=today|7d|30d
 */
export async function getStoreStats(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const period = (req.query.period as string) || 'today';

    const dateFilter = new Date();
    if (period === 'today') {
      dateFilter.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === '30d') {
      dateFilter.setDate(dateFilter.getDate() - 30);
    }

    const { data: orders, error } = await req.scopedSupabase!
      .from('orders')
      .select('id, total_amount, delivery_type, status, created_at')
      .eq('store_id', store.id)
      .gte('created_at', dateFilter.toISOString());

    if (error) throw error;

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const deliveriesCount = orders.filter((o) => o.delivery_type === 'delivery').length;

    res.json({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      deliveries_count: deliveriesCount,
      completed_orders: completedOrders.length,
    });
  } catch (err) {
    console.error('[Seller getStoreStats Error]:', err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
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
        payment_method,
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

    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(nextStatus)) {
      res.status(400).json({
        error: `Недопустимый переход статуса из "${order.status}" в "${nextStatus}"`,
      });
      return;
    }

    await supabaseAdmin
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    const customerTgId = (order.customers as any)?.telegram_id;
    if (customerTgId) {
      const shortId = order.id.slice(0, 8).toUpperCase();
      let statusText = '';
      switch (nextStatus) {
        case 'processing':
          statusText = '📦 Ваш заказ принят магазином и собирается.';
          break;
        case 'ready':
          statusText = '✨ Заказ собран и готов к выдаче / отправке.';
          break;
        case 'delivering':
          statusText = '🚚 Курьер уже везёт ваш заказ!';
          break;
        case 'completed':
          statusText = '✅ Заказ доставлен и завершён. Спасибо за покупку!\n\n⭐ Пожалуйста, оцените покупку от 1 до 5 звёзд.';
          break;
        case 'cancelled':
          statusText = '❌ Заказ был отменён магазином.';
          break;
      }

      await botManager.notifyCustomer(
        store.id,
        Number(customerTgId),
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

    const { data: storeProducts, error: spErr } = await req.scopedSupabase!
      .from('store_products')
      .select('id, global_product_id, custom_price, old_price, is_active')
      .eq('store_id', store.id);

    if (spErr) {
      res.status(500).json({ error: 'Ошибка загрузки каталога магазина' });
      return;
    }

    const storeProdMap = new Map<string, any>();
    (storeProducts || []).forEach((sp) => storeProdMap.set(sp.global_product_id, sp));

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
        old_price: sp?.old_price !== undefined ? Number(sp.old_price) : null,
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
    const { global_product_id, custom_price, old_price, is_active } = req.body;

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
          old_price: old_price ? Number(old_price) : null,
          is_active: Boolean(is_active),
        },
        { onConflict: 'store_id,global_product_id' }
      )
      .select('id, is_active, custom_price, old_price')
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
 * Рассылка покупателям с ограничением 150 знаков и 1 раз в 24 часа
 * POST /api/seller/push-campaign
 */
export async function sendPushCampaign(req: SellerRequest, res: Response): Promise<void> {
  try {
    const store = req.store!;
    const { message, photo_url } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Текст рассылки не может быть пустым' });
      return;
    }

    if (message.trim().length > 150) {
      res.status(400).json({ error: 'Превышен лимит длины: максимум 150 символов' });
      return;
    }

    // Проверка интервала 24 часа
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentBroadcasts } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('store_id', store.id)
      .gte('created_at', dayAgo);

    if (recentBroadcasts && recentBroadcasts.length > 0) {
      res.status(429).json({ error: 'Рассылку можно отправлять не более 1 раза в сутки' });
      return;
    }

    // Клиенты, оформлявшие заказы в этом магазине
    const { data: storeOrders } = await supabaseAdmin
      .from('orders')
      .select('customers(telegram_id)')
      .eq('store_id', store.id);

    const tgIds = Array.from(
      new Set(
        (storeOrders || [])
          .map((o: any) => o.customers?.telegram_id)
          .filter(Boolean)
          .map((id: string) => Number(id))
      )
    );

    if (tgIds.length === 0) {
      res.status(400).json({ error: 'У вашего магазина пока нет клиентов с Telegram для рассылки' });
      return;
    }

    await supabaseAdmin.from('broadcasts').insert({
      store_id: store.id,
      message: message.trim(),
      photo_url: photo_url || null,
    });

    const result = await botManager.broadcast(store.id, tgIds, message.trim());

    res.json({
      message: `Рассылка отправлена: доставлено ${result.sent} из ${tgIds.length}`,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    console.error('[Seller sendPushCampaign Error]:', err);
    res.status(500).json({ error: 'Ошибка при проведении рассылки' });
  }
}