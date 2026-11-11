import { Router } from 'express';
import { authenticate, requireRole } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { isValidDateString } from '../../lib/validators.js';

const router = Router();

/**
 * Genera el reporte consolidado de ventas, pedidos, reservas y platos más vendidos del día.
 */
router.get('/daily', authenticate, requireRole('mesero', 'administrador'), async (req, res, next) => {
  try {
    const date = req.query.date
      ? String(req.query.date).trim()
      : new Date().toISOString().slice(0, 10);

    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Fecha inválida. Use YYYY-MM-DD.' });
    }

    const db = getDb();
    const [salesRes, ordersRes, reservationsRes, topDishesRes, closingRes] = await Promise.all([
      db.execute({
        sql: `SELECT
                COUNT(*) AS invoices_count,
                COALESCE(SUM(subtotal), 0) AS subtotal,
                COALESCE(SUM(tax), 0) AS tax,
                COALESCE(SUM(total), 0) AS total_sales,
                COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END), 0) AS efectivo,
                COALESCE(SUM(CASE WHEN payment_method = 'tarjeta' THEN total ELSE 0 END), 0) AS tarjeta,
                COALESCE(SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END), 0) AS transferencia
              FROM invoices
              WHERE substr(issued_at, 1, 10) = ?`,
        args: [date],
      }),
      db.execute({
        sql: `SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(CASE WHEN status = 'pagado' THEN 1 ELSE 0 END), 0) AS paid_orders,
                COALESCE(SUM(CASE WHEN status IN ('pendiente', 'en_preparacion', 'listo', 'entregado') THEN 1 ELSE 0 END), 0) AS active_orders,
                COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) AS cancelled_orders
              FROM orders
              WHERE substr(created_at, 1, 10) = ?`,
        args: [date],
      }),
      db.execute({
        sql: `SELECT
                COUNT(*) AS total_reservations,
                COALESCE(SUM(CASE WHEN status = 'confirmada' THEN 1 ELSE 0 END), 0) AS confirmed,
                COALESCE(SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END), 0) AS completed,
                COALESCE(SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END), 0) AS cancelled
              FROM reservations
              WHERE reservation_date = ?`,
        args: [date],
      }),
      db.execute({
        sql: `SELECT
                oi.dish_id,
                oi.dish_name,
                SUM(oi.quantity) AS units_sold,
                SUM(oi.subtotal) AS revenue
              FROM order_items oi
              INNER JOIN orders o ON o.id = oi.order_id
              WHERE substr(o.created_at, 1, 10) = ? AND o.status != 'cancelado'
              GROUP BY oi.dish_id, oi.dish_name
              ORDER BY units_sold DESC, revenue DESC
              LIMIT 5`,
        args: [date],
      }),
      db.execute({
        sql: `SELECT id, closing_date, total_sales, invoices_count, closed_at
              FROM cash_closings
              WHERE closing_date = ?`,
        args: [date],
      }),
    ]);

    const s = salesRes.rows[0];
    const o = ordersRes.rows[0];
    const r = reservationsRes.rows[0];
    const closingRow = closingRes.rows[0] || null;

    return res.json({
      date,
      sales: {
        invoices_count: Number(s.invoices_count),
        subtotal: Number(s.subtotal),
        tax: Number(s.tax),
        total_sales: Number(s.total_sales),
        by_payment_method: {
          efectivo: Number(s.efectivo),
          tarjeta: Number(s.tarjeta),
          transferencia: Number(s.transferencia),
        },
      },
      orders: {
        total_orders: Number(o.total_orders),
        paid_orders: Number(o.paid_orders),
        active_orders: Number(o.active_orders),
        cancelled_orders: Number(o.cancelled_orders),
      },
      reservations: {
        total_reservations: Number(r.total_reservations),
        confirmed: Number(r.confirmed),
        completed: Number(r.completed),
        cancelled: Number(r.cancelled),
      },
      top_dishes: topDishesRes.rows.map((d) => ({
        dish_id: Number(d.dish_id),
        dish_name: d.dish_name,
        units_sold: Number(d.units_sold),
        revenue: Number(d.revenue),
      })),
      cash_closing: closingRow
        ? {
            id: Number(closingRow.id),
            closing_date: closingRow.closing_date,
            total_sales: Number(closingRow.total_sales),
            invoices_count: Number(closingRow.invoices_count),
            closed_at: closingRow.closed_at,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
