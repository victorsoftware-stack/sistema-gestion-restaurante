import { Router } from 'express';
import { authenticate } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import {
  isValidDateString,
  isValidTimeString,
  parsePositiveId,
  timeToMinutes,
} from '../../lib/validators.js';

const router = Router();

export const RESERVATION_STATUSES = ['confirmada', 'completada', 'cancelada'];
const RESERVATION_WINDOW_MINUTES = 90;

const RESERVATION_SELECT = `
  SELECT
    r.id,
    r.table_id,
    t.table_number,
    t.capacity AS table_capacity,
    t.location AS table_location,
    r.user_id,
    r.customer_name,
    r.customer_phone,
    r.party_size,
    r.reservation_date,
    r.reservation_time,
    r.status,
    r.notes,
    r.created_at
  FROM reservations r
  INNER JOIN restaurant_tables t ON t.id = r.table_id
`;

function mapReservation(row) {
  return {
    id: Number(row.id),
    table_id: Number(row.table_id),
    table_number: Number(row.table_number),
    table_capacity: Number(row.table_capacity),
    table_location: row.table_location,
    user_id: row.user_id !== null ? Number(row.user_id) : null,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    party_size: Number(row.party_size),
    reservation_date: row.reservation_date,
    reservation_time: row.reservation_time,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  };
}

function hasTimeOverlap(timeA, timeB) {
  return Math.abs(timeToMinutes(timeA) - timeToMinutes(timeB)) < RESERVATION_WINDOW_MINUTES;
}

/**
 * Consulta disponibilidad de mesas para una fecha, hora y número de comensales.
 */
router.get('/availability', async (req, res, next) => {
  try {
    const date = String(req.query.date || '').trim();
    const time = req.query.time ? String(req.query.time).trim() : null;
    const partySize = req.query.party_size ? parsePositiveId(req.query.party_size) : 1;

    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Fecha inválida. Use el formato YYYY-MM-DD.' });
    }
    if (time !== null && !isValidTimeString(time)) {
      return res.status(400).json({ error: 'Hora inválida. Use el formato HH:MM.' });
    }
    if (!partySize) {
      return res.status(400).json({ error: 'party_size debe ser un entero positivo.' });
    }

    const db = getDb();
    const [tablesRes, reservationsRes] = await Promise.all([
      db.execute({
        sql: 'SELECT id, table_number, capacity, location, status FROM restaurant_tables WHERE capacity >= ? ORDER BY table_number ASC',
        args: [partySize],
      }),
      db.execute({
        sql: "SELECT table_id, reservation_time FROM reservations WHERE reservation_date = ? AND status = 'confirmada'",
        args: [date],
      }),
    ]);

    const bookedTimesByTable = new Map();
    for (const r of reservationsRes.rows) {
      const tableId = Number(r.table_id);
      if (!bookedTimesByTable.has(tableId)) {
        bookedTimesByTable.set(tableId, []);
      }
      bookedTimesByTable.get(tableId).push(r.reservation_time);
    }

    const tables = tablesRes.rows.map((t) => {
      const tableId = Number(t.id);
      const bookedTimes = bookedTimesByTable.get(tableId) || [];
      const conflict = time ? bookedTimes.some((booked) => hasTimeOverlap(booked, time)) : false;
      return {
        id: tableId,
        table_number: Number(t.table_number),
        capacity: Number(t.capacity),
        location: t.location,
        available: !conflict,
        booked_times: bookedTimes,
      };
    });

    return res.json({ date, time, party_size: partySize, tables });
  } catch (error) {
    return next(error);
  }
});

