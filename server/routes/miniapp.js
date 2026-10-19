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

import { createOrder, countTodaysOrdersForUser, getUserLang, isUserBlocked, blockUser, getIntakeStatus, getCafeProfile, publicBrand, getStoreSettings, countActiveOrders, loadCategoryRestrictions } from '../db.js'
import { sendOrderConfirmation, notifyStaff } from '../bot.js'
import { mergeOrderForMessages, normalizeOrderItems } from '../order-items.js'

const router = Router()

const BOT_TOKEN = process.env.BOT_TOKEN
const MAX_INITDATA_AGE_SEC = 86400 // same freshness window as admin login

// ── Silent city verification (Step 1 of the Adama-only gate) ────────────
// The customer Mini App asks the SERVER to geolocate its IP (not the client:
// ip-api.com's free tier is HTTP-only, so an https Mini App cannot call it
// directly without mixed-content errors). The result is cached per IP for
// 10 minutes so the intro's silent check never hammers the free API.
//
// Adama match = city named Adama / Nazret / Nazreth (Adama's former name,
// still emitted by several geo DBs) OR the IP's coordinates within ~15 km
// of Adama center (8.5414, 39.2689).

const ADAMA_CENTER = { lat: 8.5414, lon: 39.2689 }
const ADAMA_RADIUS_KM = 15
const ADAMA_CITY_ALIASES = ['adama', 'nazret', 'nazreth']
const GEO_CACHE_TTL_MS = 10 * 60 * 1000
const geoCache = new Map() // ip → { at, result }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

