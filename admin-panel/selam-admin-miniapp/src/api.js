// API client — implements EXACTLY the documented contract (RULES #1, #2, #4).
// Relative paths only, Bearer token on every call, 401 → re-auth once → "session expired",
// 403 → access denied, 503 → toast (never crash). Backend routes go live at integration
// time; until then the sandbox preview harness serves contract-identical stubs.

const TOKEN_KEY = 'selam_admin_token'

let memToken = null
let currentInitData = ''
let toastFn = null

export function bindToast(fn) {
  toastFn = fn
}

function toast(msg) {
  try {
    if (toastFn) toastFn(msg)
  } catch {
    /* noop */
  }
}

export function getToken() {
  return memToken
}

export function setToken(t) {
  memToken = t || null
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — memory only, per rules "in memory" is the requirement */
  }
}

export function setInitData(d) {
  currentInitData = d || ''
}

export class AccessDenied extends Error {
  constructor() {
    super('access denied')
  }
}
export class SessionExpired extends Error {
  constructor() {
    super('session expired')
  }
}

async function raw(path, { method = 'GET', body, auth = true, quiet = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && memToken) headers['Authorization'] = `Bearer ${memToken}`

  let res
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    toast('Network error — check your connection')
    throw { kind: 'network' }
  }

  if (res.status === 401) throw { kind: 'unauthorized' }
  if (res.status === 403) throw { kind: 'forbidden' }
  if (res.status === 503) {
    let j = null
    try {
      j = await res.json()
    } catch {
      /* no body */
    }
    toast((j && j.error) || 'Service temporarily unavailable — try again')
    throw { kind: 'server' }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    let data = null
    try {
      const j = await res.json()
      data = j
      if (j && j.error) msg = j.error
    } catch {
      /* no body */
    }
    // `quiet` lets a caller own the error UX (e.g. the category 409 → force flow);
    // 503 ALWAYS toasts (RULES: never crash silently on service down).
    if (!quiet) toast(msg)
    throw { kind: 'http', status: res.status, message: msg, data }
  }
  return res.json()
}

// POST { initData } → { token, user } — RULES #1, nothing else.
export async function authenticate(idt) {
  const data = await raw('/api/admin-miniapp/auth', { method: 'POST', body: { initData: idt }, auth: false })
  setToken(data.token)
  setInitData(idt)
  return data.user
}

async function call(path, opts = {}) {
  try {
    return await raw(path, opts)
  } catch (err) {
    if (err && err.kind === 'unauthorized') {
      // 401 → re-auth with initData and retry ONCE; if it fails again → session expired
      try {
        await authenticate(currentInitData)
        return await raw(path, opts)
      } catch {
        setToken(null)
        throw new SessionExpired()
      }
    }
    if (err && err.kind === 'forbidden') throw new AccessDenied()
    throw err
  }
}

