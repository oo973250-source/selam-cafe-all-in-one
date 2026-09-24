// server/bot.js
//
// Telegram bot with full i18n (en/am/om), admin management, order notifications.
// Exports startBot() so the main server can launch it, plus sendOrderConfirmation()
// and notifyStaff() so the HTTP order path (POST /api/miniapp/orders) reuses the
// same messages.

import TelegramBot from 'node-telegram-bot-api'
import 'dotenv/config'

import {
  ensureSchema,
  createOrder,
  updateOrderStatus,
  countTodaysOrdersForUser,
  getUserLang as dbGetUserLang,
  setUserLang as dbSetUserLang,
  pool,
} from './db.js'

// ── Config ─────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN
// Trailing slash would produce `//admin` links, which the server's miniapp
// fallback does not recognise as the admin UI — strip it defensively.
const WEBAPP_URL = (process.env.WEBAPP_URL || '').replace(/\/+$/, '')
const NOTIFY_CHAT_IDS = (process.env.NOTIFY_CHAT_IDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
const OWNER_ID = process.env.OWNER_TELEGRAM_ID
  ? Number(process.env.OWNER_TELEGRAM_ID) : null
// ADMIN_TELEGRAM_IDS is the canonical admin allowlist (also used by the admin
// web login in routes/auth.js). Previously the bot only checked
// NOTIFY_CHAT_IDS / OWNER_TELEGRAM_ID, so staff who set ADMIN_TELEGRAM_IDS on
// Railway were never recognized as admins and never got staff alerts.
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map((s) => Number(s.trim())).filter(Boolean)
// Everyone who should receive new-order staff alerts (deduped):
const STAFF_CHAT_IDS = [...new Set([
  ...ADMIN_TELEGRAM_IDS,
  ...NOTIFY_CHAT_IDS.map((s) => Number(s)).filter((n) => Number.isFinite(n)),
  ...(OWNER_ID ? [OWNER_ID] : []),
])]

// ── Bot instance (set by startBot) ────────────────────────────────────
// Lets the HTTP layer (POST /api/miniapp/orders) send messages through the
// same bot process. sendData/web_app_data is only delivered for Mini Apps
// opened from a keyboard button, so menu-button/link launches submit over
// HTTP and rely on these helpers for the confirmation message.
let activeBot = null
export function getBot() {
  return activeBot
}

// ── Admin web login codes ────────────────────────────────────────────
// /login in the bot issues a one-time 6-digit code; the admin web dashboard
// polls with it to finish sign-in. In-memory, single-use, 10-minute TTL.
const pendingLoginCodes = new Map() // code -> { tgUserId, expiresAt }
export function consumeLoginCode(code) {
  const pending = pendingLoginCodes.get(String(code))
  if (!pending || pending.expiresAt < Date.now()) {
    pendingLoginCodes.delete(String(code))
    return null
  }
  pendingLoginCodes.delete(String(code))
  return pending
}

const SERVICE_LABELS = {
  dine_in: 'Dine in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

// ── User language (DB-persisted) ─────────────────────────────────────────
// Choices survive bot restarts. Falls back to the Telegram client language
// for first-time users, then English.
const FALLBACK_CLIENT_LANGS = { am: 'am', om: 'om', or: 'om', en: 'en' }

function normalizeLang(code) {
  const base = (code || '').toLowerCase().split('-')[0]
  if (base === 'or') return 'om'
  if (base === 'am' || base === 'om') return base
  return 'en'
}

async function getUserLang(id) {
  try {
    return await dbGetUserLang(id)
  } catch (e) {
    console.warn('[bot] getUserLang failed, defaulting to en:', e.message)
    return 'en'
  }
}

async function rememberUserLang(id, code, tgUsername = null, tgFirstName = null) {
  const lang = normalizeLang(code)
  try {
    await dbSetUserLang(id, lang, tgUsername, tgFirstName)
  } catch (e) {
    console.warn('[bot] setUserLang failed:', e.message)
  }
  return lang
}

// ── Bot translations (consistent with miniapp i18n.js) ───────────────────
const T = {
  en: {
    welcome: 'Welcome to Selam Cafe',
    chooseLang: 'Please choose your language to continue:',
    welcomeBack: 'Welcome back',
    langSet: 'Language set to English',
    tapMenu: 'Tap below to open the menu',
    openMenu: '☕ Open Menu',
    orderAgain: '☕ Order again',
    menuNotConfigured: 'Menu URL is not configured yet.',
    adminPanel: 'Admin Panel',
    adminLink: 'Open Admin Panel (Web)',
    adminOrders: 'Recent Orders (Bot)',
    adminNoOrders: 'No orders yet.',
    adminNotConfigured: 'Admin panel URL not configured.',
    helpTitle: 'Selam Cafe Bot',
    helpStart: '/start — welcome',
    helpMenu: '/menu — open the menu',
    helpAdmin: '/admin — admin panel & orders',
    helpMyorders: '/myorders — your last 3 orders',
    helpStatus: '/status <id> — check order status',
    helpHelp: '/help — this message',
    helpLang: '/lang — change language',
    noOrders: "You haven't placed any orders yet.",
    orderReceived: 'Order received!',
    yourTicket: 'Your ticket is',
    wellNotify: "We'll message you when it's being prepared and again when it's ready.",
    ordersToday: "You've placed {n} today.",
    orderOne: 'order',
    orderMany: 'orders',
    receiptTitle: 'ORDER RECEIPT',
    yourItems: 'YOUR ITEMS',
    orderedItems: 'ORDERED ITEMS',
    orderCountLabel: 'Order Count',
    loginPrompt: 'To sign in to the admin web dashboard, send this code to me as a message (or tap the button):',
    loginInvalidCode: 'Invalid or expired code. Open the admin page again and try /login with a fresh code.',
    loginOk: '✅ Verified! Your admin dashboard is now signed in — you can close this chat and reload the page.',
    loginDenied: '⛔ Your Telegram account is not on the admin allowlist (ADMIN_TELEGRAM_IDS).',
    loginHint: 'Admin sign-in',
    yourLastOrders: 'Your last 3 orders:',
    statusPreparing: 'is being prepared. Hang tight!',
    statusReady: 'is ready!',
    statusReadyDelivery: 'Our rider is on the way.',
    statusReadyPickup: 'Please come pick it up.',
    statusCancelled: 'was cancelled. Please message us if you have questions.',
    orderNotFound: 'No order found with that ID for your account.',
    adminUnauthorized: 'You are not authorised to use admin commands.',
    newOrder: 'NEW ORDER',
    from: 'From',
    startPreparing: 'Start preparing',
    markReady: 'Mark ready',
    cancelOrder: 'Cancel',
    marked: 'Marked',
    notAuthorised: 'Not authorised',
    unknownAction: 'Unknown action',
    orderNotFoundAdmin: 'Order not found',
    changeLang: 'Change Language',
    items: 'Items',
    total: 'Total',
    status: 'Status',
    time: 'Time',
    customer: 'Customer',
    service: 'Service',
    location: 'Location',
    wordNew: 'New',
    wordPreparing: 'Preparing',
    wordReady: 'Ready',
    wordServed: 'Served',
    wordCancelled: 'Cancelled',
    serviceDineIn: 'Dine in',
    serviceTakeaway: 'Takeaway',
    serviceDelivery: 'Delivery',
  },
  am: {
    welcome: 'ሰላም ካፌ እንኳን ደህና መጡ',
    chooseLang: 'እባክዎ ቋንቋ ይምረጡ:',
    welcomeBack: 'እንኳን ደህና መጡ',
    langSet: 'ቋንቋ አማርኛ ተመርጧል',
    tapMenu: 'ምናሌውን ለመክፈት ከታች ይንኩ',
    openMenu: '☕ ምናሌ ክፈት',
    orderAgain: '☕ እንደገና አዘዝ',
    menuNotConfigured: 'የምናሌ አድራሻ አልተዋቀረም።',
    adminPanel: 'የአስተዳደር ክፍል',
    adminLink: 'የአስተዳደር ክፍል ክፈት (ድረ-ገጽ)',
    adminOrders: 'የቅርብ ትዕዛዞች (ቦት)',
    adminNoOrders: 'እስካሁን ትዕዛዝ የለም።',
    adminNotConfigured: 'የአስተዳደር ክፍል አድራሻ አልተዋቀረም።',
    helpTitle: 'ሰላም ካፌ ቦት',
    helpStart: '/start — እንኳን ደህና መጡ',
    helpMenu: '/menu — ምናሌ ክፈት',
    helpAdmin: '/admin — የአስተዳደር ክፍል እና ትዕዛዞች',
    helpMyorders: '/myorders — የመጨረሻ 3 ትዕዛዞችዎ',
    helpStatus: '/status <id> — የትዕዛዝ ሁኔታ ይመልከቱ',
    helpHelp: '/help — ይህ መልእክት',
    helpLang: '/lang — ቋንቋ ቀይር',
    noOrders: 'እስካሁን ትዕዛዝ አላዘዙም።',
    orderReceived: 'ትዕዛዝዎ ደርሷል!',
    yourTicket: 'ትኬትዎ',
    wellNotify: 'ስንዘጋጅ እና ስራቁ ሲዘጋጅ እናሳውቋለን።',
    ordersToday: 'ዛሬ {n} አዝዘዋል።',
    orderOne: 'ትዕዛዝ',
    orderMany: 'ትዕዛዞች',
    receiptTitle: 'የትዕዛዝ ደረሰኝ',
    yourItems: 'የእርስዎ እቃዎች',
    orderedItems: 'የታዘዙ እቃዎች',
    orderCountLabel: 'የትዕዛዝ ብዛት',
    loginPrompt: 'የአስተዳደር ዳሽቦርዱን ለመግባት ይህንን ኮድ እንደ መልእክት ይላኩልኝ (ወይም አዝራሩን ይንኩ):',
    loginInvalidCode: 'ልክ ያልሆነ ወይም ጊዜው ያለፈበት ኮድ። የአስተዳደር ገጹን እንደገና ክፈት።',
    loginOk: '✅ ተረጋግጧል! የአስተዳደር ዳሽቦርዱ አሁን ገብቷል።',
    loginDenied: '⛔ የቴሌግራም መለያዎ በአስተዳደር ፈቃድ ዝርዝር (ADMIN_TELEGRAM_IDS) ላይ አይገኝም።',
    loginHint: 'የአስተዳደር መግቢያ',
    yourLastOrders: 'የመጨረሻ 3 ትዕዛዞችዎ:',
    statusPreparing: 'እየተዘጋጀ ነው። ትንሽ ይጠብቁ!',
    statusReady: 'ዝግጁ ነው!',
    statusReadyDelivery: 'አጓጓዞቻችን በመንገድ ላይ ናቸው።',
    statusReadyPickup: 'እባክዎ በመጥ ይምጡ።',
    statusCancelled: 'ተሰርዟል። ጥያቄ ካለዎት እባክዎ ያግኙን።',
    orderNotFound: 'ለእርስዎ መለያ በዚያ ቁጥር ትዕዛዝ አልተገኘም።',
    adminUnauthorized: 'የአስተዳደር ትዕዛዞችን ለመጠቀም ፈቃድ የለዎትም።',
    newOrder: 'አዲስ ትዕዛዝ',
    from: 'ከ',
    startPreparing: 'ማዘጋጀት ጀምር',
    markReady: 'ዝግጁ አድርግ',
    cancelOrder: 'ሰርዝ',
    marked: 'ተመልክቷል',
    notAuthorised: 'ፈቃድ የለም',
    unknownAction: 'የማይታወቅ እርምጃ',
    orderNotFoundAdmin: 'ትዕዛዝ አልተገኘም',
    changeLang: 'ቋንቋ ቀይር',
    items: 'እቃዎች',
    total: 'ጠቅላላ',
    status: 'ሁኔታ',
    time: 'ጊዜ',
    customer: 'ደንበኛ',
    service: 'አገልግሎት',
    location: 'አድራሻ',
    wordNew: 'አዲስ',
    wordPreparing: 'በመዘጋጀት ላይ',
    wordReady: 'ዝግጁ',
    wordServed: 'ያቀረበ',
    wordCancelled: 'ተሰርዟል',
    serviceDineIn: 'በስፍራው መብላት',
    serviceTakeaway: 'ወስዶ መሄድ',
    serviceDelivery: 'አድርሻ',
  },
  om: {
    welcome: 'Baga nagaan dhuftaan Kafee Selam',
    chooseLang: 'Maaloo afaan filadhaa:',
    welcomeBack: 'Baga nagaan dhuftaan',
    langSet: 'Afaan Oromoo filatameera',
    tapMenu: 'Maajii banuuf dibbaabaa tuqi',
    openMenu: '☕ Maajii Banaa',
    orderAgain: '☕ Irra deebi\u2019i ajaja',
    menuNotConfigured: "Teessoo maajii hin qindaa'in.",
    adminPanel: 'Panel Bulchaa',
    adminLink: 'Panel Bulchaa Banaa (Saayidii)',
    adminOrders: 'Ajajawwan Dhiyoo (Bot)',
    adminNoOrders: 'Amma ajaja hin jiru.',
    adminNotConfigured: "Teessoo panel bulchaa hin qindaa'in.",
    helpTitle: 'Bot Kafee Selam',
    helpStart: '/start — baga nagaan dhuftaan',
    helpMenu: '/menu — maajii banaa',
    helpAdmin: '/admin — panel bulchaa fi ajajawwan',
    helpMyorders: '/myorders — ajaja 3 dhiyoo kee',
    helpStatus: '/status <id> — haala ajajaa ilaali',
    helpHelp: '/help — ergaa kana',
    helpLang: '/lang — afaan jijjiiri',
    noOrders: 'Amma ajaja hin ajajne.',
    orderReceived: 'Ajajni kee dhufeeera!',
    yourTicket: 'Tikkeetii kee',
    wellNotify: 'Yeroo qopheessinu fi yeroo qopheessame isin beeksiifna.',
    ordersToday: "Har'a {n} ajajattaniitti.",
    orderOne: 'ajaja',
    orderMany: 'ajajawwan',
    yourLastOrders: 'Ajaja 3 dhiyoo kee:',
    statusPreparing: 'Qopheeffamaa jirti. Xiqqoo eegi!',
    statusReady: 'Qopheeffameera!',
    statusReadyDelivery: 'Guuraa keenya karaa irra jira.',
    statusReadyPickup: 'Maaloo fuudhuun koottaa.',
    statusCancelled: 'Haqameera. Gaaffii yoo jiraatte maaloo nu qunnamsiisaa.',
    orderNotFound: 'Galmee keetti ajaja lakkoofsa sanaan hin argamne.',
    adminUnauthorized: 'Ajjaja bulchaa itti fayyadamuuf hayyama hin qabdu.',
    newOrder: 'AJAJA HAARAA',
    from: 'Garga',
    startPreparing: 'Qopheessuu Jalqabi',
    receiptTitle: 'RASIISAA AJAJAA',
    yourItems: 'WAANOTA KEE',
    orderedItems: 'WAANOTA AJAJAMAN',
    orderCountLabel: 'Lakkoochsaa Ajajaa',
    loginPrompt: "Dashboard bulchaa seenuuf koodii kana akka ergaa naa ergi (ykn dilbata tuqi):",
    loginInvalidCode: "Koodii dogoggore ykn yeroon isaa darbe. Fuula bulchaa irra deebi'i bani.",
    loginOk: "✅ Meeqeffameera! Dashboard bulchaa amma seeneera.",
    loginDenied: "⛔ Herrega Telegram kee tarreessuu bulchaa (ADMIN_TELEGRAM_IDS) irratti hin jiru.",
    loginHint: 'Seensa Bulchaa',
    markReady: 'Qopheeffame godhi',
    cancelOrder: 'Haqi',
    marked: 'Mallatteeffame',
    notAuthorised: 'Hayyama hin qabu',
    unknownAction: 'Gocha beekamaa miti',
    orderNotFoundAdmin: 'Ajaja hin argamne',
    changeLang: 'Afaan Jijjiiri',
    items: 'Meeshaalee',
    total: 'Waliigala',
    status: 'Haala',
    time: 'Yeroo',
    customer: 'Maamila',
    wordNew: 'Haaraa',
    wordPreparing: 'Qopheeffamaa jira',
    wordReady: 'Qopheeffameera',
    wordServed: 'Kennameera',
    wordCancelled: 'Haqameera',
    serviceDineIn: 'Achumaa nyaachuu',
    serviceTakeaway: 'Fudhaa jedhi',
    serviceDelivery: 'Geeddara',
    service: 'Tajaajila',
    location: 'Iddoo',
  },
}

function t(key, lang) {
  return (T[lang] && T[lang][key]) || T.en[key] || key
}

// ── Helper functions ──────────────────────────────────────────────────────
function miniAppButton(label, lang) {
  const base = WEBAPP_URL || ''
  if (!base) return {}
  // Pass the chosen language to the Mini App so its UI matches the bot's.
  const url = lang ? `${base}?lang=${lang}` : base
  return {
    reply_markup: {
      inline_keyboard: [[{ text: label, web_app: { url } }]],
    },
  }
}

// Language buttons in TWO rows: English + Amharic on top, Afaan Oromoo below
// (its long label would otherwise squeeze all three onto one cramped line).
function languageButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' },
        ],
        [{ text: '🇪🇹 Afaan Oromoo', callback_data: 'lang_om' }],
      ],
    },
  }
}

