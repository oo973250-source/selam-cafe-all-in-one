// SANDBOX PREVIEW HARNESS — NOT part of the deliverable.
// Contract-identical in-memory stubs of the Selam Cafe backend so every admin
// screen is clickable before integration. Lives only in this sandbox.
type Item = { id: string; name: string; price: number; qty: number; note?: string }
type OrderEvent = { id: number; event: string; payload: unknown; created_at: string }

type Order = {
  id: number
  tg_user_id: number
  tg_username: string | null
  tg_first_name: string
  service_type: 'dine_in' | 'takeaway' | 'delivery'
  customer_name: string
  customer_loc: { lat?: number; lng?: number; address?: string; phone?: string } | null
  items: Item[]
  total: number
  trust_level: number
  status: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
  payment_status: 'pending' | 'paid' | 'failed' | 'cod'
  tx_ref: string | null
  note?: string
  customer_phone?: string
  started_by?: string | null // Page 1 v3: staff/cooker display name stamped on "start"
  served_at?: string | null // Page 1 v5: stamped when the order is marked served (done state)
  dismissed_at?: string | null // Page 1 v5: set when an admin taps "Done" — order left the live queue
  created_at: string
  updated_at: string
}

type Category = {
  id: string
  name_en: string
  name_am?: string
  icon?: string
  section: 'food' | 'drink'
  hidden: boolean
  sort_order: number
  no_delivery?: boolean
}

type MenuItem = {
  id: string
  category: string
  name_en: string
  name_am?: string
  price: number
  description?: string
  image_url?: string
  available: boolean
  sort_order: number
}

type StaffAdmin = {
  tg_user_id: number
  username: string | null
  name: string
  photo_url?: string
  role: 'cashier' | 'kitchen' | 'delivery'
  permissions: string[]
  shift: 'morning' | 'afternoon' | 'night'
  branch: string
  active: boolean
  refund_limit: number
  done: string[] // ISO timestamps of completed orders (metrics source)
}

type StoreSettings = {
  order_limit: number // 0 = no cap
  pickup_throttle_min: number // 0 = none
  delivery_available: boolean
  paused: boolean // emergency kill-switch (indefinite)
  pause_until: string | null // ISO — duration pause w/ countdown
  close_until: string | null // ISO — multi-day closure
  closure_reason: string
}

// Reports page — pause/closure log entries (newest first in the UI).
type PauseEvent = {
  id: number
  kind: 'emergency' | 'countdown' | 'closed'
  reason: string
  started_at: string
  ended_at: string | null // null = still ongoing
}

// Announcements page — broadcast messages sent to customers.
type Announcement = {
  id: number
  message: string
  author: string
  created_at: string
}

type CafeProfile = {
  cafe_name: string // drives the header brand block app-wide
  phone: string
  location: string
  logo_url: string // data URL (client-downscaled) until a real upload endpoint exists
  hours_open: string // "HH:MM" 24h
  hours_close: string // "HH:MM" 24h
  description: string // ≤ 200 chars
  updated_at?: string | null // identity-version stamp (cafe-identity controller)
}

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString()
}