function qs(params) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // ---- ORDERS ----
  // Page 1 v3: PATCH /api/orders/:id also accepts { started_by: "Name" } — the
  // staff/cooker display name stamped when someone taps "start". The order list
  // returns it back so EVERY admin device renders the same top-left name badge
  // (the team knows who is taking which order without talking).
  // ⚠️ INTEGRATION POINT: the real backend should stamp the authenticated admin's
  // identity server-side (Bearer token) and persist it on the order row; the
  // client-sent name is advisory. Add e.g. `started_by` (+ timestamp) to the
  // orders table and include it in the GET /api/orders response.
  // Page 1 v5 TWO-STEP completion:
  //   "Finished ✅" → PATCH { status: 'served' }  (customer notified by the bot;
  //                  the card STAYS in the queue in a green done state)
  //   "Done"        → PATCH { dismissed: true }   (card leaves the queue)
  // ⚠️ INTEGRATION POINT: persist `dismissed_at` (+ recommended `served_at`) on
  // the order row and KEEP returning served-until-dismissed orders in
  // GET /api/orders (the queue filters them client-side; done cards only stay
  // in the queue for the current day). Dismissed orders must still be returned
  // to the order-history screen (or add a dedicated history endpoint).
  getOrders: ({ status, limit = 50 } = {}) => call(`/api/orders${qs({ status, limit })}`),
  getOrderStats: () => call('/api/orders/stats/today'),
  getOrder: (id) => call(`/api/orders/${id}`),
  patchOrder: (id, body) => call(`/api/orders/${id}`, { method: 'PATCH', body }),

  // ---- MENU ITEMS (POST requires client-generated unique slug id) ----
  getMenu: ({ category, available } = {}) => call(`/api/menu${qs({ category, available })}`),
  postMenu: (body) => call('/api/menu', { method: 'POST', body }),
  patchMenu: (id, body) => call(`/api/menu/${id}`, { method: 'PATCH', body }),
  deleteMenu: (id) => call(`/api/menu/${id}`, { method: 'DELETE' }),

  // ---- CATEGORIES (sections: 'food' | 'drink') ----
  getCategories: () => call('/api/menu/categories'),
  postCategory: (body) => call('/api/menu/categories', { method: 'POST', body }),
  patchCategory: (id, body) => call(`/api/menu/categories/${id}`, { method: 'PATCH', body }),
  reorderCategories: (ids) => call('/api/menu/categories/reorder', { method: 'POST', body: { ids } }),
  deleteCategory: (id, force = false) =>
    call(`/api/menu/categories/${id}${force ? '?force=true' : ''}`, { method: 'DELETE', quiet: !force }),

  // ---- BLOCKED USERS ----
  getBlockedUsers: () => call('/api/blocked-users'),
  blockUser: (body) => call('/api/blocked-users', { method: 'POST', body }),
  unblockUser: (tgUserId) => call(`/api/blocked-users/${tgUserId}`, { method: 'DELETE' }),
  getDirectory: (q) => call(`/api/blocked-users/customers/directory${qs({ q })}`),

  // ---- STAFF ADMINS (Page 6) — ⚠️ INTEGRATION POINT ----
  // The RULES contract has NO staff-admin endpoints yet (ADMIN_TELEGRAM_IDS is a
  // server env var). Interface below is what the Admins screen needs; the sandbox
  // harness serves contract-shaped stubs so the UI is fully clickable. When the
  // main AI ships real endpoints, only these paths/payloads change.
  // Metrics arrive per-admin as stats: { day, week, month } (server-computed).
  getAdmins: () => call('/api/admin-miniapp/admins'),
  adminVerify: (id) => call(`/api/admin-miniapp/admins/verify${qs({ id })}`),
  postAdmin: (body) => call('/api/admin-miniapp/admins', { method: 'POST', body }),
  patchAdmin: (tgUserId, body) => call(`/api/admin-miniapp/admins/${tgUserId}`, { method: 'PATCH', body }),
  deleteAdmin: (tgUserId) => call(`/api/admin-miniapp/admins/${tgUserId}`, { method: 'DELETE' }),

  // ---- STORE SETTINGS (Page 7 admin panel) — ⚠️ INTEGRATION POINT ----
  // The RULES contract has NO store-settings endpoints yet. Shape (suggested):
  // { order_limit, pickup_throttle_min, delivery_available, paused,
  //   pause_until, close_until, closure_reason }
  // The server must own: real intake blocking, closure_reason broadcast to the
  // customer app, and auto-resume when pause_until/close_until expire.
  getSettings: () => call('/api/admin-miniapp/settings'),
  patchSettings: (body) => call('/api/admin-miniapp/settings', { method: 'PATCH', body }),

  // ---- REVENUE ANALYTICS (Page 8) — ⚠️ INTEGRATION POINT ----
  // The RULES contract only documents GET /api/orders/stats/today — no week/month
  // periods, no revenue total, no completed-delivery count. Suggested endpoint:
  //   GET /api/admin-miniapp/revenue?period=day|week|month
  //     → { orders: int, revenue: int (ETB), delivered: int }
  // Server computes from orders: count, SUM(total) over completed/paid (integer
  // Birr), completed-delivery count. Harness serves contract-shaped stubs.
  getRevenueStats: (period) => call(`/api/admin-miniapp/revenue${qs({ period })}`),

  // ---- CAFE PROFILE (Page 9) — ⚠️ INTEGRATION POINT ----
  // The RULES contract has NO profile endpoints yet. Suggested shape:
  //   { cafe_name, phone, location, logo_url, hours_open, hours_close, description }
  // cafe_name drives the header brand block everywhere. hours = "HH:MM" (24h).
  // Logo: interim = client-downscaled data URL inside logo_url; a real upload
  // endpoint (POST /api/admin-miniapp/profile/logo → { url }) is pending.
  // CAFE-IDENTITY CONTROLLER: the profile record is the single source of truth
  // for the cafe identity across the WHOLE project. When cafe_name changes the
  // server must broadcast `profile:update` (admin devices) + `brand:update`
  // (customer miniapp) and the bot must read the name at runtime — so greeting
  // / order / receipt messages everywhere reflect the new name instantly.
  // Other surfaces fetch GET /api/brand (public) → { name, logo_url, updated_at }.
  getProfile: () => call('/api/admin-miniapp/profile'),
  patchProfile: (body) => call('/api/admin-miniapp/profile', { method: 'PATCH', body }),

  // ---- REPORTS: PAUSE HISTORY (Page 7 bottom-nav REPORTS) ----------
  // GET /api/admin-miniapp/pause-history → { history: [...] } newest first.
  getPauseHistory: () => call('/api/admin-miniapp/pause-history'),

  // ---- USER REPORTS (Section 7) — backend-enforced review workflow ----
  // GET  /api/admin-miniapp/reports/lookup?q=<tg id|@username>
  //        → { user: { tg_user_id, tg_username, tg_first_name, is_blocked,
  //                    stats: { total, cancelled, active, served_total },
  //                    recent_orders: [...] } }  (no payment details)
  // GET  /api/admin-miniapp/reports  → { reports: [...] }
  // POST /api/admin-miniapp/reports { tg_user_id, category, description?, evidence? }
  // PATCH /api/admin-miniapp/reports/:id { status?, decision_note? }
  //        (409 duplicate → surfaced to the caller via the `quiet` flag)
  lookupReportUser: (q) => call(`/api/admin-miniapp/reports/lookup${qs({ q })}`),
  getReports: () => call('/api/admin-miniapp/reports'),
  getReportsQuiet: () => call('/api/admin-miniapp/reports', { quiet: true }),
  postReport: (body) => call('/api/admin-miniapp/reports', { method: 'POST', body, quiet: false }),
  patchReport: (id, body) => call(`/api/admin-miniapp/reports/${id}`, { method: 'PATCH', body }),

  // ---- ANNOUNCEMENTS (Page 7 bottom-nav "+") — ⚠️ INTEGRATION POINT ----
  // GET  /api/admin-miniapp/announcements → { announcements: [{ id, message,
  //   created_at, author? }] } newest first.
  // POST /api/admin-miniapp/announcements { message (required, ≤300 chars) }
  //   → { announcement: { id, message, created_at, author? } }
  // The server must fan each announcement out to the customer app / bot channel.
  getAnnouncements: () => call('/api/admin-miniapp/announcements'),
  postAnnouncement: (body) => call('/api/admin-miniapp/announcements', { method: 'POST', body }),
}

// Generate a unique slug id for POST /api/menu (e.g. "doro_wat_1")
export function slugify(name, existingIds = []) {
  const base =
    String(name || 'item')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'item'
  let id = base
  let n = 1
  while (existingIds.includes(id)) {
    n += 1
    id = `${base}_${n}`
  }
  return id
}