/**
 * Lista reservas (filtradas por fecha o estado) según permisos del rol.
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const conditions = [];
    const args = [];

    if (req.user.role === 'cliente') {
      conditions.push('r.user_id = ?');
      args.push(req.user.id);
    }

    if (req.query.date) {
      const date = String(req.query.date).trim();
      if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'Fecha inválida. Use YYYY-MM-DD.' });
      }
      conditions.push('r.reservation_date = ?');
      args.push(date);
    }

    if (req.query.status) {
      const status = String(req.query.status).trim();
      if (!RESERVATION_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Estado de reserva inválido.' });
      }
      conditions.push('r.status = ?');
      args.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDb();
    const result = await db.execute({
      sql: `${RESERVATION_SELECT} ${whereClause} ORDER BY r.reservation_date ASC, r.reservation_time ASC`,
      args,
    });

    return res.json({ reservations: result.rows.map(mapReservation) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Crea una nueva reserva validando capacidad de mesa y solapamiento horario.
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const tableId = parsePositiveId(req.body?.table_id);
    const partySize = parsePositiveId(req.body?.party_size);
    const reservationDate = String(req.body?.reservation_date || '').trim();
    const reservationTime = String(req.body?.reservation_time || '').trim();
    const customerName =
      String(req.body?.customer_name || '').trim() ||
      (req.user.role === 'cliente' ? req.user.name : '');
    const customerPhone = String(req.body?.customer_phone || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!tableId) {
      return res.status(400).json({ error: 'Debe seleccionar una mesa válida (table_id).' });
    }
    if (customerName.length < 2) {
      return res.status(400).json({ error: 'El nombre del cliente debe tener al menos 2 caracteres.' });
    }
    if (!partySize) {
      return res.status(400).json({ error: 'El número de comensales debe ser un entero positivo.' });
    }
    if (!isValidDateString(reservationDate)) {
      return res.status(400).json({ error: 'Fecha de reserva inválida. Use el formato YYYY-MM-DD.' });
    }
    if (!isValidTimeString(reservationTime)) {
      return res.status(400).json({ error: 'Hora de reserva inválida. Use el formato HH:MM.' });
    }

    const db = getDb();
    const tableRes = await db.execute({
      sql: 'SELECT id, table_number, capacity FROM restaurant_tables WHERE id = ?',
      args: [tableId],
    });
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ error: 'La mesa seleccionada no existe.' });
    }

    const table = tableRes.rows[0];
    if (partySize > Number(table.capacity)) {
      return res.status(400).json({
        error: `La mesa ${table.table_number} tiene capacidad máxima para ${table.capacity} personas.`,
      });
    }

    const sameDayRes = await db.execute({
      sql: `SELECT id, reservation_time FROM reservations
            WHERE table_id = ? AND reservation_date = ? AND status = 'confirmada'`,
      args: [tableId, reservationDate],
    });

    const conflict = sameDayRes.rows.find((row) =>
      hasTimeOverlap(row.reservation_time, reservationTime)
    );
    if (conflict) {
      return res.status(409).json({
        error: `La mesa ${table.table_number} ya tiene una reserva confirmada cerca de las ${conflict.reservation_time} (ventana de ${RESERVATION_WINDOW_MINUTES} min).`,
      });
    }

    const userId = req.user.role === 'cliente' ? req.user.id : null;
    const insertResult = await db.execute({
      sql: `INSERT INTO reservations
            (table_id, user_id, customer_name, customer_phone, party_size, reservation_date, reservation_time, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?)`,
      args: [
        tableId,
        userId,
        customerName,
        customerPhone,
        partySize,
        reservationDate,
        reservationTime,
        notes,
      ],
    });

    const created = await db.execute({
      sql: `${RESERVATION_SELECT} WHERE r.id = ?`,
      args: [Number(insertResult.lastInsertRowid)],
    });

    return res.status(201).json({ reservation: mapReservation(created.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Actualiza el estado de una reserva (confirmada, completada o cancelada).
 */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de reserva inválido.' });
    }

    const nextStatus = String(req.body?.status || '').trim();
    if (!RESERVATION_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: 'Estado de reserva inválido.' });
    }

    const db = getDb();
    const currentRes = await db.execute({
      sql: `${RESERVATION_SELECT} WHERE r.id = ?`,
      args: [id],
    });
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    const current = mapReservation(currentRes.rows[0]);
    if (req.user.role === 'cliente') {
      const canClientCancel = current.user_id === req.user.id && nextStatus === 'cancelada';
      if (!canClientCancel) {
        return res.status(403).json({
          error: 'Solo puedes cancelar tus propias reservas.',
        });
      }
    }

    if (current.status === 'completada' && nextStatus === 'cancelada') {
      return res.status(409).json({
        error: 'No se puede cancelar una reserva ya completada.',
      });
    }

    await db.execute({
      sql: 'UPDATE reservations SET status = ? WHERE id = ?',
      args: [nextStatus, id],
    });

    const updated = await db.execute({
      sql: `${RESERVATION_SELECT} WHERE r.id = ?`,
      args: [id],
    });
    return res.json({ reservation: mapReservation(updated.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

export default router;
