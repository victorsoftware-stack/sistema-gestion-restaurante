import { Router } from 'express';
import { authenticate } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { parsePositiveId } from '../../lib/validators.js';

const router = Router();

export const ORDER_STATUSES = [
  'pendiente',
  'en_preparacion',
  'listo',
  'entregado',
  'pagado',
  'cancelado',
];

export const ACTIVE_ORDER_STATUSES = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

const ALLOWED_TRANSITIONS = {
  pendiente: ['en_preparacion', 'listo', 'cancelado'],
  en_preparacion: ['listo', 'entregado', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  pagado: [],
  cancelado: [],
};

const ORDER_SELECT = `
  SELECT
    o.id,
    o.table_id,
    t.table_number,
    t.location AS table_location,
    o.customer_id,
    o.waiter_id,
    w.name AS waiter_name,
    o.customer_name,
    o.status,
    o.notes,
    o.total,
    o.created_at,
    o.updated_at
  FROM orders o
  LEFT JOIN restaurant_tables t ON t.id = o.table_id
  LEFT JOIN users w ON w.id = o.waiter_id
`;

function mapOrder(row, items = []) {
  return {
    id: Number(row.id),
    table_id: row.table_id !== null ? Number(row.table_id) : null,
    table_number: row.table_number !== null ? Number(row.table_number) : null,
    table_location: row.table_location || null,
    customer_id: row.customer_id !== null ? Number(row.customer_id) : null,
    waiter_id: row.waiter_id !== null ? Number(row.waiter_id) : null,
    waiter_name: row.waiter_name || null,
    customer_name: row.customer_name,
    status: row.status,
    notes: row.notes,
    total: Number(row.total),
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
  };
}

function mapOrderItem(row) {
  return {
    id: Number(row.id),
    order_id: Number(row.order_id),
    dish_id: Number(row.dish_id),
    dish_name: row.dish_name,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    subtotal: Number(row.subtotal),
  };
}

async function attachOrderItems(db, orderRows) {
  if (orderRows.length === 0) return [];
  const ids = orderRows.map((r) => Number(r.id));
  const placeholders = ids.map(() => '?').join(',');
  const itemsRes = await db.execute({
    sql: `SELECT id, order_id, dish_id, dish_name, quantity, unit_price, subtotal FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    args: ids,
  });

  const itemsByOrder = new Map();
  for (const itemRow of itemsRes.rows) {
    const orderId = Number(itemRow.order_id);
    if (!itemsByOrder.has(orderId)) {
      itemsByOrder.set(orderId, []);
    }
    itemsByOrder.get(orderId).push(mapOrderItem(itemRow));
  }

  return orderRows.map((row) => mapOrder(row, itemsByOrder.get(Number(row.id)) || []));
}

async function getOrderByIdWithItems(db, orderId) {
  const orderRes = await db.execute({
    sql: `${ORDER_SELECT} WHERE o.id = ?`,
    args: [orderId],
  });
  if (orderRes.rows.length === 0) return null;
  const [hydrated] = await attachOrderItems(db, orderRes.rows);
  return hydrated;
}

/**
 * Consulta optimizada para seguimiento en tiempo real de pedidos activos.
 */
router.get('/live', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions = [`o.status IN ('pendiente', 'en_preparacion', 'listo', 'entregado')`];
    const args = [];

    if (req.user.role === 'cliente') {
      conditions.push('o.customer_id = ?');
      args.push(req.user.id);
    }

    const result = await db.execute({
      sql: `${ORDER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY o.created_at ASC, o.id ASC`,
      args,
    });
    const orders = await attachOrderItems(db, result.rows);

    const counts = {
      pendiente: 0,
      en_preparacion: 0,
      listo: 0,
      entregado: 0,
    };
    for (const order of orders) {
      if (counts[order.status] !== undefined) {
        counts[order.status] += 1;
      }
    }

    return res.json({
      orders,
      counts,
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Lista pedidos filtrados por estado o actividad según el rol autenticado.
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const conditions = [];
    const args = [];

    if (req.user.role === 'cliente') {
      conditions.push('o.customer_id = ?');
      args.push(req.user.id);
    }

    if (req.query.status) {
      const status = String(req.query.status).trim();
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Estado de pedido inválido.' });
      }
      conditions.push('o.status = ?');
      args.push(status);
    } else if (req.query.activeOnly === 'true') {
      conditions.push(`o.status IN ('pendiente', 'en_preparacion', 'listo', 'entregado')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const result = await db.execute({
      sql: `${ORDER_SELECT} ${whereClause} ORDER BY o.created_at DESC, o.id DESC`,
      args,
    });

    const orders = await attachOrderItems(db, result.rows);
    return res.json({ orders, server_time: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
});

/**
 * Obtiene un pedido específico por ID.
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de pedido inválido.' });
    }

    const db = getDb();
    const order = await getOrderByIdWithItems(db, id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    if (req.user.role === 'cliente' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para consultar este pedido.' });
    }

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

/**
 * Registra un nuevo pedido calculando precios y subtotales desde el menú en base de datos.
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'El pedido debe incluir al menos un plato.' });
    }

    const normalizedItems = [];
    for (const item of rawItems) {
      const dishId = parsePositiveId(item?.dish_id);
      const quantity = parsePositiveId(item?.quantity);
      if (!dishId || !quantity) {
        return res.status(400).json({ error: 'Cada ítem requiere dish_id y quantity enteros positivos.' });
      }
      normalizedItems.push({ dish_id: dishId, quantity });
    }

    let tableId = null;
    if (req.body?.table_id !== undefined && req.body?.table_id !== null && req.body?.table_id !== '') {
      tableId = parsePositiveId(req.body.table_id);
      if (!tableId) {
        return res.status(400).json({ error: 'ID de mesa inválido.' });
      }
    }

    const db = getDb();

    if (tableId) {
      const tableRes = await db.execute({
        sql: 'SELECT id FROM restaurant_tables WHERE id = ?',
        args: [tableId],
      });
      if (tableRes.rows.length === 0) {
        return res.status(404).json({ error: 'La mesa seleccionada no existe.' });
      }
    }

    // Consolidar cantidades si el cliente envió el mismo plato repetido
    const qtyByDishId = new Map();
    for (const item of normalizedItems) {
      qtyByDishId.set(item.dish_id, (qtyByDishId.get(item.dish_id) || 0) + item.quantity);
    }

    const uniqueDishIds = [...qtyByDishId.keys()];
    const placeholders = uniqueDishIds.map(() => '?').join(',');
    const dishesRes = await db.execute({
      sql: `SELECT id, name, price, available FROM dishes WHERE id IN (${placeholders})`,
      args: uniqueDishIds,
    });

    const dishMap = new Map(dishesRes.rows.map((d) => [Number(d.id), d]));
    const resolvedItems = [];
    let total = 0;

    for (const [dishId, quantity] of qtyByDishId.entries()) {
      const dish = dishMap.get(dishId);
      if (!dish) {
        return res.status(404).json({ error: `El plato con ID ${dishId} no existe.` });
      }
      if (!Number(dish.available)) {
        return res.status(400).json({ error: `El plato "${dish.name}" no está disponible actualmente.` });
      }
      const unitPrice = Number(dish.price);
      const subtotal = unitPrice * quantity;
      total += subtotal;
      resolvedItems.push({
        dish_id: dishId,
        dish_name: dish.name,
        quantity,
        unit_price: unitPrice,
        subtotal,
      });
    }

    const customerName =
      String(req.body?.customer_name || '').trim() ||
      (req.user.role === 'cliente' ? req.user.name : 'Cliente en mesa');
    const notes = String(req.body?.notes || '').trim();
    const customerId = req.user.role === 'cliente' ? req.user.id : null;
    const waiterId = req.user.role === 'cliente' ? null : req.user.id;

    const tx = await db.transaction('write');
    let orderId;
    try {
      const orderInsert = await tx.execute({
        sql: `INSERT INTO orders (table_id, customer_id, waiter_id, customer_name, status, notes, total)
              VALUES (?, ?, ?, ?, 'pendiente', ?, ?)`,
        args: [tableId, customerId, waiterId, customerName, notes, total],
      });
      orderId = Number(orderInsert.lastInsertRowid);

      for (const item of resolvedItems) {
        await tx.execute({
          sql: `INSERT INTO order_items (order_id, dish_id, dish_name, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [orderId, item.dish_id, item.dish_name, item.quantity, item.unit_price, item.subtotal],
        });
      }

      if (tableId) {
        await tx.execute({
          sql: "UPDATE restaurant_tables SET status = 'ocupada' WHERE id = ?",
          args: [tableId],
        });
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    const created = await getOrderByIdWithItems(db, orderId);
    return res.status(201).json({ order: created });
  } catch (error) {
    return next(error);
  }
});

/**
 * Actualiza el estado de un pedido validando transiciones permitidas y permisos por rol.
 */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de pedido inválido.' });
    }

    const nextStatus = String(req.body?.status || '').trim();
    if (!ORDER_STATUSES.includes(nextStatus) || nextStatus === 'pagado') {
      return res.status(400).json({
        error: 'Estado de destino inválido. El estado pagado se asigna al emitir factura.',
      });
    }

    const db = getDb();
    const current = await getOrderByIdWithItems(db, id);
    if (!current) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    if (req.user.role === 'cliente') {
      const canClientCancel =
        current.customer_id === req.user.id &&
        current.status === 'pendiente' &&
        nextStatus === 'cancelado';
      if (!canClientCancel) {
        return res.status(403).json({
          error: 'Solo puedes cancelar tus propios pedidos mientras estén en estado pendiente.',
        });
      }
    }

    const allowedNext = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      return res.status(409).json({
        error: `No se puede cambiar el pedido de "${current.status}" a "${nextStatus}".`,
      });
    }

    await db.execute({
      sql: "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
      args: [nextStatus, id],
    });

    if (nextStatus === 'cancelado' && current.table_id) {
      const otherActive = await db.execute({
        sql: `SELECT COUNT(*) AS count FROM orders
              WHERE table_id = ? AND id != ? AND status IN ('pendiente', 'en_preparacion', 'listo', 'entregado')`,
        args: [current.table_id, id],
      });
      if (Number(otherActive.rows[0].count) === 0) {
        await db.execute({
          sql: "UPDATE restaurant_tables SET status = 'disponible' WHERE id = ?",
          args: [current.table_id],
        });
      }
    }

    const updated = await getOrderByIdWithItems(db, id);
    return res.json({ order: updated });
  } catch (error) {
    return next(error);
  }
});

export default router;
