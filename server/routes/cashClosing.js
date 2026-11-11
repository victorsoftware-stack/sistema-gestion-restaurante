import { Router } from 'express';
import { authenticate, requireRole } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { isValidDateString } from '../../lib/validators.js';

const router = Router();

function getTodayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapClosing(row) {
  return {
    id: Number(row.id),
    closing_date: row.closing_date,
    closed_by: row.closed_by !== null ? Number(row.closed_by) : null,
    closed_by_name: row.closed_by_name || null,
    opening_amount: Number(row.opening_amount),
    cash_sales: Number(row.cash_sales),
    card_sales: Number(row.card_sales),
    transfer_sales: Number(row.transfer_sales),
    total_sales: Number(row.total_sales),
    invoices_count: Number(row.invoices_count),
    notes: row.notes,
    closed_at: row.closed_at,
  };
}

async function aggregateInvoicesForDate(db, date) {
  const aggRes = await db.execute({
    sql: `SELECT
            COUNT(*) AS invoices_count,
            COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END), 0) AS cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'tarjeta' THEN total ELSE 0 END), 0) AS card_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END), 0) AS transfer_sales,
            COALESCE(SUM(total), 0) AS total_sales
          FROM invoices
          WHERE substr(issued_at, 1, 10) = ?`,
    args: [date],
  });
  const row = aggRes.rows[0];
  return {
    invoices_count: Number(row.invoices_count),
    cash_sales: Number(row.cash_sales),
    card_sales: Number(row.card_sales),
    transfer_sales: Number(row.transfer_sales),
    total_sales: Number(row.total_sales),
  };
}

/**
 * Previsualización de totales de caja para una fecha antes de ejecutar el cierre.
 */
router.get('/preview', authenticate, requireRole('mesero', 'administrador'), async (req, res, next) => {
  try {
    const date = req.query.date ? String(req.query.date).trim() : getTodayUtcDate();
    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Fecha inválida. Use YYYY-MM-DD.' });
    }

    const db = getDb();
    const [totals, existingRes] = await Promise.all([
      aggregateInvoicesForDate(db, date),
      db.execute({ sql: 'SELECT id FROM cash_closings WHERE closing_date = ?', args: [date] }),
    ]);

    return res.json({
      date,
      already_closed: existingRes.rows.length > 0,
      ...totals,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Lista el historial de cierres de caja registrados.
 */
router.get('/', authenticate, requireRole('mesero', 'administrador'), async (_req, res, next) => {
  try {
    const db = getDb();
    const result = await db.execute(
      `SELECT
         c.*,
         u.name AS closed_by_name
       FROM cash_closings c
       LEFT JOIN users u ON u.id = c.closed_by
       ORDER BY c.closing_date DESC, c.id DESC`
    );
    return res.json({ closings: result.rows.map(mapClosing) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Registra el cierre de caja consolidando las ventas facturadas de la fecha indicada.
 */
router.post('/', authenticate, requireRole('mesero', 'administrador'), async (req, res, next) => {
  try {
    const closingDate = req.body?.closing_date
      ? String(req.body.closing_date).trim()
      : getTodayUtcDate();
    const openingAmount = req.body?.opening_amount !== undefined ? Number(req.body.opening_amount) : 0;
    const notes = String(req.body?.notes || '').trim();

    if (!isValidDateString(closingDate)) {
      return res.status(400).json({ error: 'Fecha de cierre inválida. Use YYYY-MM-DD.' });
    }
    if (!Number.isFinite(openingAmount) || openingAmount < 0) {
      return res.status(400).json({ error: 'El monto base de apertura debe ser mayor o igual a cero.' });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM cash_closings WHERE closing_date = ?',
      args: [closingDate],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: `Ya existe un cierre de caja registrado para la fecha ${closingDate}.`,
      });
    }

    const totals = await aggregateInvoicesForDate(db, closingDate);
    const insertRes = await db.execute({
      sql: `INSERT INTO cash_closings
            (closing_date, closed_by, opening_amount, cash_sales, card_sales, transfer_sales, total_sales, invoices_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        closingDate,
        req.user.id,
        openingAmount,
        totals.cash_sales,
        totals.card_sales,
        totals.transfer_sales,
        totals.total_sales,
        totals.invoices_count,
        notes,
      ],
    });

    const createdRes = await db.execute({
      sql: `SELECT c.*, u.name AS closed_by_name
            FROM cash_closings c
            LEFT JOIN users u ON u.id = c.closed_by
            WHERE c.id = ?`,
      args: [Number(insertRes.lastInsertRowid)],
    });

    return res.status(201).json({ closing: mapClosing(createdRes.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

export default router;
