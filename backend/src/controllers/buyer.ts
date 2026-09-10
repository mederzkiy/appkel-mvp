import { Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { botManager } from '../bot/manager.js';
import { BuyerRequest, CreateOrderPayload } from '../types/index.js';

/**
 * Получение публичной информации о магазине (витрина)
 * GET /api/stores/:storeId/info
 */
export async function getStoreInfo(req: BuyerRequest, res: Response): Promise<void> {
  try {
    const storeId = req.params.storeId || req.storeId;

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('id, name, address, delivery_radius_km, delivery_base_fee, delivery_per_km_fee, free_delivery_threshold, payment_info')
      .eq('id', storeId)
      .eq('status', 'active')
      .single();

    if (error || !store) {
      res.status(404).json({ error: 'Магазин не найден или временно не работает' });
      return;
    }

    res.json({ store });
  } catch (err) {
    console.error('[Buyer getStoreInfo Error]:', err);
    res.status(500).json({ error: 'Ошибка получения данных магазина' });
  }
}

/**
 * Получение активного каталога товаров магазина
 * GET /api/stores/:storeId/catalog
 */
export async function getStoreCatalog(req: BuyerRequest, res: Response): Promise<void> {
  try {
    const storeId = req.params.storeId || req.storeId;

    const { data, error } = await supabaseAdmin
      .from('store_products')
      .select(`
        id,
        custom_price,
        old_price,
        name,
        photo_url,
        global_products (
          id,
          name,
          photo_url,
          barcode,
          unit,
          categories (
            id,
            name
          )
        )
      `)
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (error) {
      res.status(500).json({ error: 'Ошибка загрузки каталога товаров' });
      return;
    }

    const catalog = (data || []).map((sp: any) => {
      const price = Number(sp.custom_price);
      const oldPrice = sp.old_price ? Number(sp.old_price) : null;
      const isDiscount = Boolean(oldPrice && oldPrice > price);

      return {
        id: sp.id,
        global_product_id: sp.global_products?.id || null,
        name: sp.name || sp.global_products?.name || 'Товар',
        price,
        old_price: oldPrice,
        is_discount: isDiscount,
        photo_url: sp.photo_url || sp.global_products?.photo_url || null,
        barcode: sp.global_products?.barcode || null,
        unit: sp.global_products?.unit || 'шт',
        category_id: sp.global_products?.categories?.id || 'uncategorized',
        category_name: sp.global_products?.categories?.name || 'Разное',
      };
    });

    res.json({ catalog });
  } catch (err) {
    console.error('[Buyer getStoreCatalog Error]:', err);
    res.status(500).json({ error: 'Ошибка формирования каталога' });
  }
}

/**
 * Оформление заказа покупателем с валидацией цен и порога бесплатной доставки
 * POST /api/orders
 */
export async function createOrder(req: BuyerRequest, res: Response): Promise<void> {
  try {
    const payload = req.body as CreateOrderPayload & { payment_method?: string };
    const customerId = req.customerId;
    const storeId = payload.store_id || req.storeId;

    if (!storeId || !customerId || !payload.items || payload.items.length === 0) {
      res.status(400).json({ error: 'Некорректные данные заказа' });
      return;
    }

    // 1. Получаем магазин и параметры доставки
    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('name, delivery_base_fee, delivery_per_km_fee, delivery_radius_km, free_delivery_threshold')
      .eq('id', storeId)
      .single();

    if (storeErr || !store) {
      res.status(404).json({ error: 'Магазин не найден' });
      return;
    }

    // 2. Серверная проверка цен
    const productIds = payload.items.map((i) => i.product_id);
    const { data: storeProducts, error: prodErr } = await supabaseAdmin
      .from('store_products')
      .select('id, custom_price, name, global_products(name)')
      .eq('store_id', storeId)
      .in('id', productIds)
      .eq('is_active', true);

    if (prodErr || !storeProducts || storeProducts.length !== productIds.length) {
      res.status(400).json({ error: 'Некоторые выбранные товары недоступны или удалены' });
      return;
    }

    const priceMap = new Map<string, { price: number; name: string }>();
    storeProducts.forEach((sp: any) => {
      priceMap.set(sp.id, {
        price: Number(sp.custom_price),
        name: sp.name || sp.global_products?.name || 'Товар',
      });
    });

    let subtotal = 0;
    const verifiedItems = payload.items.map((item) => {
      const productInfo = priceMap.get(item.product_id)!;
      const lineTotal = productInfo.price * item.quantity;
      subtotal += lineTotal;
      return {
        store_product_id: item.product_id,
        name: productInfo.name,
        quantity: item.quantity,
        unit_price: productInfo.price,
        line_total: lineTotal,
      };
    });

    // 3. Расчёт доставки с учётом порога бесплатной доставки
    let deliveryFee = 0;
    const freeThreshold = Number(store.free_delivery_threshold || 0);

    if (payload.delivery_type === 'delivery') {
      if (freeThreshold > 0 && subtotal >= freeThreshold) {
        deliveryFee = 0;
      } else {
        const distance = payload.delivery_distance_km || 1;
        deliveryFee = Number(store.delivery_base_fee) + distance * Number(store.delivery_per_km_fee);
      }
    }

    const totalAmount = subtotal + deliveryFee;

    // 4. Запись заказа
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        store_id: storeId,
        customer_id: customerId,
        delivery_type: payload.delivery_type,
        delivery_address: payload.delivery_address || null,
        delivery_fee: deliveryFee,
        subtotal,
        total_amount: totalAmount,
        notes: payload.notes || null,
        payment_method: payload.payment_method || 'qr',
        status: 'new',
        payment_confirmed: false,
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      throw orderErr;
    }

    // 5. Запись позиций
    const orderItemsRows = verifiedItems.map((item) => ({
      order_id: order.id,
      store_product_id: item.store_product_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }));

    await supabaseAdmin.from('order_items').insert(orderItemsRows);

    if (payload.phone) {
      await supabaseAdmin
        .from('customers')
        .update({ phone: payload.phone })
        .eq('id', customerId);
    }

    // 6. Уведомление владельцу
    const shortId = order.id.slice(0, 8).toUpperCase();
    const itemsSummary = verifiedItems
      .map((i) => `• ${i.name} × ${i.quantity} = ${i.line_total} сом`)
      .join('\n');

    const paymentLabel = payload.payment_method === 'cash' ? 'Наличными при получении' : 'QR-перевод';

    const tgMessage =
      `🔔 <b>НОВЫЙ ЗАКАЗ #${shortId}</b>\n\n` +
      `👤 Клиент: ${req.customer?.first_name || ''} ${req.customer?.last_name || ''}\n` +
      `📱 Телефон: ${payload.phone || 'Не указан'}\n` +
      `🚚 Тип: ${payload.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}\n` +
      (payload.delivery_address ? `📍 Адрес: ${payload.delivery_address}\n` : '') +
      `💳 Оплата: ${paymentLabel}\n` +
      `\n<b>Состав заказа:</b>\n${itemsSummary}\n\n` +
      `Доставка: ${deliveryFee === 0 && payload.delivery_type === 'delivery' ? 'Бесплатно (Акция)' : `${deliveryFee} сом`}\n` +
      `💰 <b>Итого: ${totalAmount} сом</b>\n\n` +
      `<i>Откройте панель продавца для обработки заказа.</i>`;

    botManager.notifyStoreOwner(storeId, tgMessage);

    res.status(201).json({
      order_id: order.id,
      total_amount: totalAmount,
      subtotal,
      delivery_fee: deliveryFee,
    });
  } catch (err) {
    console.error('[Buyer createOrder Error]:', err);
    res.status(500).json({ error: 'Ошибка при сохранении заказа' });
  }
}

