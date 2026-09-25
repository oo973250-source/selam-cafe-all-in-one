/**
 * server/db.js
 * ------------
 * Shared Postgres pool, used by bot, proxy, and admin.
 */

import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

/**
 * Decide the TLS setting from the connection string itself:
 *   - explicit ?sslmode=disable  → no SSL (respect it)
 *   - explicit ?sslmode=<other>  → SSL (self-signed friendly)
 *   - private-network hosts (localhost, *.internal — e.g. Railway's
 *     postgres.railway.internal) → no SSL; traffic never leaves the
 *     private network and the internal endpoint can refuse TLS
 *   - everything else (Neon, Railway public proxy, Supabase, Render…) → SSL
 */
function resolveSsl(connectionString) {
  if (!connectionString) return undefined
  let url
  try { url = new URL(connectionString) } catch { return undefined }

  const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase()
  if (sslmode === 'disable') return undefined
  if (sslmode) return { rejectUnauthorized: false }

  const host = (url.hostname || '').toLowerCase()
  const isPrivate =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.internal')
  if (isPrivate) return undefined

  return { rejectUnauthorized: false }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
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
  );  CREATE TABLE IF NOT EXISTS blocked_users (
    tg_user_id   BIGINT PRIMARY KEY,
    tg_username  TEXT,
    tg_first_name TEXT,
    reason       TEXT,
    blocked_by   BIGINT,
    blocked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_blocked_users_username ON blocked_users(tg_username);

  CREATE TABLE IF NOT EXISTS user_langs (
    tg_user_id    BIGINT PRIMARY KEY,
    lang          TEXT NOT NULL DEFAULT 'en',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id         TEXT PRIMARY KEY,
    name_en    TEXT NOT NULL,
    name_am    TEXT,
    icon       TEXT NOT NULL DEFAULT '🍽️',
    section    TEXT NOT NULL DEFAULT 'food' CHECK (section IN ('food', 'drink')),
    hidden     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Migrations for DBs created before section/hidden existed (idempotent).
  ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'food';
  ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS hidden  BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE menu_categories DROP CONSTRAINT IF EXISTS menu_categories_section_check;
  ALTER TABLE menu_categories ADD  CONSTRAINT menu_categories_section_check CHECK (section IN ('food', 'drink'));

  INSERT INTO menu_categories (id, name_en, name_am, icon, section, sort_order)
  VALUES
    ('breakfast',  'Breakfast',  'ቁርስ',    '🌅', 'food',  1),
    ('snacks',     'Snacks',     'መክሰስ',    '🥟', 'food',  2),
    ('hot_drinks', 'Hot Drinks', 'ትኩስ መጠጦች', '☕', 'drink', 3),
    ('drinks',     'Drinks',     'መጠጦች',    '🥤', 'drink', 4)
  ON CONFLICT (id) DO NOTHING;
  

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
 * Per-user bot language. Persisted so a bot restart (Railway redeploys,
 * crashes, dyno moves) doesn't reset everyone to English.
 */
export async function getUserLang(tgUserId) {
  const { rows } = await pool.query(
    `SELECT lang FROM user_langs WHERE tg_user_id = $1`,
    [Number(tgUserId)]
  )
  return rows[0]?.lang || 'en'
}

export async function setUserLang(tgUserId, lang, tgUsername = null, tgFirstName = null) {
  await pool.query(
    `INSERT INTO user_langs (tg_user_id, lang, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (tg_user_id)
     DO UPDATE SET lang = EXCLUDED.lang, updated_at = now()`,
    [Number(tgUserId), lang]
  )
  // Keep admin/audit metadata fresh where it already exists (best-effort).
  try {
    await pool.query(
      `UPDATE admin_users
          SET tg_username = COALESCE($2, tg_username),
              tg_first_name = COALESCE($3, tg_first_name)
        WHERE tg_user_id = $1
          AND (tg_username IS NULL OR tg_first_name IS NULL)`,
      [Number(tgUserId), tgUsername, tgFirstName]
    )
  } catch (_) { /* table may not exist yet; non-critical */ }
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
     VALUES ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9, 'new', 'pending')
     RETURNING id, tg_user_id`,
    [
      Number(tgUserId),
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

  return { id: orderId, tgUserId: rows[0].tg_user_id }
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
      WHERE tg_user_id::text = $1
        AND created_at >= date_trunc('day', now())`,
    [String(tgUserId)]
  )
  return rows[0]?.n || 0
}

