/**
 * server/scripts/test-admin-miniapp-auth.mjs
 * ------------------------------------------
 * Integration smoke test for the Admin Mini App auth endpoint
 * (POST /api/admin-miniapp/auth). Run with:
 *
 *     node server/scripts/test-admin-miniapp-auth.mjs
 *
 * What it does:
 *   1. Spawns the REAL server (node server/index.js) with a fake bot token,
 *      a throwaway JWT secret, an admin allowlist containing ONLY user
 *      999000111, and an unreachable DATABASE_URL (so nothing touches a
 *      real database and the Telegram bot is never started).
 *   2. Signs genuine Telegram-spec initData locally for two users.
 *   3. Asserts the full auth contract:
 *        - valid initData for an allowlisted admin → 200 { token, user }
 *          with user.role === 'owner' and a 30-day JWT payload
 *        - the returned token decodes to tgUserId + role 'owner'
 *        - the owner token passes requireAuth + requireRole('manager','owner')
 *          (proven by reaching the DB layer of POST /api/menu/categories,
 *          which yields 503 "database down" — NOT 401/403)
 *        - a legacy role:'staff' token (the old bug) is rejected with 403
 *          by the same middleware, proving the role actually matters
 *        - valid-signed initData from a NON-admin user → 403
 *        - tampered initData → 401
 *
 * No new dependencies: uses node:test-free plain asserts + child_process.
 */

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 3111
const BASE = `http://127.0.0.1:${PORT}`
const BOT_TOKEN = '12345:TEST-SELAM-ADMIN-AUTH-BOOTSTRAP'
const JWT_SECRET = 'test-only-secret-admin-miniapp'
const ADMIN_ID = 999000111
const NON_ADMIN_ID = 555000222

let passed = 0
let failed = 0
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

/** Sign initData exactly like Telegram does (same scheme verifyTelegramInitData expects). */
function makeInitData(user, authDateSec = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams()
  params.set('auth_date', String(authDateSec))
  params.set('query_id', 'AAtestqueryid')
  params.set('user', JSON.stringify(user))
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

async function api(method, path, { body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

async function main() {
  console.log('[test] spawning server on port', PORT, '(fake bot token, no DB)…')
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      BOT_TOKEN,
      JWT_SECRET,
      ADMIN_TELEGRAM_IDS: String(ADMIN_ID),
      NOTIFY_CHAT_IDS: '',
      OWNER_TELEGRAM_ID: '',
      // Unreachable DB → server boots in static-only mode, bot never starts,
      // and protected handlers deterministically fail at the DB layer (503)
      // once auth middleware has passed.
      DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/none',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  try {
    // Wait for /health
    let healthy = false
    for (let i = 0; i < 60 && !healthy; i++) {
      try {
        const r = await fetch(`${BASE}/health`)
        healthy = r.ok
      } catch { await sleep(250) }
    }
    if (!healthy) throw new Error('server did not become healthy in time')

    // ── 1. Valid admin initData → 200 { token, user } with role 'owner' ──
    console.log('\n[test] 1) POST /api/admin-miniapp/auth — valid admin initData')
    const adminUser = { id: ADMIN_ID, first_name: 'Cafe', last_name: 'Owner', username: 'selam_owner' }
    const ok = await api('POST', '/api/admin-miniapp/auth', { body: { initData: makeInitData(adminUser) } })
    check('status 200', ok.status === 200, `got ${ok.status}: ${JSON.stringify(ok.json)}`)
    check('token returned', typeof ok.json?.token === 'string' && ok.json.token.length > 20)
    check('user.role === owner', ok.json?.user?.role === 'owner', JSON.stringify(ok.json?.user))
    check('user.tgUserId matches initData', ok.json?.user?.tgUserId === ADMIN_ID)

    // ── 2. JWT payload decodes correctly (30-day expiry, owner claim) ──
    console.log('\n[test] 2) JWT payload')
    const payload = jwt.decode(ok.json.token)
    check('payload.role === owner', payload?.role === 'owner', JSON.stringify(payload))
    check('payload.tgUserId === ' + ADMIN_ID, payload?.tgUserId === ADMIN_ID)
    check('expiry ≈ 30 days', payload?.exp - payload?.iat === 30 * 24 * 60 * 60,
      `exp-iat = ${payload?.exp - payload?.iat}s`)
    const verified = jwt.verify(ok.json.token, JWT_SECRET)
    check('JWT verifies with server secret', verified?.role === 'owner')

    // ── 3. Owner token passes requireAuth + requireRole('manager','owner') ──
    // With the DB unreachable, reaching the handler = 503. A 401/403 would
    // mean the middleware chain rejected the token.
    console.log('\n[test] 3) owner token against requireRole-protected write endpoint')
    const write = await api('POST', '/api/menu/categories', {
      body: { name_en: 'Test Cat', section: 'food' },
      headers: { Authorization: `Bearer ${ok.json.token}` },
    })
    check('got 503 (middleware passed, only DB down)', write.status === 503,
      `got ${write.status}: ${JSON.stringify(write.json)}`)

    // ── 4. Legacy role:'staff' token (the old bug) is rejected by requireRole ──
    console.log('\n[test] 4) simulated legacy staff token must be rejected (403)')
    const staffToken = jwt.sign(
      { tgUserId: ADMIN_ID, username: 'selam_owner', firstName: 'Cafe', role: 'staff' },
      JWT_SECRET, { expiresIn: '30d' }
    )
    const staffWrite = await api('POST', '/api/menu/categories', {
      body: { name_en: 'Test Cat', section: 'food' },
      headers: { Authorization: `Bearer ${staffToken}` },
    })
    check('got 403 for staff role', staffWrite.status === 403, `got ${staffWrite.status}`)

    // ── 5. Valid-signed initData from a NON-admin → 403 ──
    console.log('\n[test] 5) non-admin user initData')
    const nonAdmin = await api('POST', '/api/admin-miniapp/auth', {
      body: { initData: makeInitData({ id: NON_ADMIN_ID, first_name: 'Random', username: 'customer1' }) },
    })
    check('status 403', nonAdmin.status === 403, `got ${nonAdmin.status}: ${JSON.stringify(nonAdmin.json)}`)
    check('no token leaked', nonAdmin.json?.token === undefined)

    // ── 6. Tampered initData → 401 ──
    console.log('\n[test] 6) tampered initData (forged user id)')
    const forged = makeInitData(adminUser).replace(String(ADMIN_ID), String(NON_ADMIN_ID)) // break signature
    const tampered = await api('POST', '/api/admin-miniapp/auth', { body: { initData: forged } })
    check('status 401', tampered.status === 401, `got ${tampered.status}: ${JSON.stringify(tampered.json)}`)
    const missing = await api('POST', '/api/admin-miniapp/auth', { body: {} })
    check('missing initData → 401', missing.status === 401, `got ${missing.status}`)

    // ── Summary ──
    console.log(`\n[test] RESULT: ${passed} passed, ${failed} failed`)
    if (failed > 0) process.exitCode = 1
  } finally {
    child.kill('SIGTERM')
    await sleep(300)
    if (!child.killed) child.kill('SIGKILL')
  }
}

main().catch((e) => {
  console.error('[test] fatal:', e)
  process.exit(1)
})
