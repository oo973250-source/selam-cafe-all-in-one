/**
 * server/routes/admin-miniapp.js
 * ------------------------------
 * Authentication for the Admin Mini App (Telegram-native admin panel,
 * mounted by the server at /amadmin once built).
 *
 * Flow (matches the contract given to the miniapp builder):
 *   1. Mini App sends { initData: "<raw Telegram.WebApp.initData>" }.
 *   2. We verify it with the official Telegram HMAC-SHA-256 scheme
 *      (reusing verifyTelegramInitData from the customer order path —
 *      secret = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN), 24h
 *      freshness, timing-safe compare).
 *   3. We check the verified Telegram ID against the SAME admin allowlist
 *      the bot uses (ADMIN_TELEGRAM_IDS + NOTIFY_CHAT_IDS +
 *      OWNER_TELEGRAM_ID — mirrors isAdmin() in bot.js).
 *   4. On success we mint a JWT with role 'owner' (full menu/category/
 *      blocklist write access via requireRole) and return
 *      { token, user } — the miniapp then calls the admin APIs with
 *      `Authorization: Bearer <token>` (NOT cookies; SameSite is
 *      unreliable inside the Telegram webview).
 *
 * No new env vars: reuses BOT_TOKEN + JWT_SECRET + the allowlist vars.
 */

import { Router } from 'express'
import { verifyTelegramInitData } from './miniapp.js'
import { signToken } from '../middleware/auth.js'
import { pool } from '../db.js'

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

    // Track last login in admin_users (same table the web panel uses).
    // Non-fatal: identity is already cryptographically verified; a DB blip
    // must not lock the owner out of their panel.
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

    // role 'owner' → passes every requireRole('manager','owner') check,
    // so the miniapp gets FULL control: orders, menu, categories, blocklist.
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

export default router
