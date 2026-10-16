#!/usr/bin/env node
/**
 * E2E verification for the live preview environment (BOT_TOKEN = TEST preview token).
 * Scenarios:
 *   1. Block user  → their active orders vanish from GET /api/orders (admin queue)
 *                    and new orders from them are rejected 403 {blocked:true}
 *   2. Order limit → set limit 1 → second order rejected 429 {order_limit:true} with clear message
 *   3. Delivery toggle → delivery_available=false → delivery orders rejected 409
 *                        {delivery_unavailable:true}; dine-in still OK; intake status exposed
 *
 * Auth paths exercised with REAL mechanisms:
 *   - Customer: signed Telegram initData (HMAC with the current BOT_TOKEN) → /api/miniapp/orders
 *   - Admin queue: POST /api/admin-miniapp/auth with owner initData → Bearer JWT → GET /api/orders
 *   - Settings: PATCH /api/admin-miniapp/settings with the same JWT
 * (Bot long-polling is not started in preview; sendOrderConfirmation/notifyStaff fail-open.)
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { pool } from '../db.js'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const BOT_TOKEN = process.env.BOT_TOKEN
const OWNER_ID = 8258968768
const VICTIM_ID = 100155733 // fake "scammer" Telegram ID for the block test
const VICTIM_USER = { id: VICTIM_ID, first_name: 'E2E', username: 'e2e_block_victim', language_code: 'en' }

if (!BOT_TOKEN) {
  console.error('FATAL: BOT_TOKEN missing in env')
  process.exit(2)
}

// ── signed initData helper (mirrors Telegram's official scheme) ──────────
function makeInitData(user) {
  const authDate = Math.floor(Date.now() / 1000)
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAF' + crypto.randomBytes(4).toString('hex'),
    user: JSON.stringify(user),
  })
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return `${params.toString()}&hash=${hash}`
}

function orderPayload(serviceType, itemId, total, name) {
  return {
    type: 'cafe_order',
    at: new Date().toISOString(),
    serviceType,
    customer: { name, location: null },
    items: [{ id: itemId, nameEn: name, price: total, quantity: 1 }],
    total,
    trustLevel: 1,
  }
}

async function postOrder(initData, payload) {
  const res = await fetch(`${BASE}/api/miniapp/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, order: payload }),
  })
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function adminAuth() {
  const res = await fetch(`${BASE}/api/admin-miniapp/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: makeInitData({ id: OWNER_ID, first_name: 'Owner', username: 'cafe_owner' }) }),
  })
  const body = await res.json()
  if (res.status !== 200 || !body.token) throw new Error(`admin auth failed: ${res.status} ${JSON.stringify(body)}`)
  return body.token
}

async function adminReq(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, body: data }
}

// ── cleanup helper: wipe created test rows ──────────────────────────────
async function cleanup() {
  await pool.query(`DELETE FROM orders WHERE tg_user_id IN ($1, $2)`, [VICTIM_ID, OWNER_ID])
    .catch(async () => {
      // owner has shift/admin rows too; scope to customer tg ids only
      await pool.query(`DELETE FROM orders WHERE tg_user_id = $1 OR (tg_user_id = $2 AND items::text LIKE '%e2e%')`, [VICTIM_ID, OWNER_ID])
    })
  await pool.query(`DELETE FROM blocked_users WHERE tg_user_id = $1`, [VICTIM_ID])
  await pool.query(`UPDATE store_settings SET order_limit = 0, delivery_available = true,
                    paused = false, pause_until = null, close_until = null WHERE id = 1`)
}

let failures = 0
function check(name, cond, detail = '') {
  const ok = !!cond
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

// ═══════════════════════════ RUN TESTS ═══════════════════════════
await cleanup()

const firstMenuItem = (await pool.query(`SELECT id, price FROM menu_items WHERE available = true ORDER BY id LIMIT 1`)).rows[0]
if (!firstMenuItem) { console.error('FATAL: no menu items'); process.exit(2) }
const ITEM_ID = firstMenuItem.id
const ITEM_PRICE = Number(firstMenuItem.price)

// Get an admin token once
const TOKEN = await adminAuth()

// Get an admin JWT for the OWNER, plus a customer initData for the OWNER
const ownerInit = makeInitData({ id: OWNER_ID, first_name: 'Owner', username: 'cafe_owner', language_code: 'en' })

// Seed store settings baseline: no limit, delivery ON, order ON
const s0 = (await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', {
  order_limit: 0, delivery_available: true, paused: false, pause_until: null, close_until: null,
})).body?.settings
check('baseline settings applied', s0 && s0.order_limit === 0 && s0.delivery_available === true,
  `order_limit=${s0?.order_limit} delivery=${s0?.delivery_available}`)

// ═════════════════ SCENARIO 3 (first, while unblocked) ═════════════════
console.log('\n—— SCENARIO 3: Delivery toggle ——')
const dineIn = await postOrder(ownerInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('baseline: dine-in order accepted while delivery ON', dineIn.status === 200 && dineIn.body?.ok, `status=${dineIn.status} body=${JSON.stringify(dineIn.body).slice(0, 120)}`)
const deliveryOk = await postOrder(ownerInit, orderPayload('delivery', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('baseline: delivery order accepted while delivery ON', deliveryOk.status === 200 && deliveryOk.body?.ok, `status=${deliveryOk.status} body=${JSON.stringify(deliveryOk.body).slice(0, 120)}`)
await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', { delivery_available: false }) // test body
const deliveryOff = await postOrder(ownerInit, orderPayload('delivery', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('delivery order REJECTED when delivery OFF (409 + delivery_unavailable)', deliveryOff.status === 409 && deliveryOff.body?.delivery_unavailable === true, `status=${deliveryOff.status} body=${JSON.stringify(deliveryOff.body).slice(0, 160)}`)
check('rejection carries a clear customer-facing message', typeof deliveryOff.body?.message === 'string' && /delivery is currently unavailable/i.test(deliveryOff.body?.message || ''), JSON.stringify(deliveryOff.body?.message))
const dineInDeepOff = await postOrder(ownerInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('dine-in still ACCEPTED when delivery OFF', dineInDeepOff.status === 200 && dineInDeepOff.body?.ok, `status=${dineInDeepOff.status} body=${JSON.stringify(dineInDeepOff.body).slice(0, 120)}`)

// customer-facing intake status (public): GET /api/miniapp/intake?  → check what exists
// Route may or may not be public; skip if 404/401, only assert when reachable.
const intake = await fetch(`${BASE}/api/miniapp/intake`).catch(() => null)
let intakeJson = null
try { intakeJson = intake ? await intake.json() : null } catch {}
if (intake && intake.status === 200 && intakeJson) {
  check('public intake status exposes delivery_available=false', intakeJson?.delivery_available === false, JSON.stringify(intakeJson).slice(0, 160))
}

// restore delivery ON
await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', { delivery_available: true })
const deliveryBack = await postOrder(ownerInit, orderPayload('delivery', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('delivery order ACCEPTED again after re-enable', deliveryBack.status === 200 && deliveryBack.body?.ok, `status=${deliveryBack.status} body=${JSON.stringify(deliveryBack.body).slice(0, 120)}`)

// ═════════════════ SCENARIO 2 (while nothing blocked) ═════════════════
console.log('\n—— SCENARIO 2: Order limit ——')
await cleanup() // clear the accepted orders so we start with a clean active queue
await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', { order_limit: 1 })
const o1 = await postOrder(ownerInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('1st order accepted under limit=1', o1.status === 200 && o1.body?.ok, `status=${o1.status} body=${JSON.stringify(o1.body).slice(0, 120)}`)
const o2 = await postOrder(ownerInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('2nd order REJECTED with 429 + order_limit flag', o2.status === 429 && o2.body?.order_limit === true, `status=${o2.status} body=${JSON.stringify(o2.body).slice(0, 160)}`)
check('429 carries a clear customer-facing message', typeof o2.body?.message === 'string' && /kitchen is at capacity/i.test(o2.body?.message || ''), JSON.stringify(o2.body?.message))
// lift the limit and verify orders flow again
await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', { order_limit: 0 })
const o3 = await postOrder(ownerInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'Owner E2E'))
check('order accepted again after lifting the limit', o3.status === 200 && o3.body?.ok, `status=${o3.status} body=${JSON.stringify(o3.body).slice(0, 120)}`)

// ═════════════════ SCENARIO 1 (blocklist while queue has orders) ═════════════════
console.log('\n—— SCENARIO 1: Block user → orders vanish from New Orders ——')
await adminReq(TOKEN, 'PATCH', '/api/admin-miniapp/settings', { paused: false, pause_until: null, close_until: null })
// place two active orders from the victim
const vInit = makeInitData(VICTIM_USER)
const vOrder1 = await postOrder(vInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'E2E Victim'))
check('victim order #1 accepted (before block)', vOrder1.status === 200 && vOrder1.body?.ok, `status=${vOrder1.status} body=${JSON.stringify(vOrder1.body).slice(0, 120)}`)
const vOrder2 = await postOrder(vInit, orderPayload('takeaway', ITEM_ID, ITEM_PRICE, 'E2E Victim'))
check('victim order #2 accepted (before block)', vOrder2.status === 200 && vOrder2.body?.ok, `status=${vOrder2.status} body=${JSON.stringify(vOrder2.body).slice(0, 120)}`)

const queueBefore = (await adminReq(TOKEN, 'GET', '/api/orders?limit=200')).body?.orders || []
const victimInQueueBefore = queueBefore.filter((o) => String(o.tg_user_id) === String(VICTIM_ID))
check('victim orders visible in New Orders queue BEFORE block', victimInQueueBefore.length >= 2, `count=${victimInQueueBefore.length}`)

// BLOCK the victim through the real admin endpoint
const blockRes = await adminReq(TOKEN, 'POST', '/api/blocked-users', { idOrUsername: String(VICTIM_ID), reason: 'e2e preview test' })
check('block endpoint succeeded', blockRes.status === 200 && blockRes.body?.ok, `status=${blockRes.status} body=${JSON.stringify(blockRes.body).slice(0, 160)}`)

// Immediately refresh the admin queue — blocked user's orders must be gone
const queueAfter = (await adminReq(TOKEN, 'GET', '/api/orders?limit=200')).body?.orders || []
const victimInQueueAfter = queueAfter.filter((o) => String(o.tg_user_id) === String(VICTIM_ID))
check('victim orders GONE from New Orders immediately after block', victimInQueueAfter.length === 0, `count=${victimInQueueAfter.length}`)
check('other (owner) orders still visible in queue', queueAfter.some((o) => String(o.tg_user_id) === String(OWNER_ID)), `queue size=${queueAfter.length}`)

// Bot-path equivalent: bot web_app_data path runs isUserBlocked before saving; HTTP path here must mirror it.
const newOrderWhileBlocked = await postOrder(vInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'E2E Victim'))
check('new order from blocked user REJECTED 403', newOrderWhileBlocked.status === 403 && newOrderWhileBlocked.body?.blocked === true, `status=${newOrderWhileBlocked.status} body=${JSON.stringify(newOrderWhileBlocked.body).slice(0, 160)}`)
check('403 message is customer-friendly', /restricted/i.test(newOrderWhileBlocked.body?.message || ''), JSON.stringify(newOrderWhileBlocked.body?.message))

// Order history must still contain the victim's rows (revenue/audit preserved)
const historyCount = (await pool.query(`SELECT COUNT(*)::int AS c FROM orders WHERE tg_user_id = $1`, [VICTIM_ID])).rows[0].c
check('victim order history PRESERVED in DB (not erased)', historyCount >= 2, `rows=${historyCount}`)

// Unblock restores ordering
const unblock = await adminReq(TOKEN, 'DELETE', `/api/blocked-users/${VICTIM_ID}`)
check('unblock endpoint succeeded', unblock.status === 200 && unblock.body?.ok, `status=${unblock.status}`)
const afterUnblock = await postOrder(vInit, orderPayload('dine_in', ITEM_ID, ITEM_PRICE, 'E2E Victim'))
check('blocked victim CAN order again after unblock', afterUnblock.status === 200 && afterUnblock.body?.ok, `status=${afterUnblock.status} body=${JSON.stringify(afterUnblock.body).slice(0, 120)}`)

console.log('\n—— RESULT ——')
console.log(failures === 0 ? 'ALL E2E CHECKS PASSED ✅' : `${failures} CHECK(S) FAILED ❌`)
process.exit(failures === 0 ? 0 : 1)
