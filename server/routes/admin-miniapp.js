/**
 * server/routes/admin-miniapp.js
 * ------------------------------
 * Backend for the Admin Mini App (Telegram-native admin panel, served
 * statically at /admin-miniapp). Auth:
 *
 *   POST /auth — Telegram initData → admin allowlist → JWT role 'owner'
 *
 * (Bearer headers on everything else; no cookies — SameSite is unreliable
 * inside the Telegram webview.) Everything below /auth requires it.
 */

import { Router } from 'express'
import { verifyTelegramInitData } from './miniapp.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import {
  pool,
  getStoreSettings,
  getIntakeStatus,
  getCafeProfile,
  publicBrand,
  logPauseEvent,
  closeOpenPauseEvents,
  listPauseEvents,
  listAnnouncements,
  createAnnouncement,
} from '../db.js'

const router = Router()

// Admin allowlist — union of the three env lists, exactly like the bot's
// isAdmin() in server/bot.js, so an admin in the bot is an admin here.
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map((s) => Number(s.trim())).filter(Boolean)
const NOTIFY_IDS = (process.env.NOTIFY_CHAT_IDS || '')
  .split(',').map((s) => Number(s.trim())).filter(Number.isFinite)
const OWNER_ID = process.env.OWNER_TELEGRAM_ID
  ? Number(process.env.OWNER_TELEGRAM_ID) : null

function isAdmin(tgUserId) {
  if (OWNER_ID && tgUserId === OWNER_ID) return true
  if (ADMIN_IDS.includes(tgUserId)) return true
  return NOTIFY_IDS.includes(tgUserId)
}

// ── Auth (public) ───────────────────────────────────────────────────────
router.post('/auth', async (req, res) => {
  try {
    const tgUser = verifyTelegramInitData(req.body?.initData)
    if (!tgUser) {
      console.error('[admin-miniapp] auth REJECTED: initData verification failed' +
        (req.body?.initData ? ' (initData present — likely BOT_TOKEN mismatch)' : ' (initData MISSING)'))
      return res.status(401).json({ error: 'invalid or missing Telegram initData' })
    }

    const tgUserId = Number(tgUser.id)
    if (!isAdmin(tgUserId)) {
      console.warn(`[admin-miniapp] auth DENIED for tg ${tgUserId} — not on the admin allowlist`)
      return res.status(403).json({ error: 'your Telegram account is not an admin of this bot' })
    }

    try {
      await pool.query(
        `INSERT INTO admin_users (tg_user_id, tg_username, tg_first_name, last_login)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (tg_user_id)
         DO UPDATE SET tg_username = COALESCE($2, admin_users.tg_username),
                       tg_first_name = COALESCE($3, admin_users.tg_first_name),
                       last_login = now()`,
        [tgUserId, tgUser.username || null, tgUser.first_name || null]
      )
    } catch (dbErr) {
      console.error('[admin-miniapp] admin_users upsert failed (non-fatal):', dbErr.message)
    }

    const user = {
      id: tgUserId,
      tgUserId,
      username: tgUser.username || null,
      firstName: tgUser.first_name || null,
      role: 'owner',
    }
    const token = signToken(user)
    console.log(`[admin-miniapp] tg ${tgUserId} (${tgUser.username || tgUser.first_name || '?'}) authenticated as owner`)
    return res.json({ token, user })
  } catch (e) {
    console.error('[admin-miniapp] auth failed:', e.message)
    return res.status(500).json({ error: 'authentication failed' })
  }
})

// Everything below requires an authenticated admin (Bearer token).
router.use(requireAuth)

// ── Store settings (Page 7) — pause / closure / delivery / order limits ─
router.get('/settings', async (_req, res) => {
  try {
    const settings = await getStoreSettings()
    res.json({ settings })
  } catch (e) {
    console.error('[admin-miniapp] settings read failed:', e.message)
    res.status(503).json({ error: 'could not load settings' })
  }
})

