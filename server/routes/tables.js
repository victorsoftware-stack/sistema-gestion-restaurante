import { Router } from 'express';
import { getDb } from '../../lib/db.js';

const router = Router();

function mapTable(row) {
  return {
    id: Number(row.id),
    table_number: Number(row.table_number),
    capacity: Number(row.capacity),
    location: row.location,
    status: row.status,
  };
}

/**
 * Lista todas las mesas del restaurante ordenadas por número.
 */
router.get('/', async (_req, res, next) => {
  try {
    const db = getDb();
    const result = await db.execute(
      'SELECT id, table_number, capacity, location, status FROM restaurant_tables ORDER BY table_number ASC'
    );
    return res.json({ tables: result.rows.map(mapTable) });
  } catch (error) {
    return next(error);
  }
});

export default router;
