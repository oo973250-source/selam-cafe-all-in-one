/**
 * server/routes/miniapp.js
 * ------------------------
 * HTTP order submission for the customer Mini App (mounted at /api/miniapp).
 *
 * Why this exists:
 *   Telegram's WebApp.sendData() only delivers web_app_data when the Mini App
 *   was opened from a *keyboard button*. Mini Apps launched from the Menu
 *   Button or an inline link silently drop sendData, so orders placed there
 *   never reached the bot and the customer never got a confirmation message.
 *
 *   This route receives the order over HTTP instead. The Mini App includes
 *   its Telegram initData, which we verify with the official HMAC-SHA-256
 *   scheme (secret = HMAC_SHA256(botToken, "WebAppData")) so we know which
 *   real Telegram user is ordering and where to send the confirmation.
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import 'dotenv/config'

import { createOrder, countTodaysOrdersForUser, getUserLang } from '../db.js'
import { sendOrderConfirmation, notifyStaff } from '../bot.js'

const router = Router()

const BOT_TOKEN = process.env.BOT_TOKEN
const MAX_INITDATA_AGE_SEC = 86400 // same freshness window as admin login

/**
 * Verify Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the parsed user object, or null if verification fails.
 */
export function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData || typeof initData !== 'string') return null

  let params
  try {
    params = new URLSearchParams(initData)
  } catch {
    return null
  }

  const hash = params.get('hash')
  if (!hash) return null

  // Data-check-string: all fields except hash, sorted by key, joined with \n
  const pairs = []
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') pairs.push(`${key}=${value}`)
  }
  const dataCheckString = pairs.sort().join('\n')

  // auth_date freshness
  const authDate = Number(params.get('auth_date') || 0)
  if (!authDate || Date.now() / 1000 - authDate > MAX_INITDATA_AGE_SEC) return null

  // secret = HMAC_SHA256(key="WebAppData", message=botToken)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  if (computed.length !== hash.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))) return null

  // Extract the verified user
  try {
    const user = JSON.parse(params.get('user') || 'null')
    if (!user || typeof user.id !== 'number') return null
    return user
  } catch {
    return null
  }
}

router.post('/orders', async (req, res) => {
  const { initData, order: payload } = req.body || {}

  const tgUser = verifyTelegramInitData(initData)
  if (!tgUser) {
    console.error('[miniapp] order REJECTED: initData verification failed' +
      (initData ? ' (initData present — likely BOT_TOKEN mismatch)' : ' (initData MISSING — frontend not sending it)'))
    return res.status(401).json({ error: 'invalid or missing Telegram initData' })
  }
  console.log(`[miniapp] order received from tg ${tgUser.id}` +
    ` (@${tgUser.username || 'no-username'}): ${payload?.items?.length || 0} items, total ${payload?.total || 0} Br`)

  if (!payload || payload.type !== 'cafe_order' || !Array.isArray(payload.items)) {
    return res.status(400).json({ error: 'invalid order payload' })
  }

  let order
  try {
    order = await createOrder({
      tgUserId: tgUser.id,
      tgUsername: tgUser.username || null,
      tgFirstName: tgUser.first_name || null,
      payload,
    })
    console.log(`[miniapp] order #${order.id} saved for tg ${tgUser.id}`)
  } catch (e) {
    console.error('[miniapp] DB insert failed:', e)
    return res.status(500).json({ error: 'could not save order' })
  }

  // 1) Real-time push to the admin dashboard
  const fullOrder = {
    id: order.id,
    service_type: payload.serviceType,
    customer_name: payload.customer?.name || 'Unknown',
    customer_loc: payload.customer?.location || null,
    items: payload.items,
    total: payload.total,
    status: 'new',
  }
  if (req.app.get('io')) {
    req.app.get('io').emit('order:new', fullOrder)
  }

  // 2) Confirmation message to the customer through the bot
  let todaysCount = 0
  try {
    todaysCount = await countTodaysOrdersForUser(tgUser.id)
  } catch (e) {
    console.warn('[miniapp] countTodaysOrdersForUser failed:', e.message)
  }
  // Confirmation must arrive in the language the user picked in the bot
  // (falls back to their Telegram client language, then English).
  let lang = 'en'
  try { lang = await getUserLang(tgUser.id) } catch (_) { /* default en */ }
  try {
    await sendOrderConfirmation(tgUser.id, order, todaysCount, lang)
  } catch (e) {
    console.error('[miniapp] confirmation send failed:', e.message)
    return res.status(200).json({
      ok: true,
      orderId: order.id,
      confirmationSent: false,
      warning: 'order saved, but the bot could not message you. Please message the bot first (tap Start), then reopen the menu.',
    })
  }
  console.log(`[miniapp] confirmation sent to tg ${tgUser.id} for order #${order.id}`)

  // 3) Staff notification with action buttons
  try {
    notifyStaff(order, payload, {
      username: tgUser.username,
      firstName: tgUser.first_name,
    })
  } catch (e) {
    console.warn('[miniapp] staff notify failed:', e.message)
  }

  return res.status(200).json({
    ok: true,
    orderId: order.id,
    confirmationSent: true,
  })
})

export default router
