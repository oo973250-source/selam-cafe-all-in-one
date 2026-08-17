/**
 * server/routes/auth.js
 * ---------------------
 * Telegram Login Widget verification for admin auth.
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import 'dotenv/config'

import { signToken } from '../middleware/auth.js'
import { pool } from '../db.js'

const router = Router()
const BOT_TOKEN = process.env.BOT_TOKEN
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean)

function verifyTelegramLogin(auth) {
  if (!BOT_TOKEN || !auth?.hash || !auth?.auth_date) return false
  const ageSec = (Date.now() / 1000) - Number(auth.auth_date)
  if (ageSec > 86400) return false

  const { hash, ...rest } = auth
  const dataCheckString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n')

  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  if (hmac.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'))
}

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' })
  res.json({ user: req.user })
})

router.post('/telegram-callback', async (req, res) => {
  const auth = req.body
  if (!verifyTelegramLogin(auth)) {
    return res.status(401).json({ error: 'invalid Telegram login' })
  }

  const tgUserId = Number(auth.id)
  if (ADMIN_IDS.length && !ADMIN_IDS.includes(tgUserId)) {
    return res.status(403).json({ error: 'your Telegram account is not on the admin allowlist' })
  }

  await pool.query(
    `INSERT INTO admin_users (tg_user_id, tg_username, tg_first_name, last_login)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (tg_user_id)
     DO UPDATE SET tg_username = $2, tg_first_name = $3, last_login = now()`,
    [tgUserId, auth.username || null, auth.first_name || null]
  )

  const token = signToken({
    tgUserId,
    username: auth.username || null,
    firstName: auth.first_name || null,
    role: 'staff',
  })

  res.cookie('selam_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({
    user: {
      tgUserId,
      username: auth.username,
      firstName: auth.first_name,
      photoUrl: auth.photo_url,
      role: 'staff',
    },
  })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('selam_token')
  res.json({ ok: true })
})

export default router
