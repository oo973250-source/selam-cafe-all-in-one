/**
 * server/routes/orders.js
 * -----------------------
 * Orders CRUD + stats, extended for the Admin Mini App contract:
 *
 *   - GET / lists orders the way the admin queue needs them: active
 *     (new/preparing/ready) + served-but-not-dismissed orders. Served
 *     cards stay in the queue (green "Done" state) until an admin taps
 *     "Done" (PATCH dismissed:true). Cancelled ones fall out for the
 *     queue but stay visible in order history (GET ?since=).
 *   - PATCH stamps started_by (server-side identity from the Bearer
 *     token — the client value is advisory only), served_at (when the
 *     status flips to served) and dismissed_at (also stamps served_at
 *     and, cleanup-safe, requires the order to exist). Every change
 *     emits io order:update to the admins room so other devices sync.
 *   - Status changes (preparing / served / cancelled) made HERE are
 *     forwarded to the bot bridge (`applyOrderStatusFromHttp`) so the
 *     customer gets the localized notification AND every staff-alert
 *     card in the admin Telegram chats re-renders with the new state —
 *     the bot and the miniapp stay in lockstep in BOTH directions.
 */

import { Router } from 'express'
import { pool } from '../db.js'
import { applyOrderStatusFromHttp } from '../bot.js'
import { activeAdminDuringCurrentShift } from './admin-miniapp.js'

const router = Router()

/**
 * Items are stored as the customer miniapp sent them
 * ({ id, nameEn, nameAm, price, quantity }). The admin cards read
 * `name` / `qty`, older web-panel code read `quantity`, and older
 * receipts read `nameEn` — normalize ONCE here so every consumer
 * gets all shapes and item names never render as "undefined".
 */
function normalizeItems(items) {
  if (!Array.isArray(items)) return items
  return items.map((i) => {
    if (!i || typeof i !== 'object') return i
    const name = i.name || i.nameEn || i.nameAm || i.name_en || i.id
    return {
      ...i,
      name,
      nameEn: i.nameEn || name,
      nameAm: i.nameAm ?? i.name_am ?? null,
      qty: i.qty ?? (Number.isFinite(i.quantity) ? i.quantity : 1),
      quantity: Number.isFinite(i.quantity) ? i.quantity : (i.qty ?? 1),
      price: Number.isFinite(i.price) ? i.price : Number(i.price) || 0,
    }
  })
}

function normalizeOrderRow(row) {
  if (!row || typeof row !== 'object') return row
  return { ...row, items: normalizeItems(row.items) }
}

