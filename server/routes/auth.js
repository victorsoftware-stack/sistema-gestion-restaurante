import { Router } from 'express';
import {
  authenticate,
  hashPassword,
  requireRole,
  sanitizeUser,
  signToken,
  VALID_ROLES,
  verifyPassword,
} from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';

const router = Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Registro público de clientes (siempre asigna rol 'cliente').
 */
router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'El correo electrónico no es válido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' });
    }

    const passwordHash = await hashPassword(password);
    const insertResult = await db.execute({
      sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      args: [name, email, passwordHash, 'cliente'],
    });

    const created = await db.execute({
      sql: 'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      args: [Number(insertResult.lastInsertRowid)],
    });

    const user = sanitizeUser(created.rows[0]);
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (error) {
    return next(error);
  }
});

/**
 * Inicio de sesión para cualquier rol (cliente, mesero, administrador).
 */
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña obligatorios.' });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ?',
      args: [email],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const row = result.rows[0];
    const isValid = await verifyPassword(password, row.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = sanitizeUser(row);
    const token = signToken(user);
    return res.json({ token, user });
  } catch (error) {
    return next(error);
  }
});

/**
 * Perfil del usuario autenticado.
 */
router.get('/me', authenticate, (req, res) => {
  return res.json({ user: req.user });
});

/**
 * Listado de usuarios (exclusivo administrador).
 */
router.get('/users', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const db = getDb();
    const result = await db.execute(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
    );
    return res.json({ users: result.rows.map(sanitizeUser) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Creación de usuarios internos con rol asignado (exclusivo administrador).
 */
router.post('/users', authenticate, requireRole('administrador'), async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || 'mesero').trim();

    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'El correo electrónico no es válido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}.` });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
    }

    const passwordHash = await hashPassword(password);
    const insertResult = await db.execute({
      sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      args: [name, email, passwordHash, role],
    });

    const created = await db.execute({
      sql: 'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      args: [Number(insertResult.lastInsertRowid)],
    });

    return res.status(201).json({ user: sanitizeUser(created.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

export default router;