/**
 * Подтверждение оплаты покупателем
 * POST /api/orders/:orderId/confirm-payment
 */
export async function confirmPayment(req: BuyerRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const customerId = req.customerId;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ payment_confirmed: true })
      .eq('id', orderId)
      .eq('customer_id', customerId)
      .select('id, store_id, total_amount')
      .single();

    if (error || !order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    const shortId = order.id.slice(0, 8).toUpperCase();
    botManager.notifyStoreOwner(
      order.store_id,
      `💳 <b>Покупатель подтвердил оплату заказа #${shortId}!</b>\nСумма к проверке: ${order.total_amount} сом.`
    );

    res.json({ message: 'Оплата подтверждена покупателем', order_id: order.id });
  } catch (err) {
    console.error('[Buyer confirmPayment Error]:', err);
    res.status(500).json({ error: 'Ошибка подтверждения оплаты' });
  }
}

/**
 * Получение истории заказов текущего покупателя
 * GET /api/orders
 */
export async function getMyOrders(req: BuyerRequest, res: Response): Promise<void> {
  try {
    const customerId = req.customerId;
    const storeId = req.storeId;

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        status,
        delivery_type,
        total_amount,
        created_at,
        order_items (
          id,
          name,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Ошибка загрузки заказов' });
      return;
    }

    res.json({ orders: orders || [] });
  } catch (err) {
    console.error('[Buyer getMyOrders Error]:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getNearbyStores(req: any, res: any) {
  try {
    const telegramId = req.user?.id?.toString();

    if (!telegramId) {
      return res.status(401).json({ error: 'Не найден Telegram ID' });
    }

    const { data: buyer } = await supabaseAdmin
      .from('buyers')
      .select('latitude, longitude')
      .eq('telegram_id', telegramId)
      .single();

    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name, address, latitude, longitude, delivery_radius_km, free_delivery_threshold')
      .eq('status', 'active');

    if (storesError) throw storesError;

    if (buyer?.latitude && buyer?.longitude) {
      const storesWithDistance = stores?.map((store) => {
        let distance = null;
        if (store.latitude && store.longitude) {
          distance = getDistanceFromLatLonInKm(
            buyer.latitude,
            buyer.longitude,
            store.latitude,
            store.longitude
          );
        }
        return { ...store, distance_km: distance };
      });

      storesWithDistance?.sort((a, b) => {
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });

      return res.json({ stores: storesWithDistance });
    }

    res.json({ stores: stores });
  } catch (error: any) {
    console.error('Ошибка получения магазинов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}