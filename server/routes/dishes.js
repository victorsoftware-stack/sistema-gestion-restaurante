import { Router } from 'express';
import { authenticate, requireRole } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { parsePositiveId } from '../../lib/validators.js';

const router = Router();

const DISH_SELECT = `
  SELECT
    d.id,
    d.category_id,
    c.name AS category_name,
    d.name,
    d.description,
    d.price,
    d.available,
    d.created_at
  FROM dishes d
  INNER JOIN categories c ON c.id = d.category_id
`;

function mapDish(row) {
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    category_name: row.category_name,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    available: Boolean(Number(row.available)),
    created_at: row.created_at,
  };
}

/**
 * Lista platos del menú digital con filtros opcionales por categoría, disponibilidad y búsqueda.
 */
router.get('/', async (req, res, next) => {
  try {
    const conditions = [];
    const args = [];

    if (req.query.categoryId !== undefined && req.query.categoryId !== '') {
      const categoryId = parsePositiveId(req.query.categoryId);
      if (!categoryId) {
        return res.status(400).json({ error: 'categoryId inválido.' });
      }
      conditions.push('d.category_id = ?');
      args.push(categoryId);
    }

    if (req.query.available === 'true' || req.query.available === 'false') {
      conditions.push('d.available = ?');
      args.push(req.query.available === 'true' ? 1 : 0);
    }

    if (req.query.search) {
      const term = `%${String(req.query.search).trim()}%`;
      conditions.push('(LOWER(d.name) LIKE LOWER(?) OR LOWER(d.description) LIKE LOWER(?))');
      args.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `${DISH_SELECT} ${whereClause} ORDER BY c.display_order ASC, d.name ASC`;

    const db = getDb();
    const result = await db.execute({ sql, args });
    return res.json({ dishes: result.rows.map(mapDish) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Consulta un plato específico por ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de plato inválido.' });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `${DISH_SELECT} WHERE d.id = ?`,
      args: [id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plato no encontrado.' });
    }
    return res.json({ dish: mapDish(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Crea un nuevo plato en el menú digital (solo administrador).
 */
router.post('/', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const categoryId = parsePositiveId(req.body?.category_id);
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const price = Number(req.body?.price);
    const available = req.body?.available === undefined ? 1 : req.body.available ? 1 : 0;

    if (!categoryId) {
      return res.status(400).json({ error: 'Debe indicar una categoría válida (category_id).' });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre del plato debe tener al menos 2 caracteres.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a cero.' });
    }

    const db = getDb();
    const cat = await db.execute({
      sql: 'SELECT id FROM categories WHERE id = ?',
      args: [categoryId],
    });
    if (cat.rows.length === 0) {
      return res.status(404).json({ error: 'La categoría especificada no existe.' });
    }

    const insertResult = await db.execute({
      sql: 'INSERT INTO dishes (category_id, name, description, price, available) VALUES (?, ?, ?, ?, ?)',
      args: [categoryId, name, description, price, available],
    });

    const created = await db.execute({
      sql: `${DISH_SELECT} WHERE d.id = ?`,
      args: [Number(insertResult.lastInsertRowid)],
    });
    return res.status(201).json({ dish: mapDish(created.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Actualiza los datos de un plato (solo administrador).
 */
router.put('/:id', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de plato inválido.' });
    }

    const db = getDb();
    const currentRes = await db.execute({
      sql: 'SELECT id, category_id, name, description, price, available FROM dishes WHERE id = ?',
      args: [id],
    });
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Plato no encontrado.' });
    }

    const current = currentRes.rows[0];
    const categoryId =
      req.body?.category_id !== undefined ? parsePositiveId(req.body.category_id) : Number(current.category_id);
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : current.name;
    const description =
      req.body?.description !== undefined ? String(req.body.description).trim() : current.description;
    const price = req.body?.price !== undefined ? Number(req.body.price) : Number(current.price);
    const available = req.body?.available !== undefined ? (req.body.available ? 1 : 0) : Number(current.available);

    if (!categoryId) {
      return res.status(400).json({ error: 'category_id inválido.' });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre del plato debe tener al menos 2 caracteres.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a cero.' });
    }

    const cat = await db.execute({
      sql: 'SELECT id FROM categories WHERE id = ?',
      args: [categoryId],
    });
    if (cat.rows.length === 0) {
      return res.status(404).json({ error: 'La categoría especificada no existe.' });
    }

    await db.execute({
      sql: 'UPDATE dishes SET category_id = ?, name = ?, description = ?, price = ?, available = ? WHERE id = ?',
      args: [categoryId, name, description, price, available, id],
    });

    const updated = await db.execute({
      sql: `${DISH_SELECT} WHERE d.id = ?`,
      args: [id],
    });
    return res.json({ dish: mapDish(updated.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Cambia rápidamente la disponibilidad de un plato (administrador o mesero).
 */
router.patch('/:id/availability', authenticate, requireRole('administrador', 'mesero'), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de plato inválido.' });
    }
    if (typeof req.body?.available !== 'boolean') {
      return res.status(400).json({ error: 'El campo available debe ser booleano.' });
    }

    const db = getDb();
    const current = await db.execute({ sql: 'SELECT id FROM dishes WHERE id = ?', args: [id] });
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Plato no encontrado.' });
    }

    await db.execute({
      sql: 'UPDATE dishes SET available = ? WHERE id = ?',
      args: [req.body.available ? 1 : 0, id],
    });
    const updated = await db.execute({
      sql: `${DISH_SELECT} WHERE d.id = ?`,
      args: [id],
    });
    return res.json({ dish: mapDish(updated.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Elimina un plato si no tiene pedidos históricos asociados (solo administrador).
 */
router.delete('/:id', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de plato inválido.' });
    }

    const db = getDb();
    const existing = await db.execute({ sql: 'SELECT id FROM dishes WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Plato no encontrado.' });
    }

    const usedInOrders = await db.execute({
      sql: 'SELECT COUNT(*) AS count FROM order_items WHERE dish_id = ?',
      args: [id],
    });
    if (Number(usedInOrders.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'El plato tiene pedidos registrados; márquelo como no disponible en lugar de eliminarlo.',
      });
    }

    await db.execute({ sql: 'DELETE FROM dishes WHERE id = ?', args: [id] });
    return res.json({ deleted: true, id });
  } catch (error) {
    return next(error);
  }
});

export default router;
