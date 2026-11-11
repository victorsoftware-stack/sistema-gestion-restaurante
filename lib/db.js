import { createClient } from '@libsql/client';
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
}

const INITIAL_CATEGORIES = [
  { name: 'Entradas', description: 'Para compartir antes del plato principal', display_order: 1 },
  { name: 'Platos Fuertes', description: 'Especialidades de cocina y parrilla', display_order: 2 },
  { name: 'Bebidas', description: 'Jugos naturales, limonadas y bebidas frías', display_order: 3 },
  { name: 'Postres', description: 'Opciones dulces artesanales de la casa', display_order: 4 },
];

const INITIAL_DISHES = [
  { category: 'Entradas', name: 'Empanadas Criollas (x4)', description: 'Crujientes con ají casero', price: 14000 },
  { category: 'Entradas', name: 'Patacones con Hogao', description: 'Plátano verde crocante con guiso tradicional', price: 16000 },
  { category: 'Platos Fuertes', name: 'Bandeja Típica SIGR', description: 'Arroz, fríjoles, carne asada, chicharrón, huevo y aguacate', price: 36000 },
  { category: 'Platos Fuertes', name: 'Trucha al Ajillo', description: 'Acompañada de papa criolla y ensalada fresca', price: 34000 },
  { category: 'Platos Fuertes', name: 'Pechuga a la Plancha', description: 'Con vegetales salteados y arroz blanco', price: 28000 },
  { category: 'Bebidas', name: 'Limonada de Coco', description: 'Preparada al momento con coco natural', price: 11000 },
  { category: 'Bebidas', name: 'Jugo Natural en Agua', description: 'Mango, mora o maracuyá', price: 8500 },
  { category: 'Postres', name: 'Postre de Tres Leches', description: 'Porción individual con crema suave', price: 13000 },
];

const INITIAL_TABLES = [
  { table_number: 1, capacity: 2, location: 'Ventana' },
  { table_number: 2, capacity: 4, location: 'Salón principal' },
  { table_number: 3, capacity: 4, location: 'Salón principal' },
  { table_number: 4, capacity: 6, location: 'Salón principal' },
  { table_number: 5, capacity: 4, location: 'Terraza' },
  { table_number: 6, capacity: 8, location: 'Terraza' },
];

/**
 * Inserta datos semilla iniciales de categorías, platos y mesas de forma idempotente.
 */
export async function seedDatabase(db = getDb()) {
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
        sql: 'INSERT INTO dishes (category_id, name, description, price) VALUES (?, ?, ?, ?)',
        args: [categoryId, dish.name, dish.description, dish.price],
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