function adminMenuButtons(lang = 'en') {
  const btns = [
    [{ text: '📋 ' + t('adminOrders', lang), callback_data: 'admin_list' }],
  ]
  if (WEBAPP_URL) {
    const adminUrl = WEBAPP_URL + '/admin'
    btns.push([{ text: '📊 ' + t('adminLink', lang), url: adminUrl }])
  }
  return {
    reply_markup: { inline_keyboard: btns },
  }
}

function formatOrderReceipt(order) {
  const itemLines = (order.items || [])
    .map((i) => `  - ${i.quantity}x ${i.nameEn || i.nameAm || i.id} — ${i.price * i.quantity} Br`)
    .join('\n')
  const loc = order.customer_loc
  const locStr = loc?.address
    ? `\n  ${loc.address}` + (loc.lat ? ` (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})` : '')
    : ''
  return (
    `*Order #${order.id}*\n` +
    `${order.customer_name}\n` +
    `${SERVICE_LABELS[order.service_type] || order.service_type}\n` +
    `\n${itemLines}\n` +
    `*Total:* ${order.total} Br` +
    locStr +
    `\n_Status: ${order.status}_`
  )
}

// Status shown as emoji + localized word on receipts and staff alerts.
const STATUS_BADGES = {
  new: '🆕',
  preparing: '⏳',
  ready: '✅',
  served: '🍽️',
  cancelled: '❌',
}

