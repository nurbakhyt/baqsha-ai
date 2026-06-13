-- Baqsha.AI Initial Schema
-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  name_kk TEXT,
  parent_id TEXT REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = 1;
CREATE INDEX idx_categories_slug ON categories(slug);

-- Products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  name_en TEXT,
  name_kk TEXT,
  description TEXT,
  description_en TEXT,
  description_kk TEXT,
  price_minor INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  package TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'piece', 'pack', 'liter')),
  media_keys TEXT NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = 1;
CREATE INDEX idx_products_sku ON products(sku);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Carts
CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  items TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'shipped', 'delivered', 'cancelled')),
  items TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  delivery_address TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  shipped_at INTEGER,
  delivered_at INTEGER,
  cancelled_at INTEGER
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX idx_orders_created ON orders(created_at DESC);