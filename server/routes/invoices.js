import { Router } from 'express';
import { authenticate, requireRole } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { isValidDateString, parsePositiveId } from '../../lib/validators.js';

const router = Router();

export const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'];

const INVOICE_SELECT = `
  SELECT
    i.id,
    i.invoice_number,
    i.order_id,
    i.issued_by,
    u.name AS issued_by_name,
    i.customer_name,
    i.subtotal,
    i.tax,
    i.total,
    i.payment_method,
    i.issued_at,
    o.customer_id,
    o.table_id,
    t.table_number
  FROM invoices i
  INNER JOIN orders o ON o.id = i.order_id
  LEFT JOIN restaurant_tables t ON t.id = o.table_id
  LEFT JOIN users u ON u.id = i.issued_by
`;

function mapInvoice(row, items = undefined) {
  const base = {
    id: Number(row.id),
    invoice_number: row.invoice_number,
    order_id: Number(row.order_id),
    issued_by: row.issued_by !== null ? Number(row.issued_by) : null,
    issued_by_name: row.issued_by_name || null,
    customer_name: row.customer_name,
    customer_id: row.customer_id !== null ? Number(row.customer_id) : null,
    table_id: row.table_id !== null ? Number(row.table_id) : null,
    table_number: row.table_number !== null ? Number(row.table_number) : null,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    payment_method: row.payment_method,
    issued_at: row.issued_at,
  };
  if (items !== undefined) {
    base.items = items;
  }
  return base;
}

async function fetchOrderItems(db, orderId) {
  const itemsRes = await db.execute({
    sql: 'SELECT id, dish_id, dish_name, quantity, unit_price, subtotal FROM order_items WHERE order_id = ? ORDER BY id ASC',
    args: [orderId],
  });
  return itemsRes.rows.map((it) => ({
    id: Number(it.id),
    dish_id: Number(it.dish_id),
    dish_name: it.dish_name,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    subtotal: Number(it.subtotal),
  }));
}

/**
 * Lista facturas emitidas (clientes ven solo las de sus pedidos; personal ve todas).
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const conditions = [];
    const args = [];

    if (req.user.role === 'cliente') {
      conditions.push('o.customer_id = ?');
      args.push(req.user.id);
    }

    if (req.query.date) {
      const date = String(req.query.date).trim();
      if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'Fecha inválida. Use YYYY-MM-DD.' });
      }
      conditions.push('substr(i.issued_at, 1, 10) = ?');
      args.push(date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const result = await db.execute({
      sql: `${INVOICE_SELECT} ${whereClause} ORDER BY i.issued_at DESC, i.id DESC`,
      args,
    });

    return res.json({ invoices: result.rows.map((r) => mapInvoice(r)) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Obtiene el detalle de una factura junto con los ítems del pedido asociado.
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de factura inválido.' });
    }

    const db = getDb();
    const invRes = await db.execute({
      sql: `${INVOICE_SELECT} WHERE i.id = ?`,
      args: [id],
    });
    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const row = invRes.rows[0];
    if (req.user.role === 'cliente' && Number(row.customer_id) !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para consultar esta factura.' });
    }

    const items = await fetchOrderItems(db, Number(row.order_id));
    return res.json({ invoice: mapInvoice(row, items) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Emite una factura para un pedido activo, marca el pedido como pagado y libera la mesa.
 */
router.post('/', authenticate, requireRole('mesero', 'administrador'), async (req, res, next) => {
  try {
    const orderId = parsePositiveId(req.body?.order_id);
    const paymentMethod = String(req.body?.payment_method || '').trim();
    const taxRate = req.body?.tax_rate !== undefined ? Number(req.body.tax_rate) : 0;

    if (!orderId) {
      return res.status(400).json({ error: 'Debe especificar un order_id válido.' });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        error: `Método de pago inválido. Permitidos: ${PAYMENT_METHODS.join(', ')}.`,
      });
    }
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 0.3) {
      return res.status(400).json({ error: 'tax_rate debe estar entre 0 y 0.30.' });
    }

    const db = getDb();
    const orderRes = await db.execute({
      sql: 'SELECT id, table_id, customer_name, status, total FROM orders WHERE id = ?',
      args: [orderId],
    });
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const order = orderRes.rows[0];
    if (order.status === 'cancelado') {
      return res.status(409).json({ error: 'No se puede facturar un pedido cancelado.' });
    }
    if (order.status === 'pagado') {
      return res.status(409).json({ error: 'El pedido ya fue pagado y facturado.' });
    }

    const existingInv = await db.execute({
      sql: 'SELECT id FROM invoices WHERE order_id = ?',
      args: [orderId],
    });
    if (existingInv.rows.length > 0) {
      return res.status(409).json({ error: 'El pedido ya tiene una factura registrada.' });
    }

    const subtotal = Number(order.total);
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;
    const customerName =
      String(req.body?.customer_name || '').trim() || order.customer_name || 'Consumidor Final';
    const dateSlug = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const invoiceNumber = `FAC-${dateSlug}-${String(orderId).padStart(4, '0')}`;

    const tx = await db.transaction('write');
    let invoiceId;
    try {
      const insertInv = await tx.execute({
        sql: `INSERT INTO invoices
              (invoice_number, order_id, issued_by, customer_name, subtotal, tax, total, payment_method)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          invoiceNumber,
          orderId,
          req.user.id,
          customerName,
          subtotal,
          tax,
          total,
          paymentMethod,
        ],
      });
      invoiceId = Number(insertInv.lastInsertRowid);

      await tx.execute({
        sql: "UPDATE orders SET status = 'pagado', updated_at = datetime('now') WHERE id = ?",
        args: [orderId],
      });

      if (order.table_id !== null) {
        const tableId = Number(order.table_id);
        const remaining = await tx.execute({
          sql: `SELECT COUNT(*) AS count FROM orders
                WHERE table_id = ? AND id != ? AND status IN ('pendiente', 'en_preparacion', 'listo', 'entregado')`,
          args: [tableId, orderId],
        });
        if (Number(remaining.rows[0].count) === 0) {
          await tx.execute({
            sql: "UPDATE restaurant_tables SET status = 'disponible' WHERE id = ?",
            args: [tableId],
          });
        }
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    const [createdRes, items] = await Promise.all([
      db.execute({ sql: `${INVOICE_SELECT} WHERE i.id = ?`, args: [invoiceId] }),
      fetchOrderItems(db, orderId),
    ]);

    return res.status(201).json({ invoice: mapInvoice(createdRes.rows[0], items) });
  } catch (error) {
    return next(error);
  }
});

export default router;