function statusWord(status, lang) {
  const map = {
    new: 'wordNew',
    preparing: 'wordPreparing',
    ready: 'wordReady',
    served: 'wordServed',
    cancelled: 'wordCancelled',
  }
  return map[status] ? t(map[status], lang) : status
}

function serviceTypeLabel(serviceType, lang) {
  const map = {
    dine_in: 'serviceDineIn',
    takeaway: 'serviceTakeaway',
    delivery: 'serviceDelivery',
  }
  return map[serviceType] ? t(map[serviceType], lang) : (SERVICE_LABELS[serviceType] || serviceType)
}

/**
 * Receipt-style order message, shared by the customer confirmation and the
 * staff alert (per user request: boxed layout listing every ordered item).
 * Sent as plain text (no Markdown) so the dividers render exactly as drawn.
 */
function buildOrderMessage(kind, order, lang, extras = {}) {
  const sep = '============================'
  const itemLines = (order.items || []).length
    ? (order.items || [])
        .map((i) => {
          const name = i.nameEn || i.nameAm || i.id || '?'
          return `• ${i.quantity}x ${name} — ${i.price * i.quantity} ETB`
        })
        .join('\n')
    : '• —'

  const lines = []
  if (kind === 'alert') {
    lines.push(`🔔 ${sep} 🔔`)
    lines.push(`${t('newOrderAlert', lang)} (#${order.id})`)
    lines.push(sep)
    const who = extras.username
      ? `@${extras.username}`
      : (extras.firstName || '—')
    lines.push(`👤 ${t('customer', lang)}: ${who}`)
    lines.push(`🚚 ${t('service', lang)}: ${serviceTypeLabel(order.service_type, lang)}`)
    lines.push('')
    lines.push(`🛍️ ${t('orderedItems', lang)}:`)
  } else {
    lines.push(`🧾 ${sep} 🧾`)
    lines.push(t('receiptTitle', lang))
    lines.push(sep)
    lines.push(`🎫 ${t('yourTicket', lang)}: #${order.id}`)
    if (extras.todaysCount != null) {
      lines.push(`📅 ${t('orderCountLabel', lang)}: ${extras.todaysCount}`)
    }
    lines.push('')
    lines.push(`🛍️ ${t('yourItems', lang)}:`)
  }
  lines.push(itemLines)
  lines.push('')
  lines.push('----------------------------')
  lines.push(`💰 ${t('total', lang)}: ${order.total} ETB`)
  lines.push(`${kind === 'alert' ? '📊' : '⏳'} ${t('status', lang)}: ${STATUS_BADGES[order.status] || ''} ${statusWord(order.status, lang)}`.trimEnd())
  lines.push(sep)
  return lines.join('\n')
}

