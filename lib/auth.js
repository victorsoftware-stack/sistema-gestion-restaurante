import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

export const VALID_ROLES = ['cliente', 'mesero', 'administrador'];

function getJwtSecret() {
  return process.env.JWT_SECRET || 'sigr-dev-secret-change-in-production';
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: Number(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function sanitizeUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
}

/**
 * Middleware que valida el token Bearer JWT y adjunta el usuario actual en req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticación inválido.' });
    }

    const payload = verifyToken(token);
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      args: [payload.sub],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sesión inválida o usuario inexistente.' });
    }

    req.user = sanitizeUser(result.rows[0]);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token expirado o inválido.' });
  }
}

/**
 * Middleware de autorización por rol.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}.`,
      });
    }
    return next();
  };
}
