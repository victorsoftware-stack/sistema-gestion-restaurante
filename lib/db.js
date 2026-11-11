import { createClient } from '@libsql/client';
import { hashPassword } from './auth.js';
import { SCHEMA_STATEMENTS } from './schema.js';

let client = null;
let initPromise = null;

/**
 * Retorna el cliente LibSQL/SQLite configurado según DATABASE_URL.
 * Usa archivo local por defecto para desarrollo/pruebas y Turso en Vercel.
 */
export function getDb() {
  if (!client) {
    const url = process.env.DATABASE_URL || 'file:./sigr.db';
    const isLocal = url === ':memory:' || url.startsWith('file:');

    client = createClient(
      isLocal
        ? { url }
        : { url, authToken: process.env.TURSO_AUTH_TOKEN }
    );
  }
  return client;
}

/**
 * Reinicia la instancia en memoria (útil en pruebas automatizadas).
 */
export async function resetDbClient() {
  if (client) {
    client.close();
  }
  client = null;
  initPromise = null;
}

/**
 * Ejecuta las sentencias DDL para crear tablas e índices si no existen.
 */
export async function ensureSchema(db = getDb()) {
  await db.execute('PRAGMA foreign_keys = ON');
  for (const sql of SCHEMA_STATEMENTS) {
    await db.execute(sql);
  }

  const dishCols = await db.execute('PRAGMA table_info(dishes)');
  const hasImageUrl = dishCols.rows.some((col) => col.name === 'image_url');
  if (!hasImageUrl) {
    await db.execute("ALTER TABLE dishes ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
  }
}

const INITIAL_CATEGORIES = [
  { name: 'Entradas', description: 'Para compartir antes del plato principal', display_order: 1 },
  { name: 'Platos Fuertes', description: 'Especialidades de cocina y parrilla', display_order: 2 },
  { name: 'Bebidas', description: 'Jugos naturales, limonadas y bebidas frías', display_order: 3 },
  { name: 'Postres', description: 'Opciones dulces artesanales de la casa', display_order: 4 },
];

const INITIAL_DISHES = [
  {
    category: 'Entradas',
    name: 'Empanadas Criollas (x4)',
    description: 'Crujientes con ají casero',
    price: 14000,
    image_url: '/images/dishes/empanadas-criollas.jpg',
  },
  {
    category: 'Entradas',
    name: 'Patacones con Hogao',
    description: 'Plátano verde crocante con guiso tradicional',
    price: 16000,
    image_url: '/images/dishes/patacones-hogao.jpg',
  },
  {
    category: 'Platos Fuertes',
    name: 'Bandeja Típica',
    description: 'Arroz, fríjoles, carne asada, chicharrón, huevo y aguacate',
    price: 36000,
    image_url: '/images/dishes/bandeja-tipica.jpg',
  },
  {
    category: 'Platos Fuertes',
    name: 'Trucha al Ajillo',
    description: 'Acompañada de papa criolla y ensalada fresca',
    price: 34000,
    image_url: '/images/dishes/trucha-ajillo.jpg',
  },
  {
    category: 'Platos Fuertes',
    name: 'Pechuga a la Plancha',
    description: 'Con vegetales salteados y arroz blanco',
    price: 28000,
    image_url: '/images/dishes/pechuga-plancha.jpg',
  },
  {
    category: 'Bebidas',
    name: 'Limonada de Coco',
    description: 'Preparada al momento con coco natural',
    price: 11000,
    image_url: '/images/dishes/limonada-coco.jpg',
  },
  {
    category: 'Bebidas',
    name: 'Jugo Natural en Agua',
    description: 'Mango, mora o maracuyá',
    price: 8500,
    image_url: '/images/dishes/jugo-natural.jpg',
  },
  {
    category: 'Postres',
    name: 'Postre de Tres Leches',
    description: 'Porción individual con crema suave',
    price: 13000,
    image_url: '/images/dishes/postre-tres-leches.jpg',
  },
];

const INITIAL_TABLES = [
  { table_number: 1, capacity: 2, location: 'Ventana' },
  { table_number: 2, capacity: 4, location: 'Salón principal' },
  { table_number: 3, capacity: 4, location: 'Salón principal' },
  { table_number: 4, capacity: 6, location: 'Salón principal' },
  { table_number: 5, capacity: 4, location: 'Terraza' },
  { table_number: 6, capacity: 8, location: 'Terraza' },
];

const INITIAL_USERS = [
  { name: 'Administrador', email: 'admin@sigr.local', pass: 'Admin123!', role: 'administrador' },
  { name: 'Carlos Mesero', email: 'mesero@sigr.local', pass: 'Mesero123!', role: 'mesero' },
  { name: 'Cliente Demo', email: 'cliente@sigr.local', pass: 'Cliente123!', role: 'cliente' },
];

/**
 * Inserta datos semilla iniciales de usuarios, categorías, platos y mesas de forma idempotente.
 */
export async function seedDatabase(db = getDb()) {
  const existingUsers = await db.execute('SELECT COUNT(*) AS count FROM users');
  if (Number(existingUsers.rows[0].count) === 0) {
    for (const user of INITIAL_USERS) {
      const passwordHash = await hashPassword(user.pass);
      await db.execute({
        sql: 'INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        args: [user.name, user.email, passwordHash, user.role],
      });
    }
  } else {
    await db.execute("UPDATE users SET name = 'Administrador' WHERE email = 'admin@sigr.local' AND name = 'Administrador SIGR'");
  }

  const existingCategories = await db.execute('SELECT COUNT(*) AS count FROM categories');
  if (Number(existingCategories.rows[0].count) === 0) {
    for (const cat of INITIAL_CATEGORIES) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO categories (name, description, display_order) VALUES (?, ?, ?)',
        args: [cat.name, cat.description, cat.display_order],
      });
    }
  }

  const existingDishes = await db.execute('SELECT COUNT(*) AS count FROM dishes');
  if (Number(existingDishes.rows[0].count) === 0) {
    const categoriesRes = await db.execute('SELECT id, name FROM categories');
    const categoryIdByName = new Map(
      categoriesRes.rows.map((row) => [row.name, Number(row.id)])
    );

    for (const dish of INITIAL_DISHES) {
      const categoryId = categoryIdByName.get(dish.category);
      if (!categoryId) continue;
      await db.execute({
        sql: 'INSERT INTO dishes (category_id, name, description, price, image_url) VALUES (?, ?, ?, ?, ?)',
        args: [categoryId, dish.name, dish.description, dish.price, dish.image_url],
      });
    }
  } else {
    await db.execute("UPDATE dishes SET name = 'Bandeja Típica' WHERE name = 'Bandeja Típica SIGR'");
    for (const dish of INITIAL_DISHES) {
      await db.execute({
        sql: "UPDATE dishes SET image_url = ? WHERE name = ? AND image_url = ''",
        args: [dish.image_url, dish.name],
      });
    }
  }

  const existingTables = await db.execute('SELECT COUNT(*) AS count FROM restaurant_tables');
  if (Number(existingTables.rows[0].count) === 0) {
    for (const table of INITIAL_TABLES) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO restaurant_tables (table_number, capacity, location) VALUES (?, ?, ?)',
        args: [table.table_number, table.capacity, table.location],
      });
    }
  }
}

/**
 * Garantiza esquema y datos base una sola vez por ciclo de vida del cliente.
 */
export async function initializeDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = getDb();
      await ensureSchema(db);
      await seedDatabase(db);
      return db;
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}