function isAdmin(userId) {
  if (OWNER_ID && userId === OWNER_ID) return true
  if (ADMIN_TELEGRAM_IDS.includes(Number(userId))) return true
  return NOTIFY_CHAT_IDS.includes(String(userId))
}

// Validate order id to avoid passing out-of-range ints to Postgres
function isValidOrderId(n) {
  if (typeof n === 'string') n = Number(n)
  if (!Number.isFinite(n)) return false
  if (!Number.isSafeInteger(n)) return false
  if (n < 1) return false
  // orders.id is SERIAL (32-bit signed); guard against overflow
  const MAX_INT32 = 2147483647
  return n <= MAX_INT32
}

// ── Main bot function ────────────────────────────────────────────────────
export async function startBot(io) {
  if (!BOT_TOKEN) {
    console.warn('[bot] BOT_TOKEN not set — bot disabled')
    return null
  }
  if (!WEBAPP_URL) {
    console.warn('[bot] WEBAPP_URL not set — buttons will be missing')
  }

  await ensureSchema()
  const bot = new TelegramBot(BOT_TOKEN, { polling: true })
  activeBot = bot

  // Polling backoff state
  let pollingBackoffMs = 0
  const POLLING_BACKOFF_BASE = 5000
  const POLLING_BACKOFF_MAX = 60000
  let pollingBackoffTimer = null

  // ── /start ─────────────────────────────────────────────────────────────
  bot.onText(/\/start(\s+(.+))?$/, async (msg, match) => {
    const name = msg.from.first_name || ''
    const clientLang = FALLBACK_CLIENT_LANGS[(msg.from.language_code || '').toLowerCase().split('-')[0]] || 'en'
    const lang = await getUserLang(msg.from.id)
    const deepLink = match?.[2]
    const greeting = deepLink === 'reorder'
      ? `*${t('welcomeBack', lang)}, ${name}!*\n\n${t('chooseLang', lang)}`
      : `*${t('welcome', lang)}, ${name}!*\n\n${t('chooseLang', lang)}`
    bot.sendMessage(msg.chat.id, greeting, {
      parse_mode: 'Markdown',
      ...languageButtons(),
    }).catch(() => {})
    // Remember the Telegram client language for first-time users so their
    // first HTTP order already arrives in their language.
    if (lang === 'en' && clientLang !== 'en') {
      await rememberUserLang(msg.from.id, clientLang, msg.from.username, msg.from.first_name)
    }
  })

  // ── /menu — open the Mini App ──────────────────────────────────────
  bot.onText(/\/menu$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    if (!WEBAPP_URL) {
      bot.sendMessage(msg.chat.id, t('menuNotConfigured', lang))
      return
    }
    bot.sendMessage(msg.chat.id, t('tapMenu', lang), {
      parse_mode: 'Markdown',
      ...miniAppButton(t('openMenu', lang), lang),
    })
  })

  // ── /lang — change language ────────────────────────────────────────
  bot.onText(/\/lang$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    bot.sendMessage(msg.chat.id, t('chooseLang', lang), languageButtons())
  })

  // ── /ping — connectivity & identity diagnostic (what the bot sees) ──
  bot.onText(/\/ping$/, (msg) => {
    const isAdminUser = isAdmin(msg.from.id)
    bot.sendMessage(
      msg.chat.id,
      `✅ pong\n\n` +
        `your Telegram ID: ${msg.from.id}\n` +
        `bot sees you as admin: ${isAdminUser ? 'YES' : 'no'}\n\n` +
        `If this says "no" but you expected admin:\n` +
        `1. ADMIN_TELEGRAM_IDS on Railway must be exactly this number: ${msg.from.id}\n` +
        `2. Redeploy after changing variables.\n` +
        `3. DB must be connected (admins come from env + this bot's config).`,
      { parse_mode: 'Markdown' }
    ).catch(() => {})
  })

  // ── /login — issue a one-time code for the admin WEB dashboard ──────
  // The Telegram Login Widget requires the bot's domain to be allowlisted in
  // BotFather (/setdomain), which is easy to miss and often the reason the
  // admin page can't sign anyone in. This code flow needs no BotFather setup:
  //   /login in the bot → type the 6-digit code on the /admin page.
  bot.onText(/\/login$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    pendingLoginCodes.set(code, {
      tgUserId: msg.from.id,
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    // Opportunistic cleanup of expired codes
    for (const [c, v] of pendingLoginCodes) {
      if (v.expiresAt < Date.now()) pendingLoginCodes.delete(c)
    }
    bot.sendMessage(
      msg.chat.id,
      `${t('loginPrompt', lang)}\n\n${code}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: t('loginHint', lang), callback_data: `logincode_${code}` }]],
        },
      }
    )
  })

  // Typing the 6-digit code as a plain message also completes the handshake
  // (the inline button just re-shows the code as a popup for easy copying).
  bot.on('message', async (msg) => {
    const text = (msg.text || '').trim()
    if (!/^\d{6}$/.test(text)) return
    const lang = await getUserLang(msg.from.id)
    const pending = consumeLoginCode(text)
    if (!pending || pending.tgUserId !== msg.from.id) {
      bot.sendMessage(msg.chat.id, t('loginInvalidCode', lang))
      return
    }
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, t('loginDenied', lang))
      return
    }
    bot.sendMessage(msg.chat.id, t('loginOk', lang))
  })

  // ── /help — command list ─────────────────────────────────────────────
  bot.onText(/\/help$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    bot.sendMessage(msg.chat.id, [
      `*${t('helpTitle', lang)}*`,
      '',
      t('helpStart', lang),
      t('helpMenu', lang),
      t('helpAdmin', lang),
      t('helpMyorders', lang),
      t('helpStatus', lang),
      t('helpLang', lang),
      t('helpHelp', lang),
    ].join('\n'), { parse_mode: 'Markdown' })
  })

  // ── /myorders — customer's last 3 orders ─────────────────────────────
  bot.onText(/\/myorders$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    try {
      const { rows } = await pool.query(
        `SELECT id, service_type, total, status, created_at
           FROM orders WHERE tg_user_id::text = $1
          ORDER BY created_at DESC LIMIT 3`,
        [String(msg.from.id)]
      )
      if (!rows.length) {
        bot.sendMessage(msg.chat.id, t('noOrders', lang))
        return
      }
      const lines = rows.map((r) =>
        `#${r.id} · ${SERVICE_LABELS[r.service_type] || r.service_type} · ${r.total} Br · ${r.status} · ${new Date(r.created_at).toLocaleString()}`
      )
      bot.sendMessage(msg.chat.id, `${t('yourLastOrders', lang)}\n\n${lines.join('\n')}`)
    } catch (e) {
      console.error('[bot] /myorders failed:', e.message)
      bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
    }
  })

  // ── /status <id> — check a specific order ────────────────────────────
  bot.onText(/\/status\s+(\d+)$/, async (msg, match) => {
    const lang = await getUserLang(msg.from.id)
    const id = Number(match[1])
    if (!isValidOrderId(id)) {
      bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
      return
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, service_type, total, status, created_at
           FROM orders WHERE id = $1 AND tg_user_id::text = $2`,
        [id, String(msg.from.id)]
      )
      if (!rows.length) {
        bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
        return
      }
      const r = rows[0]
      const readyText = r.service_type === 'delivery' ? t('statusReadyDelivery', lang) : t('statusReadyPickup', lang)
      const statusLine = r.status === 'preparing' ? t('statusPreparing', lang)
        : r.status === 'ready' ? `${t('statusReady', lang)} ${readyText}`
        : r.status === 'cancelled' ? t('statusCancelled', lang)
        : `Status: ${r.status}`
      bot.sendMessage(msg.chat.id, `Order #${r.id} ${statusLine}`)
    } catch (e) {
      console.error('[bot] /status failed:', e.message)
      bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
    }
  })

  // ── /admin — admin panel + recent orders (admins only) ───────────────
  bot.onText(/\/admin$/, async (msg) => {
    const lang = await getUserLang(msg.from.id)
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, t('adminUnauthorized', lang))
      return
    }
    bot.sendMessage(msg.chat.id, t('adminPanel', lang), adminMenuButtons(lang))
  })

  // ── web_app_data — order received from miniapp (keyboard-button launches)
  bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id
    const user = msg.from
    const raw = msg.web_app_data?.data

    const rawPresent = !!raw
    const rawLen = raw ? raw.length : 0
    console.log(`[bot] web_app_data EVENT ts=${new Date().toISOString()} from=${user.id} username=${user.username || 'no-username'} chat=${chatId} raw_present=${rawPresent} raw_len=${rawLen}`)
    if (rawPresent) {
      const preview = raw.length > 400 ? raw.slice(0, 400) + '...' : raw
      console.log('[bot] web_app_data preview:', preview)
    }

    if (!raw) {
      bot.sendMessage(chatId, 'Received empty order payload.')
      return
    }

    let payload
    try { payload = JSON.parse(raw) }
    catch { bot.sendMessage(chatId, 'Could not parse order.'); return }

    if (payload.type !== 'cafe_order') {
      bot.sendMessage(chatId, 'Unrecognised order payload.')
      return
    }

    let order
    try {
      order = await createOrder({
        tgUserId: user.id,
        tgUsername: user.username || null,
        tgFirstName: user.first_name || null,
        payload,
      })
    } catch (e) {
      console.error('[bot] DB insert failed:', e)
      bot.sendMessage(chatId, 'Something went wrong saving your order.')
      if (OWNER_ID) bot.sendMessage(OWNER_ID, `DB insert failed for ${user.id}: ${e.message}`)
      return
    }

    // Remember the client language if the user never picked one.
    await rememberUserLang(user.id, user.language_code || 'en', user.username, user.first_name)
    const lang = await getUserLang(user.id)

    await sendOrderConfirmation(chatId, order, await safeTodaysCount(user.id), lang)

    // ── Push to admin dashboard (real-time) ──
    if (io) {
      io.emit('order:new', fullOrderForStaff(payload, order.id))
    }

    notifyStaff(order, payload, { username: user.username, firstName: user.first_name })
  })

  // ── callback_query — language selection + admin actions ──────────────
  bot.on('callback_query', async (cq) => {
    const chatId = cq.message?.chat?.id
    const userId = cq.from?.id
    const data = cq.data

    // 0) Admin-web login code popup (shows the code big for easy copying)
    const loginCodeMatch = data?.match(/^logincode_(\d{6})$/)
    if (loginCodeMatch) {
      bot.answerCallbackQuery(cq.id, { text: loginCodeMatch[1], show_alert: true })
      return
    }

    // 1) Language selection (any user) — persisted to the DB
    const langMatch = data?.match(/^lang_(en|am|om)$/)
    if (langMatch) {
      const lang = await rememberUserLang(userId, langMatch[1], cq.from?.username, cq.from?.first_name)
      if (chatId) {
        bot.sendMessage(chatId,
          `${t('langSet', lang)}\n\n${t('tapMenu', lang)}`, {
            parse_mode: 'Markdown',
            ...miniAppButton(t('openMenu', lang), lang),
          }
        ).catch((e) => console.warn('[bot] lang confirm failed:', e.message))
      }
      // Keep the persistent Menu Button (above the keyboard) in the chosen
      // language too, so EVERY entry point to the Mini App matches.
      if (WEBAPP_URL) {
        bot.setChatMenuButton({
          chat_id: userId,
          menu_button: { type: 'web_app', text: t('openMenu', lang), web_app: { url: `${WEBAPP_URL}?lang=${lang}` } },
        }).catch((e) => console.warn('[bot] setChatMenuButton failed:', e.message))
      }
      bot.answerCallbackQuery(cq.id)
      return
    }

    // 2) Admin actions: prep / ready / cancel / admin_list
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(cq.id, { text: t('notAuthorised', 'en') })
      return
    }

    if (data === 'admin_list') {
      try {
        const { rows } = await pool.query(
          `SELECT id, customer_name, total, status FROM orders ORDER BY created_at DESC LIMIT 8`
        )
        if (!rows.length) {
          bot.sendMessage(chatId, t('adminNoOrders', 'en'))
        } else {
          const lines = rows.map((r) => `#${r.id} · ${r.customer_name} · ${r.total} Br · ${r.status}`)
          bot.sendMessage(chatId, `${t('adminOrders', 'en')}\n\n${lines.join('\n')}`)
        }
      } catch (e) {
        console.error('[bot] admin_list failed:', e.message)
      }
      bot.answerCallbackQuery(cq.id)
      return
    }

    const actionMatch = data?.match(/^(prep|ready|cancel)_(\d+)$/)
    if (actionMatch) {
      const action = actionMatch[1]
      const id = Number(actionMatch[2])
      if (!isValidOrderId(id)) {
        bot.answerCallbackQuery(cq.id, { text: t('orderNotFoundAdmin', 'en') })
        return
      }
      const statusMap = { prep: 'preparing', ready: 'ready', cancel: 'cancelled' }
      const newStatus = statusMap[action]
      let updated
      try {
        updated = await updateOrderStatus(id, newStatus, { by: userId })
      } catch (e) {
        console.error('[bot] status update failed:', e.message)
        bot.answerCallbackQuery(cq.id, { text: t('orderNotFoundAdmin', 'en') })
        return
      }
      if (!updated) {
        bot.answerCallbackQuery(cq.id, { text: t('orderNotFoundAdmin', 'en') })
        return
      }
      bot.answerCallbackQuery(cq.id, { text: `${t('marked', 'en')}: ${newStatus}` })

      // Tell the customer their order status changed — in THEIR language
      const custLang = await getUserLang(updated.tg_user_id)
      const readyText = updated.service_type === 'delivery' ? t('statusReadyDelivery', custLang) : t('statusReadyPickup', custLang)
      let custMsg
      if (newStatus === 'preparing') custMsg = `Order #${id} ${t('statusPreparing', custLang)}`
      else if (newStatus === 'ready') custMsg = `Order #${id} ${t('statusReady', custLang)} ${readyText}`
      else custMsg = `Order #${id} ${t('statusCancelled', custLang)}`
      try { bot.sendMessage(updated.tg_user_id, custMsg) } catch (e) {
        console.warn(`[bot] customer status message failed for ${updated.tg_user_id}:`, e.message)
      }
      return
    }

    bot.answerCallbackQuery(cq.id, { text: t('unknownAction', 'en') })
  })

  // Polling errors → exponential backoff instead of error-spamming
  bot.on('polling_error', (err) => {
    try {
      console.error('[bot] polling_error:', err?.message || err)
      const status = err?.response?.statusCode
      const code = err?.code || ''
      const retryable = status === 429 || status === 502 || /ETIMEDOUT|ECONNRESET|ECONNREFUSED/.test(code)
      if (retryable) {
        pollingBackoffMs = pollingBackoffMs ? Math.min(POLLING_BACKOFF_MAX, pollingBackoffMs * 2) : POLLING_BACKOFF_BASE
        console.warn(`[bot] applying polling backoff ${pollingBackoffMs}ms due to status=${status} code=${code}`)
        try { bot.stopPolling() } catch (e) {}
        if (pollingBackoffTimer) clearTimeout(pollingBackoffTimer)
        pollingBackoffTimer = setTimeout(() => {
          try {
            if (typeof bot.startPolling === 'function') {
              bot.startPolling()
              console.log('[bot] resumed polling after backoff')
            } else {
              console.warn('[bot] startPolling unavailable on this bot instance; please redeploy to recover')
            }
            pollingBackoffMs = 0
          } catch (e) {
            console.error('[bot] failed to resume polling:', e)
          }
        }, pollingBackoffMs)
      }
    } catch (e) {
      console.error('[bot] error handling polling_error:', e)
    }
  })

  console.log('[bot] polling started. Bot is live.')
  console.log(`[bot] admins: ADMIN_TELEGRAM_IDS=[${ADMIN_TELEGRAM_IDS.join(',')}]` +
    ` NOTIFY_CHAT_IDS=[${NOTIFY_CHAT_IDS.join(',')}]` +
    ` OWNER_ID=${OWNER_ID || 'none'} — staff alerts go to [${STAFF_CHAT_IDS.join(',')}]`)
  if (ADMIN_TELEGRAM_IDS.length === 0 && NOTIFY_CHAT_IDS.length === 0 && !OWNER_ID) {
    console.warn('[bot] WARNING: no admin/staff IDs configured — set ADMIN_TELEGRAM_IDS on Railway (comma-separated numeric Telegram IDs)')
  }
  if (OWNER_ID) {
    bot.sendMessage(OWNER_ID, 'Selam Cafe bot is online.').catch(() => {})
  }

  return bot
}

