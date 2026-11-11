import { Router } from 'express';
import { authenticate, requireRole } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';
import { parsePositiveId } from '../../lib/validators.js';

const router = Router();

function mapCategory(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    display_order: Number(row.display_order),
    active: Boolean(Number(row.active)),
  };
}

/**
 * Lista categorías del menú digital. Por defecto retorna las activas.
 */
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const db = getDb();
    const sql = includeInactive
      ? 'SELECT id, name, description, display_order, active FROM categories ORDER BY display_order ASC, id ASC'
      : 'SELECT id, name, description, display_order, active FROM categories WHERE active = 1 ORDER BY display_order ASC, id ASC';
    const result = await db.execute(sql);
    return res.json({ categories: result.rows.map(mapCategory) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Crea una nueva categoría de menú (solo administrador).
 */
router.post('/', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const displayOrder = Number(req.body?.display_order ?? 0);
    const active = req.body?.active === undefined ? 1 : req.body.active ? 1 : 0;

    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre de la categoría debe tener al menos 2 caracteres.' });
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return res.status(400).json({ error: 'El orden de visualización debe ser un entero no negativo.' });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
      args: [name],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    }

    const insertResult = await db.execute({
      sql: 'INSERT INTO categories (name, description, display_order, active) VALUES (?, ?, ?, ?)',
      args: [name, description, displayOrder, active],
    });
    const created = await db.execute({
      sql: 'SELECT id, name, description, display_order, active FROM categories WHERE id = ?',
      args: [Number(insertResult.lastInsertRowid)],
    });

    return res.status(201).json({ category: mapCategory(created.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Actualiza una categoría existente (solo administrador).
 */
router.put('/:id', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de categoría inválido.' });
    }

    const db = getDb();
    const currentRes = await db.execute({
      sql: 'SELECT id, name, description, display_order, active FROM categories WHERE id = ?',
      args: [id],
    });
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const current = currentRes.rows[0];
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : current.name;
    const description =
      req.body?.description !== undefined ? String(req.body.description).trim() : current.description;
    const displayOrder =
      req.body?.display_order !== undefined ? Number(req.body.display_order) : Number(current.display_order);
    const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : Number(current.active);

    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre de la categoría debe tener al menos 2 caracteres.' });
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return res.status(400).json({ error: 'El orden de visualización debe ser un entero no negativo.' });
    }

    const duplicate = await db.execute({
      sql: 'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
      args: [name, id],
    });
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe otra categoría con ese nombre.' });
    }

    await db.execute({
      sql: 'UPDATE categories SET name = ?, description = ?, display_order = ?, active = ? WHERE id = ?',
      args: [name, description, displayOrder, active, id],
    });

    const updated = await db.execute({
      sql: 'SELECT id, name, description, display_order, active FROM categories WHERE id = ?',
      args: [id],
    });
    return res.json({ category: mapCategory(updated.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Elimina una categoría si no tiene platos asociados (solo administrador).
 */
router.delete('/:id', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de categoría inválido.' });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM categories WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const linkedDishes = await db.execute({
      sql: 'SELECT COUNT(*) AS count FROM dishes WHERE category_id = ?',
      args: [id],
    });
    if (Number(linkedDishes.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar la categoría porque tiene platos asociados.',
      });
    }

    await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
    return res.json({ deleted: true, id });
  } catch (error) {
    return next(error);
  }
});

export default router;