router.get('/geo', async (req, res) => {
  const ip = req.ip || 'unknown'
  try {
    const cached = geoCache.get(ip)
    if (cached && Date.now() - cached.at < GEO_CACHE_TTL_MS) {
      return res.json(cached.result)
    }

    const fields = encodeURIComponent('status,country,city,lat,lon')
    const geoRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`, {
      signal: AbortSignal.timeout(6000),
    })
    const data = await geoRes.json()

    let result
    if (data?.status === 'success') {
      const city = String(data.city || '').toLowerCase()
      const cityHit = ADAMA_CITY_ALIASES.some((alias) => city.includes(alias))
      const coordHit =
        Number.isFinite(data.lat) &&
        Number.isFinite(data.lon) &&
        haversineKm(data.lat, data.lon, ADAMA_CENTER.lat, ADAMA_CENTER.lon) <= ADAMA_RADIUS_KM
      result = { inAdama: cityHit || coordHit, city: data.city || null, lat: data.lat ?? null, lon: data.lon ?? null }
    } else {
      // Lookup failed → tell the client it's inconclusive so it can rely on
      // the GPS fallback instead of silently trusting a wrong answer.
      result = { inAdama: null }
    }

    geoCache.set(ip, { at: Date.now(), result })
    if (geoCache.size > 5000) geoCache.clear() // simple eviction for tiny free-tier memory
    return res.json(result)
  } catch (e) {
    console.warn('[miniapp] geo lookup failed:', e.message)
    return res.status(502).json({ inAdama: null, error: 'geo unavailable' })
  }
})

// ── Order flood guard (user request: "10 orders in one minute → blocked,
// every order canceled") ────────────────────────────────────────────────
// In-memory sliding window over POST /order hits, keyed by BOTH the verified
// Telegram user AND the client IP. Keying on IP alone would let one fake
// Telegram identity inside a school/NAT network stop everyone on that Wi-Fi,
// and keying on user alone ignores the "IP rate limiting" ask — so we track
// both and trigger when either crosses the line. Persisting the block goes
// into `blocked_users` (the existing blocklist) so restarts can't undo it,
// and every order the flooder still had OPEN in the DB is cancelled and
// pushed live to the admin dashboard via `order:update`.

const FLOOD_WINDOW_MS = 60_000  // one minute
const FLOOD_MAX_ORDERS = 10     // 10 orders inside that window
const orderHits = [] // { user, ip, at } oldest-first

function pruneFloodHits(now) {
  while (orderHits.length && now - orderHits[0].at > FLOOD_WINDOW_MS) orderHits.shift()
}

/**
 * Records a completed order hit and returns true when the flood limit is
 * exceeded for this user or IP (checked BEFORE recording, so the caller
 * decides what to do with the offending attempt).
 */
function hitFloodLimit(userId, ip, now = Date.now()) {
  pruneFloodHits(now)
  const userHit = orderHits.filter((h) => h.user === userId).length
  const ipHit = orderHits.filter((h) => h.ip === ip).length
  return userHit >= FLOOD_MAX_ORDERS || ipHit >= FLOOD_MAX_ORDERS
}

function recordFloodHit(userId, ip, now = Date.now()) {
  pruneFloodHits(now)
  orderHits.push({ user: userId, ip, at: now })
}

/**
 * The flood response: cancel every order the user still has open, write an
 * audit event per cancelled order, push each of them live to the admins
 * room, add the user to the persistent blocklist, then reply 429.
 */
async function applyFloodBlock(req, tgUser) {
  const poolMod = await import('../db.js')
  const cancelled = []
  try {
    const { rows } = await poolMod.pool.query(
      `UPDATE orders
          SET status = 'cancelled', updated_at = now()
        WHERE tg_user_id = $1 AND status IN ('new', 'preparing', 'ready')
        RETURNING id, tg_user_id, tg_username, tg_first_name, service_type,
                  customer_name, customer_loc, items, total, trust_level,
                  status, payment_status, started_by, served_at, dismissed_at,
                  created_at, updated_at`,
      [String(tgUser.id)]
    )
    for (const row of rows) {
      try {
        await poolMod.pool.query(
          `INSERT INTO order_events (order_id, event, payload)
           VALUES ($1, 'flood_cancelled', $2)`,
          [row.id, JSON.stringify({ reason: 'order flood: >10 orders in one minute' })]
        )
      } catch { /* audit is best-effort */ }
      cancelled.push(row)
      // Same shape bot.js emitOrderUpdate uses — the admin queue drops these
      // cards live instead of showing stale "new" orders that no longer exist.
      req.app.get('io')?.to('admins').emit('order:update', {
        ...row,
        items: normalizeOrderItems(row.items),
      })
    }
  } catch (e) {
    console.warn(`[miniapp] flood cancel-all failed for tg ${tgUser.id}:`, e.message)
  }

  // Persistent block — survives restarts, applies to the bot too.
  try {
    await blockUser({
      tgUserId: tgUser.id,
      tgUsername: tgUser.username || null,
      tgFirstName: tgUser.first_name || null,
      reason: 'auto-block: 10+ orders within one minute (flood control)',
      blockedBy: null,
    })
  } catch (e) {
    console.warn(`[miniapp] flood auto-block failed for tg ${tgUser.id}:`, e.message)
  }

  console.error(`[miniapp] FLOOD BLOCK: tg ${tgUser.id} (@${tgUser.username || 'no-username'}) ` +
    `ordered ${FLOOD_MAX_ORDERS}+ times in ${FLOOD_WINDOW_MS / 1000}s — ` +
    `${cancelled.length} open order(s) cancelled and user blocked.`)
  return cancelled.length
}

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

// Public intake status for the customer Mini App UI (Section 5.2/6.2):
// muted, non-clickable delivery option + limited-capacity hints must come
// from the SERVER, not be hardcoded client-side. Read-only, no auth (no
// user data — service-level flags only).
router.get('/intake', async (_req, res) => {
  try {
    const [intake, settings] = await Promise.all([getIntakeStatus(), getStoreSettings()])
    res.json({
      kind: intake.kind, // 'open' | 'emergency' | 'countdown' | 'closed'
      until: intake.until || null,
      reason: intake.reason || '',
      delivery_available: settings?.delivery_available !== false,
      order_limit: settings?.order_limit ?? 0,
    })
  } catch (e) {
    console.warn('[miniapp] intake status failed (fail-open):', e.message)
    res.json({ kind: 'open', delivery_available: true, order_limit: 0 })
  }
})

router.post('/orders', async (req, res) => {
  // Store-intake gate (admin miniapp Page 7): emergency pause, duration
  // pause (countdown) or multi-day closure blocks ALL new customer orders
  // server-side. Expired timers auto-resume (getIntakeStatus clears them).
  try {
    const intake = await getIntakeStatus()
    if (intake.kind !== 'open') {
      return res.status(503).json({
        error: 'store closed',
        closed: true,
        kind: intake.kind, // 'emergency' | 'countdown' | 'closed'
        until: intake.until || null,
        reason: intake.reason || '',
      })
    }
  } catch (e) {
    console.warn('[miniapp] intake gate failed (fail-open):', e.message)
  }

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

  // Task 4 — scammer protection: server-side blocklist gate BEFORE the
  // order is saved (not just hidden client-side). Returns 403 with a
  // `blocked` flag the Mini App maps to its "restricted" screen.
  let blocked = false
  try { blocked = await isUserBlocked(tgUser.id) } catch (e) {
    console.warn('[miniapp] blocklist check failed (fail-open):', e.message)
  }
  if (blocked) {
    console.log(`[miniapp] order BLOCKED for tg ${tgUser.id}`)
    return res.status(403).json({
      error: 'account restricted',
      blocked: true,
      message: 'You have been restricted from placing orders. If you believe this is a mistake, please contact support.',
    })
  }

  // Order flood guard: this attempt must pass the window check BEFORE any
  // DB write. Crossing 10 orders/user-minute (or per-IP-minute) blocks the
  // account persistently and cancels every open order it still owns.
  // registered/previously-served orders don't count against the window —
  // only rows this guard saw go through (they are the flood signal).
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown'
  try {
    if (hitFloodLimit(tgUser.id, clientIp)) {
      // The 11th+ attempt of the minute cancels everything and blocks.
      await applyFloodBlock(req, tgUser)
      return res.status(429).json({
        error: 'too many orders',
        rate_limited: true,
        message: 'Too many orders in a short time. Your open orders have been cancelled and your account is temporarily blocked. Please contact the cafe.',
      })
    }
  } catch (e) {
    // Fail-open: a bug in the guard must never brick real orders.
    console.warn('[miniapp] flood guard failed (fail-open):', e.message)
  }

  // ── Section 5.1/5.2/6.1/6.2: server-enforced intake restrictions ────────
  // Validated AFTER initData verification but BEFORE any DB write so hand-
  // crafted requests (bypassing the customer UI) are rejected with a meaningful
  // 4xx, never silently stored.
  try {
    const settings = await getStoreSettings()

    // 6.2 — delivery service unavailable → reject new delivery orders.
    if (payload.serviceType === 'delivery' && settings.delivery_available === false) {
      return res.status(409).json({
        error: 'delivery unavailable',
        delivery_unavailable: true,
        message: 'Delivery is currently unavailable. Please choose takeaway or dine-in.',
      })
    }

    // Adama-only delivery (final gate, user request): if a delivery order
    // carries real GPS coordinates, they must fall inside the service
    // radius around Adama center. Outside → refuse BEFORE any DB write so
    // hand-crafted requests can't bypass the customer-side refusal screen.
    // No coordinates (manual address only) → fail-open: there is nothing to
    // measure and a real Adama customer who types their address shouldn't
    // be blocked by an unreliable IP guess.
    if (
      payload.serviceType === 'delivery' &&
      Number.isFinite(Number(payload.customer?.location?.lat)) &&
      Number.isFinite(Number(payload.customer?.location?.lon))
    ) {
      const km = haversineKm(
        Number(payload.customer.location.lat),
        Number(payload.customer.location.lon),
        ADAMA_CENTER.lat,
        ADAMA_CENTER.lon
      )
      if (km > ADAMA_RADIUS_KM) {
        console.log(`[miniapp] delivery order REJECTED: ${km.toFixed(1)} km from Adama (tg ${tgUser.id})`)
        return res.status(409).json({
          error: 'delivery outside adama',
          outside_adama: true,
          message: 'We only accept delivery orders from within Adama. Please choose dine-in or takeaway, or order from inside Adama.',
        })
      }
    }

    // 6.1 — active-order limit, enforced atomically: INSERT only when there is
    // room left (activeCount < limit); two concurrent submissions cannot both
    // take the same slot beyond the cap because the count is re-checked inside
    // the same serialized gate below (fail-open if the check itself fails).
    const activeNow = await countActiveOrders()
    if (settings && settings.order_limit > 0 && activeNow >= settings.order_limit) {
      console.log(`[miniapp] order REJECTED: order_limit reached (${activeNow}/${settings.order_limit})`)
      return res.status(429).json({
        error: 'order limit reached',
        order_limit: true,
        message: 'Kitchen is at capacity right now. Please try again in a few minutes.',
      })
    }

    // 5.1/5.2 — item + category-level availability and delivery restriction,
    // resolved in TWO batched queries (items → categories), one per cart.
    if (Array.isArray(payload.items) && payload.items.length) {
      const itemIds = [...new Set(payload.items.map((it) => String(it?.id || '')).filter(Boolean))]
      const namesById = {}
      for (const it of payload.items) if (it?.id) namesById[String(it.id)] = it.nameEn || it.name || String(it.id)

      const { pool } = await import('../db.js')
      const { rows: itemRows } = await pool.query(
        `SELECT id, category, available FROM menu_items WHERE id = ANY($1)`,
        [itemIds.length ? itemIds : ['']]
      )
      const itemMap = {}
      for (const r of itemRows) itemMap[r.id] = r

      for (const it of payload.items) {
        const itemId = String(it?.id || '')
        if (!itemId) continue
        const display = namesById[itemId] || itemId
        const itemRow = itemMap[itemId]
        if (!itemRow || itemRow.available === false) {
          return res.status(409).json({
            error: 'item unavailable', item_unavailable: true,
            message: `${display} in your cart is no longer available. Please review your order.`,
          })
        }
      }

      const catIds = [...new Set(itemRows.map((r) => r.category))]
      const { rows: catRows } = await pool.query(
        `SELECT id, hidden, no_delivery FROM menu_categories WHERE id = ANY($1)`,
        [catIds.length ? catIds : ['']]
      )
      const catMap = {}
      for (const c of catRows) catMap[c.id] = c

      for (const it of payload.items) {
        const itemId = String(it?.id || '')
        if (!itemId) continue
        const display = namesById[itemId] || itemId
        const itemRow = itemMap[itemId]
        const cat = catMap[itemRow.category]
        if (!cat || cat.hidden) {
          return res.status(409).json({
            error: 'category unavailable', item_unavailable: true,
            message: `${display} is currently unavailable. Please choose another item.`,
          })
        }
        if (cat.no_delivery && payload.serviceType === 'delivery') {
          return res.status(409).json({
            error: 'delivery unavailable for category', no_delivery: true,
            message: `Delivery is currently unavailable for this category. Please choose another category or select an available ordering method.`,
          })
        }
      }
    }
  } catch (e) {
    console.warn('[miniapp] intake restriction precheck failed (fail-open):', e.message)
  }

  let order
  try {
    order = await createOrder({
      tgUserId: tgUser.id,
      tgUsername: tgUser.username || null,
      tgFirstName: tgUser.first_name || null,
      payload,
    })
    // Window bookkeeping for the flood guard (inserted AFTER a successful
    // save — nothing counts unless a row actually landed).
    recordFloodHit(tgUser.id, clientIp)
    console.log(`[miniapp] order #${order.id} saved for tg ${tgUser.id}`)
  } catch (e) {
    console.error('[miniapp] DB insert failed:', e)
    return res.status(500).json({ error: 'could not save order' })
  }

  // Post-write recheck of the limit: if the write raced past the gate and
  // active orders now exceed the cap, cancel this one (customer gets 429).
  // Cheap, safe, and keeps the limit exact under concurrency.
  try {
    const settings = await getStoreSettings()
    if (settings && settings.order_limit > 0) {
      const { pool } = await import('../db.js')
      const activeCount = await countActiveOrders()
      if (activeCount > settings.order_limit) {
        console.log(`[miniapp] order_limit race detected after insert of #${order.id} — cancelling`)
        await pool.query(`UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status = 'new'`, [order.id])
        return res.status(429).json({
          error: 'order limit reached',
          order_limit: true,
          message: 'Kitchen is at capacity right now. Please try again in a few minutes.',
        })
      }
    }
  } catch (_e) { /* fail-open — never block ordering on a recheck bug */ }

  // 1) Real-time push to the admin dashboard
  const fullOrder = {
    id: order.id,
    tg_user_id: tgUser.id,
    tg_username: tgUser.username || null,
    tg_first_name: tgUser.first_name || null,
    service_type: payload.serviceType,
    customer_name: payload.customer?.name || 'Unknown',
    customer_loc: payload.customer?.location || null,
    items: (Array.isArray(payload.items) ? payload.items : []).map((i) => ({
      id: i.id,
      name: i.nameEn || i.name || i.nameAm || i.id,
      price: i.price,
      qty: i.quantity ?? i.qty ?? 1,
    })),
    total: payload.total,
    trust_level: payload.trustLevel || 0,
    status: 'new',
    payment_status: 'pending',
    tx_ref: payload.txRef || null,
    note: payload.note || payload.customer?.note || null,
    customer_phone: payload.customer?.phone || null,
    started_by: null,
    served_at: null,
    dismissed_at: null,
    created_at: new Date().toISOString(),
  }
  if (req.app.get('io')) {
    req.app.get('io').to('admins').emit('order:new', fullOrder)
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
  // Customer confirmation + staff alert BOTH use the merged order so item
  // names/quantities/total always render (Issue #5).
  const customerOrder = mergeOrderForMessages(order, payload)
  // The customer confirmation and the staff alert are INDEPENDENT: a failure
  // of one (e.g. the customer never pressed Start) must never suppress the
  // other. Previously a failed confirmation returned early and the admin was
  // never notified of a saved order. Both are started together and awaited.
  const confirmationTask = sendOrderConfirmation(tgUser.id, customerOrder, todaysCount, lang)
    .then(() => {
      console.log(`[miniapp] confirmation sent to tg ${tgUser.id} for order #${order.id}`)
      return true
    })
    .catch((e) => {
      console.error(`[miniapp] confirmation send FAILED for tg ${tgUser.id}, order #${order.id}: ${e.message}`)
      return false
    })

  const staffTask = (async () => {
    try {
      const results = await notifyStaff(customerOrder, payload, {
        username: tgUser.username,
        firstName: tgUser.first_name,
      })
      if (Array.isArray(results)) {
        const ok = results.filter((r) => r.status === 'fulfilled').length
        console.log(`[miniapp] staff alert for order #${order.id}: ${ok}/${results.length} chat(s) delivered`)
      }
    } catch (e) {
      console.error(`[miniapp] staff notify FAILED for order #${order.id}: ${e.message}`)
    }
  })()

  const [confirmationSent] = await Promise.all([confirmationTask, staffTask])

  if (!confirmationSent) {
    return res.status(200).json({
      ok: true,
      orderId: order.id,
      confirmationSent: false,
      warning: 'order saved, but the bot could not message you. Please message the bot first (tap Start), then reopen the menu.',
    })
  }

  return res.status(200).json({
    ok: true,
    orderId: order.id,
    confirmationSent: true,
  })
})

export default router