async function safeTodaysCount(userId) {
  try {
    return await countTodaysOrdersForUser(userId)
  } catch (e) {
    console.warn('[bot] countTodaysOrdersForUser failed:', e.message)
    return 0
  }
}

function fullOrderForStaff(payload, orderId) {
  return {
    id: orderId,
    service_type: payload.serviceType,
    customer_name: payload.customer?.name || 'Unknown',
    customer_loc: payload.customer?.location || null,
    items: payload.items,
    total: payload.total,
    status: 'new',
  }
}

// ── HTTP-order helpers (used by POST /api/miniapp/orders) ─────────────
// Telegram only delivers web_app_data when the Mini App was opened from a
// keyboard button. Menu-button and inline-link launches must submit orders
// over HTTP; these helpers give that path the same bot messages as the
// original web_app_data flow.

export async function sendOrderConfirmation(chatId, order, todaysCount, lang = 'en') {
  const bot = activeBot
  if (!bot) throw new Error('bot not started')

  const opts = {}
  const menuBtn = miniAppButton(t('orderAgain', lang), lang)
  if (menuBtn.reply_markup) {
    opts.reply_markup = menuBtn.reply_markup
  }

  const text =
    buildOrderMessage('receipt', order, lang, { todaysCount }) +
    `\n\n${t('wellNotify', lang)}`

  return bot.sendMessage(chatId, text, opts)
}