// Yesterday at a fixed local wall-clock time (for the order-history demo rows).
function yesterdayAt(h: number, m: number) {
  const d = new Date(Date.now() - 24 * 3_600_000)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// Completed-order timestamps for the Admins page metrics (day/week/month).
// day = within today, week = extra within last 7 days, month = extra within last 30.
function genDone(day: number, week: number, month: number): string[] {
  const out: string[] = []
  const now = Date.now()
  const rnd = (n: number) => Math.floor(Math.random() * n)
  for (let i = 0; i < day; i++) out.push(new Date(now - rnd(10 * 3_600_000)).toISOString())
  for (let i = day; i < week; i++) out.push(new Date(now - (24 * 3_600_000 + rnd(6 * 24 * 3_600_000))).toISOString())
  for (let i = week; i < month; i++) out.push(new Date(now - (7 * 24 * 3_600_000 + rnd(23 * 24 * 3_600_000))).toISOString())
  return out
}

function createDemo() {
  const categories: Category[] = [
    { id: 'breakfast', name_en: 'Breakfast', icon: '🍳', section: 'food', hidden: false, sort_order: 0 },
    { id: 'snacks', name_en: 'Snacks', icon: '🥟', section: 'food', hidden: false, sort_order: 1 },
    { id: 'fast_food', name_en: 'Fast Food', icon: '🍔', section: 'food', hidden: false, sort_order: 2 },
    { id: 'hot_drinks', name_en: 'Hot Drinks', icon: '☕', section: 'drink', hidden: false, sort_order: 0 },
    { id: 'drinks', name_en: 'Drinks', icon: '🥤', section: 'drink', hidden: false, sort_order: 1 },
  ]

  const menu: MenuItem[] = [
    { id: 'doro_wat_1', category: 'breakfast', name_en: 'Doro Wat', price: 450, available: true, sort_order: 0, description: 'Spicy chicken stew with injera' },
    { id: 'shiro_1', category: 'breakfast', name_en: 'Shiro Fitfit', price: 220, available: true, sort_order: 1 },
    { id: 'beyaynetu_1', category: 'breakfast', name_en: 'Beyaynetu', price: 300, available: true, sort_order: 2 },
    { id: 'firfir_1', category: 'breakfast', name_en: 'Firfir', price: 240, available: true, sort_order: 3 },
    { id: 'chechebsa_1', category: 'breakfast', name_en: 'Chechebsa', price: 260, available: true, sort_order: 4 },
    { id: 'fuul_1', category: 'breakfast', name_en: 'Fuul', price: 200, available: true, sort_order: 5 },
    { id: 'injera_1', category: 'breakfast', name_en: 'Injera (3 pcs)', price: 90, available: true, sort_order: 6 },
    { id: 'special_brek_1', category: 'breakfast', name_en: 'Special Breakfast Combo', price: 550, available: true, sort_order: 7 },
    { id: 'sambusa_1', category: 'snacks', name_en: 'Sambusa (3 pcs)', price: 150, available: true, sort_order: 0 },
    { id: 'tibs_1', category: 'fast_food', name_en: 'Special Tibs', price: 520, available: true, sort_order: 0 },
    { id: 'macchiato_1', category: 'hot_drinks', name_en: 'Macchiato', price: 80, available: true, sort_order: 0 },
    { id: 'buna_1', category: 'hot_drinks', name_en: 'Buna (Coffee)', price: 60, available: true, sort_order: 1 },
    { id: 'coke_1', category: 'drinks', name_en: 'Coca Cola', price: 50, available: true, sort_order: 0 },
    { id: 'sprk_1', category: 'drinks', name_en: 'Sprite', price: 50, available: true, sort_order: 1 },
  ]

  const orders: Order[] = [
    {
      id: 347, tg_user_id: 9012, tg_username: 'hana_t', tg_first_name: 'Hana', service_type: 'delivery',
      customer_name: 'Hana T.', customer_loc: { lat: 9.0192, lng: 38.7525, address: 'Bole, near Alem Cinema', phone: '0911234567' },
      items: [
        { id: 'doro_wat_1', name: 'Doro Wat', price: 450, qty: 2 },
        { id: 'shiro_1', name: 'Shiro Fitfit', price: 220, qty: 1 },
      ],
      total: 1120, trust_level: 3, status: 'new', payment_status: 'paid', tx_ref: 'chapa_9f2k1',
      note: 'Extra berbere on the side', customer_phone: '0911234567',
      created_at: minutesAgo(6), updated_at: minutesAgo(6),
    },
    {
      id: 346, tg_user_id: 8321, tg_username: null, tg_first_name: 'Dawit', service_type: 'delivery',
      customer_name: 'Dawit K.', customer_loc: { address: 'Gerji Mebrat Hail, Blue House Apt 4A' },
      items: [{ id: 'beyaynetu_1', name: 'Beyaynetu', price: 300, qty: 1 }],
      total: 300, trust_level: 2, status: 'new', payment_status: 'cod', tx_ref: null,
      created_at: minutesAgo(14), updated_at: minutesAgo(14),
    },
    {
      id: 345, tg_user_id: 7710, tg_username: 'sara_m', tg_first_name: 'Sara', service_type: 'dine_in',
      customer_name: 'Sara M.', customer_loc: null,
      items: [
        { id: 'macchiato_1', name: 'Macchiato', price: 80, qty: 2 },
        { id: 'sambusa_1', name: 'Sambusa (3 pcs)', price: 150, qty: 1 },
      ],
      total: 310, trust_level: 3, status: 'preparing', payment_status: 'paid', tx_ref: 'chapa_bb120',
      note: '-', started_by: 'Fozi', // demo: already cooking — shows the top-left staff badge
      created_at: minutesAgo(22), updated_at: minutesAgo(9),
    },
    {
      id: 344, tg_user_id: 6500, tg_username: null, tg_first_name: 'Yonatan', service_type: 'takeaway',
      customer_name: 'Yonatan A.', customer_loc: null,
      items: [{ id: 'tibs_1', name: 'Special Tibs', price: 520, qty: 1 }],
      total: 520, trust_level: 1, status: 'new', payment_status: 'pending', tx_ref: null,
      created_at: minutesAgo(27), updated_at: minutesAgo(27),
    },
    {
      id: 343, tg_user_id: 5541, tg_username: 'meron_g', tg_first_name: 'Meron', service_type: 'dine_in',
      customer_name: 'Meron G.', customer_loc: null,
      items: [{ id: 'buna_1', name: 'Buna (Coffee)', price: 60, qty: 2 }],
      total: 120, trust_level: 2, status: 'served', payment_status: 'paid', tx_ref: 'chapa_ze771',
      served_at: minutesAgo(30), // today → demo: shows the green done state in the live queue
      created_at: minutesAgo(55), updated_at: minutesAgo(30),
    },
    // YESTERDAY — history-page demo rows (served + cancelled mix).
    {
      id: 342, tg_user_id: 4430, tg_username: 'hana_t', tg_first_name: 'Hana', service_type: 'delivery',
      customer_name: 'Hana T.', customer_loc: { lat: 9.0054, lng: 38.7636, address: 'Kazanchis, near Sheraton' },
      items: [
        { id: 'special_brek_1', name: 'Special Breakfast Combo', price: 550, qty: 1 },
        { id: 'coke_1', name: 'Coca Cola', price: 50, qty: 2 },
      ],
      total: 650, trust_level: 3, status: 'served', payment_status: 'paid', tx_ref: 'chapa_k810s',
      note: 'Ring the doorbell twice', customer_phone: '0911223344',
      created_at: yesterdayAt(13, 10), updated_at: yesterdayAt(13, 55),
    },
    {
      id: 341, tg_user_id: 4321, tg_username: null, tg_first_name: 'Nahom', service_type: 'dine_in',
      customer_name: 'Nahom S.', customer_loc: null,
      items: [{ id: 'firfir_1', name: 'Firfir', price: 240, qty: 2 }],
      total: 480, trust_level: 1, status: 'cancelled', payment_status: 'pending', tx_ref: null,
      created_at: yesterdayAt(19, 45), updated_at: yesterdayAt(19, 52),
    },
    {
      id: 340, tg_user_id: 4210, tg_username: 'liya_g', tg_first_name: 'Liya', service_type: 'takeaway',
      customer_name: 'Liya G.', customer_loc: null,
      items: [{ id: 'macchiato_1', name: 'Macchiato', price: 80, qty: 3 }],
      total: 240, trust_level: 2, status: 'served', payment_status: 'paid', tx_ref: 'chapa_m472z',
      created_at: yesterdayAt(9, 30), updated_at: yesterdayAt(9, 42),
    },
  ]

  const blocked: Array<{ tg_user_id: number; username: string | null; reason: string; blocked_by: string; blocked_at: string }> = []

  const staff: StaffAdmin[] = [
    {
      tg_user_id: 556677, username: 'abebe_b', name: 'Abebe Bekele',
      role: 'cashier', permissions: ['orders', 'refunds'], shift: 'morning', branch: 'Main',
      active: true, refund_limit: 500, done: genDone(4, 22, 74),
    },
    {
      tg_user_id: 667788, username: 'tigist_a', name: 'Tigist Alemu',
      role: 'kitchen', permissions: ['orders'], shift: 'morning', branch: 'Main',
      active: true, refund_limit: 0, done: genDone(6, 19, 61),
    },
    {
      tg_user_id: 778899, username: 'kebede_w', name: 'Kebede Worku',
      role: 'delivery', permissions: ['orders'], shift: 'afternoon', branch: 'Main',
      active: true, refund_limit: 200, done: genDone(3, 12, 45),
    },
    {
      tg_user_id: 889900, username: 'mahlet_g', name: 'Mahlet Girma',
      role: 'cashier', permissions: ['orders', 'refunds'], shift: 'night', branch: 'Main',
      active: false, refund_limit: 300, done: genDone(0, 2, 9),
    },
  ]

  const events = new Map<number, OrderEvent[]>()
  let eventSeq = 1

  const settings: StoreSettings = {
    order_limit: 0,
    pickup_throttle_min: 0,
    delivery_available: true,
    paused: false,
    pause_until: null,
    close_until: null,
    closure_reason: '',
  }

  // Page 9 cafe profile — demo values mirror the mock (cafe name feeds brandName).
  const LOGO_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='14' fill='#2a2118'/><text x='32' y='42' font-size='30' text-anchor='middle'>☕</text></svg>`
  const profile: CafeProfile = {
    cafe_name: 'UniCafe',
    phone: '+251 91 234 5678',
    location: 'Addis Ababa, Bole',
    logo_url: `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`,
    hours_open: '08:00',
    hours_close: '22:00',
    description: 'Fresh food, great taste...',
  }

  // Reports page — seed pause/closure log (newest first in the UI).
  const pauseHistory: PauseEvent[] = [
    {
      id: 1,
      kind: 'countdown',
      reason: 'Kitchen maintenance — burner replaced',
      started_at: yesterdayAt(20, 0),
      ended_at: yesterdayAt(20, 35),
    },
    {
      id: 2,
      kind: 'closed',
      reason: 'Public holiday',
      started_at: yesterdayAt(6, 0),
      ended_at: yesterdayAt(7, 0),
    },
  ]
  let histSeq = 3

  // Announcements page — seed one past broadcast.
  const announcements: Announcement[] = [
    {
      id: 1,
      message: 'Free delivery on orders over 500 ETB this weekend! 🎉',
      author: 'Owner',
      created_at: minutesAgo(180),
    },
  ]
  let annSeq = 2

  return { categories, menu, orders, blocked, staff, events, eventSeq, settings, profile, pauseHistory, histSeq, announcements, annSeq }
}

const g = globalThis as unknown as { __selamDemo?: ReturnType<typeof createDemo> }
export const demo = (g.__selamDemo ||= createDemo())

// Demo "Telegram Bot API" lookup for the Add-admin verification flow.
// Resolves known staff by id/username; fabricates a deterministic profile otherwise.
const VERIFY_POOL = [
  { name: 'Selam Tesfaye', username: 'selam_t' },
  { name: 'Yonas Girma', username: 'yonas_g' },
  { name: 'Bethlehem Ayele', username: 'bethe_a' },
  { name: 'Solomon Mengistu', username: 'solo_m' },
  { name: 'Hiwot Bekele', username: 'hiwot_b' },
]

export function demoVerifyProfile(raw: string) {
  const s = raw.trim().replace(/^@/, '')
  const asNum = Number(s)
  const tg =
    Number.isFinite(asNum) && asNum > 0
      ? asNum
      : (Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 9_000_000) + 1_000_000
  const known = demo.staff.find(
    (a) => String(a.tg_user_id) === s || (a.username && a.username.toLowerCase() === s.toLowerCase()),
  )
  if (known) {
    return { tg_user_id: known.tg_user_id, username: known.username, name: known.name, photo_url: known.photo_url }
  }
  const pick = VERIFY_POOL[Math.abs(tg) % VERIFY_POOL.length]
  return { tg_user_id: tg, username: pick.username, name: pick.name, photo_url: undefined }
}

// Admin metrics from completed-order timestamps: day = since local midnight,
// week = last 7 days, month = last 30 days.
export function adminStats(done: string[]) {
  const now = Date.now()
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const inRange = (from: number) => done.filter((t) => new Date(t).getTime() >= from).length
  return { day: inRange(midnight.getTime()), week: inRange(now - 7 * 24 * 3_600_000), month: inRange(now - 30 * 24 * 3_600_000) }
}

export function staffView(a: StaffAdmin) {
  const { done, ...rest } = a
  return { ...rest, stats: adminStats(done) }
}

export function json(data: unknown, status = 200) {
  return Response.json(data as Record<string, unknown>, { status })
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}