router.patch('/settings', async (req, res) => {
  try {
    const fields = [
      'order_limit', 'pickup_throttle_min', 'delivery_available',
      'paused', 'pause_until', 'close_until', 'closure_reason',
    ]
    const cur = await getStoreSettings()
    const sets = []
    const params = []
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { params.push(req.body[f]); sets.push(`${f} = $${params.length}`) }
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
    sets.push('updated_at = now()')

    // Reports-page pause/closure log: append an event on pause/close start,
    // stamp ended_at on the newest still-ongoing one when intake resumes.
    const nowPausing = req.body.paused === true && !cur.paused
    const nowCountdown = !!req.body.pause_until && !cur.pause_until
    const nowClosing = !!req.body.close_until && !cur.close_until
    const reason = req.body.closure_reason ?? cur.closure_reason
    if (nowPausing && !nowCountdown && !nowClosing) {
      await logPauseEvent('emergency', reason)
    } else if (nowClosing) {
      await logPauseEvent('closed', reason)
    } else if (nowCountdown) {
      await logPauseEvent('countdown', reason)
    }
    const nowResuming = req.body.paused === false || req.body.pause_until === null || req.body.close_until === null
    if (nowResuming && (cur.paused || cur.pause_until || cur.close_until)) {
      await closeOpenPauseEvents()
    }

    const { rows } = await pool.query(
      `UPDATE store_settings SET ${sets.join(', ')} WHERE id = 1 RETURNING *`, params
    )
    const settings = rows[0]
    // Sync every admin device instantly; the customer gate reads the row
    // server-side on every order, so no event is needed for enforcement.
    req.app.get('io')?.to('admins').emit('settings:update', settings)
    res.json({ settings })
  } catch (e) {
    console.error('[admin-miniapp] settings update failed:', e.message)
    res.status(503).json({ error: 'could not update settings' })
  }
})

// ── Cafe profile (Page 9) — SINGLE SOURCE OF TRUTH for cafe identity ───
router.get('/profile', async (_req, res) => {
  try {
    res.json({ profile: await getCafeProfile() })
  } catch (e) {
    console.error('[admin-miniapp] profile read failed:', e.message)
    res.status(503).json({ error: 'could not load profile' })
  }
})

router.patch('/profile', async (req, res) => {
  try {
    const fields = ['cafe_name', 'phone', 'location', 'logo_url', 'hours_open', 'hours_close', 'description']
    const sets = []
    const params = []
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { params.push(String(req.body[f])); sets.push(`${f} = $${params.length}`) }
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
    sets.push('updated_at = now()')

    const { rows } = await pool.query(
      `UPDATE cafe_profile SET ${sets.join(', ')} WHERE id = 1 RETURNING *`, params
    )
    if (!rows.length) return res.status(404).json({ error: 'profile row missing' })
    const profile = rows[0]
    // Identity propagation: admin devices refresh their header brand
    // instantly; every other surface (customer app, bot templates) reads
    // the row / /api/brand at runtime, so no redeploy is ever needed.
    req.app.get('io')?.to('admins').emit('profile:update', profile)
    req.app.get('io')?.to('customers').emit('brand:update', publicBrand(profile))
    return res.json({ profile })
  } catch (e) {
    console.error('[admin-miniapp] profile update failed:', e.message)
    return res.status(503).json({ error: 'could not update profile' })
  }
})

// ── Staff admins (Page 6) — CRUD over the staff_admins table ───────────
const DAY = 24 * 60 * 60 * 1000
function computeStats(done) {
  const now = Date.now()
  let midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  const ts = (Array.isArray(done) ? done : []).map((t) => new Date(t).getTime()).filter((n) => Number.isFinite(n))
  return {
    day: ts.filter((t) => t >= midnight.getTime()).length,
    week: ts.filter((t) => t >= now - 7 * DAY).length,
    month: ts.filter((t) => t >= now - 30 * DAY).length,
  }
}
function staffView(row) {
  const { done, ...rest } = row
  return { ...rest, stats: computeStats(done) }
}

router.get('/admins', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM staff_admins ORDER BY created_at ASC`)
    res.json({ admins: rows.map(staffView) })
  } catch (e) {
    console.error('[admin-miniapp] admins list failed:', e.message)
    res.status(503).json({ error: 'could not load admins' })
  }
})

// Instant verification (Page 6 add-admin modal): resolve a Telegram user
// profile from a numeric user ID via the real Bot API (getChat), so the admin
// sees the username/name BEFORE the row is created.
router.get('/admins/verify', async (req, res) => {
  try {
    const raw = String(req.query.id || '').trim().replace(/^@/, '')
    if (!/^\d+$/.test(raw)) return res.status(400).json({ error: 'a numeric Telegram User ID is required' })
    const chatId = Number(raw)
    const token = process.env.BOT_TOKEN
    if (!token) return res.status(503).json({ error: 'bot is not configured on the server' })


    let profile = null
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`, {
        method: 'GET',
      })
      const j = await r.json().catch(() => null)
      if (j?.ok && j.result) {
        profile = {
          tg_user_id: chatId,
          username: j.result.username || null,
          first_name: j.result.first_name || j.result.title || null,
          name: [j.result.first_name, j.result.last_name].filter(Boolean).join(' ') || j.result.title || null,
        }
      }
    } catch (e) {
      console.warn('[admin-miniapp] getChat lookup failed:', e.message)
    }

    if (!profile) {
      return res.status(404).json({
        error: 'Telegram has no chat with this ID — the user must message the bot first (/start), then verify again',
      })
    }
    res.json({ profile })
  } catch (e) {
    console.error('[admin-miniapp] verify failed:', e.message)
    res.status(503).json({ error: 'verification failed' })
  }
})

