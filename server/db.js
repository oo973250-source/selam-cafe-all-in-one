/**
 * server/db.js
 * ------------
 * Shared Postgres pool, used by bot, proxy, and admin.
 */

import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 8,
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('[db] pool error:', err.message)
})

export async function ensureSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    tg_user_id      BIGINT,
    tg_username     TEXT,
    tg_first_name   TEXT,
    service_type    TEXT NOT NULL,
    customer_name   TEXT NOT NULL,
    customer_loc    JSONB,
    items           JSONB NOT NULL DEFAULT '[]',
    total           INTEGER NOT NULL DEFAULT 0,
    trust_level     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'new',
    payment_status  TEXT NOT NULL DEFAULT 'pending',
    tx_ref          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_tg_user_id  ON orders(tg_user_id);

  CREATE TABLE IF NOT EXISTS order_events (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event       TEXT NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

  CREATE TABLE IF NOT EXISTS menu_items (
    id           TEXT PRIMARY KEY,
    category     TEXT NOT NULL,
    name_en      TEXT NOT NULL,
    name_am      TEXT,
    price        INTEGER NOT NULL,
    description  TEXT,
    image_url    TEXT,
    available    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON menu_items(category);
  CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);

  CREATE TABLE IF NOT EXISTS admin_users (
    tg_user_id    BIGINT PRIMARY KEY,
    tg_username   TEXT,
    tg_first_name TEXT,
    role          TEXT NOT NULL DEFAULT 'staff',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login    TIMESTAMPTZ
  );

  INSERT INTO menu_items (id, category, name_en, name_am, price, description, sort_order)
  VALUES
    ('macchiato',  'hot_drinks', 'Macchiato',        'ማኪያቶ',         25, 'Espresso stained with steamed milk', 1),
    ('bunna',      'hot_drinks', 'Bunna (Coffee)',   'ቡና',           20, 'Traditional Ethiopian coffee',       2),
    ('shai',       'hot_drinks', 'Shai (Tea)',       'ሻይ',           15, 'Black tea with milk and sugar',      3),
    ('firfir',     'breakfast',  'Firfir',           'ፍርፍር',         60, 'Spiced injera torn and sauteed',     1),
    ('ful',        'breakfast',  'Ful',              'ፉል',            55, 'Fava beans with onion and berbere',  2),
    ('chechebsa',  'breakfast',  'Chechebsa',        'ጬጨብሳ',         70, 'Spiced flatbread with butter',       3),
    ('sambusa',    'snacks',     'Sambusa',          'ሳምቡሳ',         15, 'Crispy pastry with lentils',         1),
    ('dabo',       'snacks',     'Dabo (Bread)',     'ዳቦ',           20, 'Fresh baked bread roll',             2)
  ON CONFLICT (id) DO NOTHING;
  `
  await pool.query(sql)
  console.log('[db] schema ready')
}

/**
 * Insert a new order from a Telegram web_app_data payload.
 */
export async function createOrder({ tgUserId, tgUsername, tgFirstName, payload }) {
  const {
    serviceType,
    customer,
    items = [],
    total = 0,
    trustLevel = 0,
  } = payload

  const { rows } = await pool.query(
    `INSERT INTO orders
       (tg_user_id, tg_username, tg_first_name,
        service_type, customer_name, customer_loc,
        items, total, trust_level, status, payment_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', 'pending')
     RETURNING id`,
    [
      tgUserId,
      tgUsername || null,
      tgFirstName || null,
      serviceType,
      customer?.name || 'Unknown',
      customer?.location ? JSON.stringify(customer.location) : null,
      JSON.stringify(items),
      Number(total) || 0,
      Number(trustLevel) || 0,
    ]
  )

  const orderId = rows[0].id

  await pool.query(
    `INSERT INTO order_events (order_id, event, payload)
     VALUES ($1, 'created', $2)`,
    [orderId, JSON.stringify(payload)]
  )

  return { id: orderId }
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  const { rows } = await pool.query(
    `UPDATE orders
        SET status = $2,
            updated_at = now()
      WHERE id = $1
      RETURNING tg_user_id, total, service_type`,
    [orderId, status]
  )

  if (rows.length) {
    await pool.query(
      `INSERT INTO order_events (order_id, event, payload)
       VALUES ($1, 'status_changed', $2)`,
      [orderId, JSON.stringify({ status, ...extra })]
    )
  }
  return rows[0] || null
}

export async function updatePaymentStatus(txRef, paymentStatus) {
  const { rows } = await pool.query(
    `UPDATE orders
        SET payment_status = $2,
            tx_ref = COALESCE($3, tx_ref),
            updated_at = now()
      WHERE tx_ref = $3
      RETURNING id, tg_user_id`,
    [txRef, paymentStatus, txRef]
  )
  if (rows.length) {
    await pool.query(
      `INSERT INTO order_events (order_id, event, payload)
       VALUES ($1, 'payment_updated', $2)`,
      [rows[0].id, JSON.stringify({ paymentStatus, txRef })]
    )
  }
  return rows[0] || null
}

export async function countTodaysOrdersForUser(tgUserId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM orders
      WHERE tg_user_id = $1
        AND created_at >= date_trunc('day', now())`,
    [tgUserId]
  )
  return rows[0]?.n || 0
}