// ── Blocked users (scammer protection, Task 4) ──────────────────────────
/**
 * True when the Telegram user is on the blocklist. Called BEFORE any order
 * is created (bot web_app_data path and POST /api/miniapp/orders), so a
 * blocked user can never get an order saved — not just hidden client-side.
 * DB errors fail OPEN (return false) so a transient DB blip never blocks
 * all ordering.
 */
export async function isUserBlocked(tgUserId) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM blocked_users WHERE tg_user_id = $1 LIMIT 1`,
      [Number(tgUserId)]
    )
    return rows.length > 0
  } catch (e) {
    console.warn('[db] isUserBlocked failed (fail-open):', e.message)
    return false
  }
}

/** Resolve a blocklist row from a numeric ID or an exact @username. */
export async function findBlockedUser(idOrUsername) {
  const raw = String(idOrUsername || '').trim().replace(/^@/, '')
  if (/^\d+$/.test(raw)) {
    const { rows } = await pool.query(
      `SELECT * FROM blocked_users WHERE tg_user_id = $1`, [Number(raw)]
    )
    return rows[0] || null
  }
  const { rows } = await pool.query(
    `SELECT * FROM blocked_users WHERE lower(tg_username) = lower($1) LIMIT 1`, [raw]
  )
  return rows[0] || null
}

/** Find a user's Telegram ID (and names) from past orders by ID or @username. */
export async function findUserRef(idOrUsername) {
  const raw = String(idOrUsername || '').trim().replace(/^@/, '')
  if (/^\d+$/.test(raw)) {
    const { rows } = await pool.query(
      `SELECT tg_user_id, tg_username, tg_first_name
         FROM orders WHERE tg_user_id::text = $1
         ORDER BY created_at DESC LIMIT 1`, [raw]
    )
    if (rows[0]) return rows[0]
    return { tg_user_id: Number(raw), tg_username: null, tg_first_name: null }
  }
  const { rows } = await pool.query(
    `SELECT tg_user_id, tg_username, tg_first_name
       FROM orders WHERE lower(tg_username) = lower($1)
       ORDER BY created_at DESC LIMIT 1`, [raw]
  )
  return rows[0] || null
}

/** Block a Telegram user. Returns false when the ID is unusable. */
export async function blockUser({ tgUserId, tgUsername = null, tgFirstName = null, reason = null, blockedBy = null }) {
  const id = Number(tgUserId)
  if (!Number.isSafeInteger(id) || id <= 0) return false
  await pool.query(
    `INSERT INTO blocked_users (tg_user_id, tg_username, tg_first_name, reason, blocked_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tg_user_id)
     DO UPDATE SET tg_username = EXCLUDED.tg_username,
                   tg_first_name = EXCLUDED.tg_first_name,
                   reason = COALESCE(EXCLUDED.reason, blocked_users.reason)`,
    [id, tgUsername, tgFirstName, reason, blockedBy]
  )
  return true
}

export async function unblockUser(idOrUsername) {
  const ref = await findBlockedUser(idOrUsername)
  if (!ref) return null
  await pool.query(`DELETE FROM blocked_users WHERE tg_user_id = $1`, [ref.tg_user_id])
  return ref
}

export async function listBlockedUsers() {
  const { rows } = await pool.query(
    `SELECT b.*, o.order_count, o.last_order_at
       FROM blocked_users b
       LEFT JOIN (
         SELECT tg_user_id,
                COUNT(*)::int AS order_count,
                MAX(created_at) AS last_order_at
           FROM orders GROUP BY tg_user_id
       ) o ON o.tg_user_id = b.tg_user_id
      ORDER BY b.blocked_at DESC`
  )
  return rows
}