router.post('/admins', async (req, res) => {
  try {
    const { tg_user_id, name } = req.body || {}
    const id = Number(tg_user_id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'a verified Telegram User ID is required' })
    }
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' })
    const { rows } = await pool.query(
      `INSERT INTO staff_admins (tg_user_id, username, name, role, shift, branch, refund_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.body.username || null, String(name).trim(), req.body.role || 'cashier',
        req.body.shift || 'morning', req.body.branch || 'Main', Number(req.body.refund_limit) || 0]
    )
    res.status(201).json({ admin: staffView(rows[0]) })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'this Telegram User ID is already an admin' })
    console.error('[admin-miniapp] admin create failed:', e.message)
    res.status(503).json({ error: 'could not create admin' })
  }
})

router.patch('/admins/:tgUserId', async (req, res) => {
  try {
    const id = Number(req.params.tgUserId)
    const fields = ['role', 'shift', 'branch', 'active', 'refund_limit', 'name', 'username']
    const sets = []
    const params = []
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { params.push(req.body[f]); sets.push(`${f} = $${params.length}`) }
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE staff_admins SET ${sets.join(', ')} WHERE tg_user_id = $1 RETURNING *`, params
    )
    if (!rows.length) return res.status(404).json({ error: 'admin not found' })
    res.json({ admin: staffView(rows[0]) })
  } catch (e) {
    console.error('[admin-miniapp] admin update failed:', e.message)
    res.status(503).json({ error: 'could not update admin' })
  }
})

router.delete('/admins/:tgUserId', async (req, res) => {
  try {
    const id = Number(req.params.tgUserId)
    const { rows } = await pool.query(
      `DELETE FROM staff_admins WHERE tg_user_id = $1 RETURNING tg_user_id, name`, [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'admin not found' })
    res.json({ ok: true, archived: true, tg_user_id: rows[0].tg_user_id })
  } catch (e) {
    console.error('[admin-miniapp] admin delete failed:', e.message)
    res.status(503).json({ error: 'could not delete admin' })
  }
})

// ── Announcements (customer broadcast via bot) ─────────────────────────
router.get('/announcements', async (_req, res) => {
  try {
    res.json({ announcements: await listAnnouncements() })
  } catch (e) {
    console.error('[admin-miniapp] announcements read failed:', e.message)
    res.status(503).json({ error: 'could not load announcements' })
  }
})

router.post('/announcements', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim()
    if (!message) return res.status(400).json({ error: 'message is required' })
    if (message.length > 300) return res.status(400).json({ error: 'message must be 300 characters or fewer' })
    const announcement = await createAnnouncement(message, req.user?.firstName || req.user?.username || 'Owner')
    // Fan out: admin devices get it instantly; every Telegram customer
    // gets it as a bot message (best-effort, never blocks the response).
    req.app.get('io')?.to('admins').emit('announcement:new', announcement)
    setImmediate(() => {
      try {
        const io2 = req.app.get('io')
        if (io2?.broadcastToCustomers) io2.broadcastToCustomers(message)
      } catch (err) { console.warn('[admin-miniapp] broadcast failed (non-fatal):', err.message) }
    })
    res.status(201).json({ announcement })
  } catch (e) {
    console.error('[admin-miniapp] announcement create failed:', e.message)
    res.status(503).json({ error: 'could not create announcement' })
  }
})

// ── Pause / closure history (Reports page) ─────────────────────────────
router.get('/pause-history', async (_req, res) => {
  try {
    res.json({ history: await listPauseEvents() })
  } catch (e) {
    console.error('[admin-miniapp] pause history read failed:', e.message)
    res.status(503).json({ error: 'could not load pause history' })
  }
})

// ── Revenue (Page 8) — per day|week|month from real orders ─────────────
router.get('/revenue', async (req, res) => {
  try {
    const period = ['day', 'week', 'month'].includes(String(req.query.period))
      ? String(req.query.period) : 'day'
    const interval = period === 'day' ? `date_trunc('day', now())`
      : period === 'week' ? `now() - interval '7 days'`
      : `now() - interval '30 days'`
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS orders,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::int AS revenue,
              COUNT(*) FILTER (WHERE service_type = 'delivery' AND payment_status = 'paid')::int AS delivered
         FROM orders
        WHERE created_at >= ${interval}`
    )
    res.json({ period, ...rows[0] })
  } catch (e) {
    console.error('[admin-miniapp] revenue read failed:', e.message)
    res.status(503).json({ error: 'could not load revenue' })
  }
})

export default router
