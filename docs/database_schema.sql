-- ============================================================================
-- Sistema Integral de Gestión de Restaurante (SIGR)
-- Esquema Relacional de Base de Datos (SQLite / LibSQL - Turso)
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'mesero', 'administrador')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  location TEXT NOT NULL DEFAULT 'Salón principal',
  status TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'ocupada', 'reservada'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  waiter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado')),
  notes TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  dish_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reservation_date TEXT NOT NULL,
  reservation_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'completada', 'cancelada')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Consumidor Final',
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  tax REAL NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closing_date TEXT NOT NULL UNIQUE,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opening_amount REAL NOT NULL DEFAULT 0,
  cash_sales REAL NOT NULL DEFAULT 0,
  card_sales REAL NOT NULL DEFAULT 0,
  transfer_sales REAL NOT NULL DEFAULT 0,
  total_sales REAL NOT NULL DEFAULT 0,
  invoices_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_table ON reservations(reservation_date, table_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON invoices(issued_at);