router.get('/', async (req, res) => {
  const { status, since, limit = 50, offset = 0 } = req.query
  const where = []
  const params = []
  if (status) { params.push(status); where.push(`status = $${params.length}`) }
  if (since) { params.push(since); where.push(`created_at >= $${params.length}::timestamptz`) }
  if (where.length) {
    const whereClause = `WHERE ${where.join(' AND ')}`
    params.push(Number(limit), Number(offset))
    try {
      const { rows } = await pool.query(
        `SELECT id, tg_user_id, tg_username, tg_first_name, service_type,
                customer_name, customer_loc, items, total, trust_level,
                status, payment_status, tx_ref, note, customer_phone,
                started_by, served_at, dismissed_at, created_at, updated_at
           FROM orders ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      )
      return res.json({ orders: rows.map(normalizeOrderRow) })
    } catch (e) {
      console.error('[orders] list failed:', e.message)
      return res.status(503).json({ error: 'orders unavailable', orders: [] })
    }
  }

  // No filters → admin live queue shape: active + served-not-dismissed-today.
  try {
    const { rows } = await pool.query(
      `SELECT id, tg_user_id, tg_username, tg_first_name, service_type,
              customer_name, customer_loc, items, total, trust_level,
              status, payment_status, tx_ref, note, customer_phone,
              started_by, served_at, dismissed_at, created_at, updated_at
         FROM orders
        WHERE status IN ('new', 'preparing', 'ready')
           OR (status = 'served' AND dismissed_at IS NULL
               AND served_at >= date_trunc('day', now()))
          ORDER BY (status = 'new') DESC, created_at DESC
          LIMIT $1 OFFSET $2`,
      [Number(limit), Number(offset)]
    )
    res.json({ orders: rows.map(normalizeOrderRow) })
  } catch (e) {
    console.error('[orders] queue list failed:', e.message)
    res.status(503).json({ error: 'orders unavailable', orders: [] })
  }
})

router.get('/stats/today', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                           AS total_orders,
         COUNT(*) FILTER (WHERE status = 'new')::int             AS new_orders,
         COUNT(*) FILTER (WHERE status = 'preparing')::int       AS preparing,
         COUNT(*) FILTER (WHERE status = 'ready')::int           AS ready,
         COUNT(*) FILTER (WHERE status = 'served')::int          AS served,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int       AS cancelled,
         COALESCE(SUM(total) FILTER (WHERE status = 'served'), 0)::int AS revenue_today
       FROM orders
      WHERE created_at >= date_trunc('day', now())`
    )
    res.json(rows[0])
  } catch (e) {
    console.error('[orders] stats failed:', e.message)
    res.status(503).json({ error: 'stats unavailable' })
  }
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' })

  try {
    const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'not found' })

    const { rows: events } = await pool.query(
      `SELECT id, event, payload, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC`,
      [id]
    )
    res.json({ order: normalizeOrderRow(rows[0]), events })
  } catch (e) {
    console.error('[orders] get failed:', e.message)
    res.status(503).json({ error: 'orders unavailable' })
  }
})

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' })
  const { status, payment_status, started_by, dismissed } = req.body || {}
  const sets = []
  const params = [id]

  if (status) {
    if (!['new', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' })
    }
    params.push(status); sets.push(`status = $${params.length}`)
    if (status === 'served') sets.push('served_at = now()')
  }
  if (payment_status) {
    if (!['pending', 'paid', 'failed', 'cod'].includes(payment_status)) {
      return res.status(400).json({ error: 'invalid payment_status' })
    }
    params.push(payment_status); sets.push(`payment_status = $${params.length}`)
  }
  if (started_by !== undefined) {
    params.push(String(started_by)); sets.push(`started_by = $${params.length}`)
  }
  if (dismissed === true) {
    sets.push(`dismissed_at = now()`, `status = CASE WHEN status = 'ready' THEN 'served' ELSE status END`)
    if (status !== 'served') sets.push(`served_at = COALESCE(served_at, now())`)
  }

  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  sets.push('updated_at = now()')

  try {
    // Shift gate (Issue #1): a staff admin whose assigned shift is not
    // currently running must not act on live orders. The miniapp surfaces
    // a disabled view; this enforces the same rule server-side.
    try {
      const acting = await activeAdminDuringCurrentShift(req.user?.tgUserId)
      if (acting === false) {
        return res.status(403).json({
          error: 'you are outside your assigned shift — active shift admins handle orders',
        })
      }
    } catch (e) {
      console.warn('[orders] shift gate check failed (fail-open):', e.message)
    }

    const { rows } = await pool.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    const order = normalizeOrderRow(rows[0])

    // Server-side staff attribution: the Bearer identity wins over any
    // client-sent display name (identity spoofing on multi-admin queues).
    // Note: 'started' at status→preparing is ALSO stamped server-side, but
    // with the cached admin display name rather than the raw token name.
    await pool.query(
      `INSERT INTO order_events (order_id, event, payload)
       VALUES ($1, 'order_updater', $2)`,
      [id, JSON.stringify({ status, payment_status, started_by, dismissed, by: req.user?.tgUserId })]
    )

    // Realtime (Issue #6): status changes made from the admin miniapp must
    // (a) notify the customer in their own language, and (b) re-render the
    // staff alert card in the admin Telegram chat with the new buttons —
    // exactly what a bot-button tap does. Best-effort: an unreachable bot
    // never blocks the PATCH response.
    if (status && status !== 'new') {
      setImmediate(() => {
        try { applyOrderStatusFromHttp(order, started_by) }
        catch (e) { console.warn('[orders] bot status bridge failed:', e.message) }
      })
    }

    req.app.get('io')?.to('admins').emit('order:update', order)
    res.json({ order })
  } catch (e) {
    console.error('[orders] update failed:', e.message)
    res.status(503).json({ error: 'could not update order' })
  }
})

export default router
