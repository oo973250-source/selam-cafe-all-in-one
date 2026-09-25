/**
 * server/routes/blocked-users.js
 * ------------------------------
 * Blocklist management for the web admin panel (Task 4 — scammer protection).
 *
 *   GET    /api/blocked-users           → current blocklist (with order stats)
 *   POST   /api/blocked-users           → block { idOrUsername, reason? }
 *   DELETE /api/blocked-users/:tgUserId → unblock
 *   GET    /api/orders/customers        → customer directory from past orders
 *
 * The runtime order gate lives in the two order entry points
 * (POST /api/miniapp/orders and the bot's web_app_data handler), both of
 * which call isUserBlocked() BEFORE saving anything.
 */

import { Router } from 'express'
import { pool, blockUser, unblockUser, findUserRef, listBlockedUsers } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// Current blocklist (ordered newest first, with past-order stats)
router.get('/', requireAuth, requireRole('manager', 'owner'), async (_req, res) => {
  try {
    const users = await listBlockedUsers()
    res.json({ users })
  } catch (e) {
    console.error('[blocked-users] list failed:', e.message)
    res.status(503).json({ error: 'could not load blocklist' })
  }
})

// Block a user by numeric Telegram ID or exact @username.
// Usernames are resolved to IDs via past orders so the blocklist stores the
// permanent numeric key.
router.post('/', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const { idOrUsername, reason } = req.body || {}
  if (!idOrUsername || !String(idOrUsername).trim()) {
    return res.status(400).json({ error: 'idOrUsername required' })
  }
  try {
    const raw = String(idOrUsername).trim().replace(/^@/, '')
    let ref = null
    if (/^\d+$/.test(raw)) {
      ref = await findUserRef(raw)
    } else {
      ref = await findUserRef(`@${raw}`)
      if (!ref) {
        return res.status(404).json({ error: 'user not found — try a numeric Telegram ID' })
      }
    }
    const ok = await blockUser({
      tgUserId: ref.tg_user_id,
      tgUsername: ref.tg_username,
      tgFirstName: ref.tg_first_name,
      reason: reason || 'blocked via admin panel',
      blockedBy: req.user?.id ?? null,
    })
    if (!ok) return res.status(400).json({ error: 'invalid Telegram ID' })
    console.log(`[blocked-users] tg ${ref.tg_user_id} blocked by admin ${req.user?.id ?? '?'}`)
    res.json({ ok: true, user: { tg_user_id: ref.tg_user_id, tg_username: ref.tg_username } })
  } catch (e) {
    console.error('[blocked-users] block failed:', e.message)
    res.status(503).json({ error: 'could not block user' })
  }
})

// Unblock
router.delete('/:tgUserId', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const id = Number(req.params.tgUserId)
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'bad id' })
  try {
    await pool.query(`DELETE FROM blocked_users WHERE tg_user_id = $1`, [id])
    console.log(`[blocked-users] tg ${id} unblocked by admin ${req.user?.id ?? '?'}`)
    res.json({ ok: true })
  } catch (e) {
    console.error('[blocked-users] unblock failed:', e.message)
    res.status(503).json({ error: 'could not unblock user' })
  }
})

// Customer directory (admin-only): distinct Telegram users from past orders,
// with order counts — used to find users to block. A user with no orders can
// still be blocked by numeric ID directly.
router.get('/customers/directory', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase()
  const params = []
  let where = ''
  if (q) {
    params.push(`%${q}%`)
    where = `WHERE lower(customer_name) LIKE $1
          OR lower(coalesce(tg_username, '')) LIKE $1
          OR cast(tg_user_id as text) LIKE $1`
  }
  try {
    const { rows } = await pool.query(
      `SELECT tg_user_id,
              MAX(coalesce(tg_username, ''))   AS tg_username,
              MAX(coalesce(tg_first_name, customer_name)) AS display_name,
              COUNT(*)::int                    AS order_count,
              SUM(total)::int                  AS total_spent,
              MAX(created_at)                  AS last_order_at
         FROM orders
         ${where}
        GROUP BY tg_user_id
        ORDER BY last_order_at DESC
        LIMIT 50`,
      params
    )
    res.json({ users: rows })
  } catch (e) {
    console.error('[blocked-users] customers failed:', e.message)
    res.status(503).json({ error: 'could not load customers' })
  }
})

export default router