// Staff notifications render in EACH staff member's own stored language
// (staff pick /lang like customers; their choice persists in user_langs).
// Recipients = ADMIN_TELEGRAM_IDS + NOTIFY_CHAT_IDS + OWNER_TELEGRAM_ID.
// Staff alert: boxed NEW ORDER ALERT with the full item list, customer,
// service type and status — rendered in EACH staff member's own language
// (staff pick /lang like customers; their choice persists in user_langs).
export function notifyStaff(order, payload, from = {}) {
  const bot = activeBot
  if (!bot) throw new Error('bot not started')
  if (!STAFF_CHAT_IDS.length) {
    console.warn('[bot] notifyStaff skipped — no staff IDs configured (ADMIN_TELEGRAM_IDS)')
    return
  }

  const staffOrder = fullOrderForStaff(payload, order.id)

  for (const id of STAFF_CHAT_IDS) {
    ;(async () => {
      let lang = 'en'
      try { lang = await getUserLang(id) } catch (_) { /* default en */ }

      const staffMsg = buildOrderMessage('alert', staffOrder, lang, {
        username: from.username,
        firstName: from.firstName,
      })

      const staffKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: t('startPreparing', lang), callback_data: `prep_${order.id}` },
              { text: t('markReady', lang), callback_data: `ready_${order.id}` },
            ],
            [{ text: t('cancelOrder', lang), callback_data: `cancel_${order.id}` }],
          ],
        },
      }

      await bot.sendMessage(id, staffMsg, staffKeyboard)
    })().catch((e) => {
      console.warn(`[bot] notify chat ${id} failed:`, e.message)
    })
  }
}
