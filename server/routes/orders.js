/**
 * server/routes/orders.js
 * -----------------------
 * Orders CRUD + stats.
 */

import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  const { status, since, limit = 50, offset = 0 } = req.query
  const where = []
  const params = []
  if (status) { params.push(status); where.push(`status = $${params.length}`) }
  if (since)  { params.push(since);  where.push(`created_at >= $${params.length}::timestamptz`) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(Number(limit), Number(offset))

  const { rows } = await pool.query(
    `SELECT id, tg_user_id, tg_username, tg_first_name, service_type,
            customer_name, customer_loc, items, total, trust_level,
            status, payment_status, tx_ref, created_at, updated_at
       FROM orders ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
    params
  )
  res.json({ orders: rows })
})

router.get('/stats/today', async (_req, res) => {
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
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' })

  const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })

  const { rows: events } = await pool.query(
    `SELECT id, event, payload, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC`,
    [id]
  )
  res.json({ order: rows[0], events })
})

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { status, payment_status } = req.body || {}
  const sets = []
  const params = [id]
  if (status)          { params.push(status);          sets.push(`status = $${params.length}`) }
  if (payment_status)  { params.push(payment_status);  sets.push(`payment_status = $${params.length}`) }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  sets.push(`updated_at = now()`)

  const { rows } = await pool.query(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  )
  if (!rows.length) return res.status(404).json({ error: 'not found' })

  await pool.query(
    `INSERT INTO order_events (order_id, event, payload) VALUES ($1, 'status_changed', $2)`,
    [id, JSON.stringify({ status, payment_status, by: req.user?.tgUserId })]
  )

  res.json({ order: rows[0] })
})

export default router
