// Updated: add polling backoff and improved web_app_data logging
// server/bot.js

/**
 * server/bot.js
 * -------------
 * Telegram bot with full i18n (en/am/om), admin management, order notifications.
 * Exports startBot() so the main server can launch it.
 */

import TelegramBot from 'node-telegram-bot-api'
import 'dotenv/config'

import {
  ensureSchema,
  createOrder,
  updateOrderStatus,
  countTodaysOrdersForUser,
  pool,
} from './db.js'

// ── Config ─────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const NOTIFY_CHAT_IDS = (process.env.NOTIFY_CHAT_IDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
const OWNER_ID = process.env.OWNER_TELEGRAM_ID
  ? Number(process.env.OWNER_TELEGRAM_ID) : null

// ── Bot instance (set by startBot) ────────────────────────────────────
// Lets the HTTP layer (POST /api/miniapp/orders) send messages through the
// same bot process. sendData/web_app_data is only delivered for Mini Apps
// opened from a keyboard button, so menu-button/link launches submit over
// HTTP and rely on these helpers for the confirmation message.
let activeBot = null
export function getBot() {
  return activeBot
}

const SERVICE_LABELS = {
  dine_in: 'Dine in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

// ── In-memory user language store ────────────────────────────────────────
const userLang = new Map()
function getUserLang(id) { return userLang.get(id) || 'en' }
function setUserLang(id, lang) { userLang.set(id, lang) }

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
    menuChooseLang: 'Choose your language to open the menu',
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
    ordersToday: "You've placed orders today.",
    orderOne: 'order',
    orderMany: 'orders',
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
  },
  am: {
    welcome: 'ሰላም ካፌ እንኳን ደህና መጡ',
    chooseLang: 'እባክዎ ቋንቋ ይምረጡ:',
    welcomeBack: 'እንኳን ደህና መጡ',
    langSet: 'ቋንቋ አማርኛ ተመርጧል',
    tapMenu: 'ምናሌውን ለመክፈት ከታች ይንኩ',
    openMenu: '☕ ምናሌ ክፈት',
    orderAgain: '☕ እንደገና አዘዝ',
    menuChooseLang: 'ምናሌውን ለመክፈት ቋንቋ ይምረጡ',
    adminPanel: 'የአስተዳደር ክፍል',
    adminLink: 'የአስተዳደር ክፍል ክፈት (ድረ-ገጽ)',
    adminOrders: 'የቅርብ ትዕዛዞች (ቦት)',
    adminNoOrders: 'እስካሁን ትዕዛዝ የለም።',
    adminNotConfigured: 'የአስተዳደር ክፍል አድራሻ አልተዋቀረም።',
    menuNotConfigured: 'የምናሌ አድራሻ አልተዋቀረም።',
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
    ordersToday: 'ዛሬ ትዕዛዞች አዝዘዋል።',
    orderOne: 'ትዕዛዝ',
    orderMany: 'ትዕዛዞች',
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
  },
  om: {
    welcome: 'Baga nagaan dhuftaan Kafeessa Selam',
    chooseLang: 'Maaloo afaan filadhaa:',
    welcomeBack: 'Baga nagaan dhuftaan',
    langSet: 'Afaan Ingilizii filatameera',
    tapMenu: 'Maajii banuuf dibbaabaa tuqi',
    openMenu: '☕ Maajii Banaa',
    orderAgain: '☕ Irra deebii ajaja',
    menuChooseLang: 'Maajii banuuf afaan filadhaa',
    adminPanel: 'Panel Bulchaa',
    adminLink: 'Panel Bulchaa Banaa (Saayidii)',
    adminOrders: 'Ajajawwan Dhiyoo (Bot)',
    adminNoOrders: 'Amma ajaja hin jiru.',
    adminNotConfigured: "Teessoo panel bulchaa hin qindaa'in.",
    menuNotConfigured: "Teessoo maajii hin qindaa'in.",
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
    wellNotify: "Yeroo qopheessinu fi yeroo qopheessinus isin beeksiifna.",
    ordersToday: "Har'a ajajawwan ajajtan.",
    orderOne: 'ajaja',
    orderMany: 'ajajawwan',
    yourLastOrders: 'Ajaja 3 dhiyoo kee:',
    statusPreparing: 'Qopheeffamaa jira. Xiqqoo eegaa!',
    statusReady: 'Qopheeffameera!',
    statusReadyDelivery: 'Guuraa keenya karaa irra jira.',
    statusReadyPickup: 'Maaloo fuudhuun koottaa.',
    statusCancelled: 'Haqameera. Gaaffii yoo jiraatte maaloo nu qunnamsiisaa.',
    orderNotFound: 'Galmee keetti ajaja lakkoofsa sanaan hin argamne.',
    adminUnauthorized: 'Ajjaja bulchaa itti fayyadamuuf hayyama hin qabdu.',
    newOrder: 'AJAJA HAARAA',
    from: 'Garga',
    startPreparing: 'Qopheessuu Jalqabi',
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
    service: 'Tajaajila',
    location: 'Iddoo',
  },
}

function t(key, lang) {
  return (T[lang] && T[lang][key]) || T.en[key] || key
}

// ── Helper functions ──────────────────────────────────────────────────────
function miniAppButton(label, lang) {
  const url = lang ? `${WEBAPP_URL}?lang=${lang}` : WEBAPP_URL
  return {
    reply_markup: {
      inline_keyboard: [[{ text: label, web_app: { url } }]],
    },
  }
}

function languageButtons() {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '🇬🇧 English', callback_data: 'lang_en' },
        { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' },
        { text: '🇪🇹 Afaan Oromoo', callback_data: 'lang_om' },
      ]],
    },
  }
}

function adminMenuButtons() {
  const btns = [
    [{ text: '📋 ' + t('adminOrders', 'en'), callback_data: 'admin_list' }],
  ]
  if (WEBAPP_URL) {
    const adminUrl = WEBAPP_URL + '/admin'
    btns.push([{ text: '📊 ' + t('adminLink', 'en'), url: adminUrl }])
  }
  return {
    reply_markup: { inline_keyboard: btns },
  }
}

function formatOrderReceipt(order) {
  const itemLines = (order.items || [])
    .map((i) => `  - ${i.quantity}x ${i.nameEn || i.nameAm || i.id} -- ${i.price * i.quantity} Br`)
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

function isAdmin(userId) {
  if (OWNER_ID && userId === OWNER_ID) return true
  return NOTIFY_CHAT_IDS.includes(String(userId))
}

// New helper: validate order id to avoid passing out-of-range ints to Postgres
function isValidOrderId(n) {
  if (typeof n === 'string') n = Number(n)
  if (!Number.isFinite(n)) return false
  if (!Number.isSafeInteger(n)) return false
  if (n < 1) return false
  // orders.id is SERIAL (32-bit signed); guard against overflow
  const MAX_INT32 = 2147483647
  return n <= MAX_INT32
}// ── Main bot function ───────────────────────────────────────────────���─────────────────────────────────────
export async function startBot(io) {
  if (!BOT_TOKEN) {
    console.warn('[bot] BOT_TOKEN not set -- bot disabled')
    return null
  }
  if (!WEBAPP_URL) {
    console.warn('[bot] WEBAPP_URL not set -- buttons will be missing')
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
    const lang = getUserLang(msg.from.id)
    const name = msg.from.first_name || ''
    const deepLink = match?.[2]
    const greeting = deepLink === 'reorder'
      ? `*${t('welcomeBack', lang)}, ${name}!*\n\n${t('chooseLang', lang)}`
      : `*${t('welcome', lang)}, ${name}!*\n\n${t('chooseLang', lang)}`
    bot.sendMessage(msg.chat.id, greeting, {
      parse_mode: 'Markdown',
      ...languageButtons(),
    })
  })


  // ── /menu — open the Mini App ──────────────────────────────────────
  bot.onText(/\/menu$/, async (msg) => {
    const lang = getUserLang(msg.from.id)
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
  bot.onText(/\/lang$/, (msg) => {
    bot.sendMessage(msg.chat.id, t('chooseLang', getUserLang(msg.from.id)), languageButtons())
  })

  // ── /help — command list ─────────────────────────────────────────────
  bot.onText(/\/help$/, (msg) => {
    const lang = getUserLang(msg.from.id)
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
    const lang = getUserLang(msg.from.id)
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
  })

  // ── /status <id> — check a specific order ────────────────────────────
  bot.onText(/\/status\s+(\d+)$/, async (msg, match) => {
    const lang = getUserLang(msg.from.id)
    const id = Number(match[1])
    if (!isValidOrderId(id)) {
      bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
      return
    }
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
  })

  // ── /admin — admin panel + recent orders (admins only) ───────────────
  bot.onText(/\/admin$/, async (msg) => {
    const lang = getUserLang(msg.from.id)
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, t('adminUnauthorized', lang))
      return
    }
    bot.sendMessage(msg.chat.id, t('adminPanel', lang), adminMenuButtons())
  })

  // ── web_app_data — order received from miniapp ─────────────────────────
  bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id
    const user = msg.from
    const lang = getUserLang(user.id)
    const raw = msg.web_app_data?.data

    // More verbose top-level logging to confirm receipt in Railway logs
    const rawPresent = !!raw
    const rawLen = raw ? raw.length : 0
    console.log(`[bot] web_app_data EVENT ts=${new Date().toISOString()} from=${user.id} username=${user.username || 'no-username'} chat=${chatId} raw_present=${rawPresent} raw_len=${rawLen}`)
    // Include a short preview for debugging (do not log full PII in production)
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

    // ── Order confirmation message (in user's language) ──
    const todaysCount = await countTodaysOrdersForUser(user.id)
    const countText = `${todaysCount} ${todaysCount === 1 ? t('orderOne', lang) : t('orderMany', lang)}`
    bot.sendMessage(chatId,
      `*${t('orderReceived', lang)}*\n\n` +
      `${t('yourTicket', lang)} *#${order.id}*.\n` +
      `${t('wellNotify', lang)}\n\n` +
      `_${t('ordersToday', lang).replace('orders', countText)}_`,
      { parse_mode: 'Markdown', ...miniAppButton(t('orderAgain', lang), lang) }
    )

    // ── Push to admin dashboard (real-time) ──
    if (io) {
      const fullOrder = {
        id: order.id,
        service_type: payload.serviceType,
        customer_name: payload.customer?.name || 'Unknown',
        customer_loc: payload.customer?.location || null,
        items: payload.items,
        total: payload.total,
        status: 'new',
      }
      io.emit('order:new', fullOrder)
    }

    // ── Notify staff chats ──
    const staffMsg =
      `*${t('newOrder', 'en')} #${order.id}*\n` +
      `${t('from', 'en')}: @${user.username || '--'} (${user.first_name || ''})\n` +
      formatOrderReceipt(fullOrderForStaff(payload, order.id)).replace(/.*\n/, '')

    const staffKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `${t('startPreparing', 'en')} `, callback_data: `prep_${order.id}` },
            { text: ` ${t('markReady', 'en')} `, callback_data: `ready_${order.id}` },
          ],
          [{ text: ` ${t('cancelOrder', 'en')} `, callback_data: `cancel_${order.id}` }],
        ],
      },
    }

    for (const id of NOTIFY_CHAT_IDS) {
      bot.sendMessage(id, staffMsg, { parse_mode: 'Markdown', ...staffKeyboard }).catch((e) => {
        console.warn(`[bot] notify chat ${id} failed:`, e.message)
      })
    }
  })

  // ── callback_query — language selection + admin actions ──────────────
  bot.on('callback_query', async (cq) => {
    const chatId = cq.message?.chat?.id
    const userId = cq.from?.id
    const data = cq.data

    // 1) Language selection (any user)
    const langMatch = data?.match(/^lang_(en|am|om)$/)
    if (langMatch) {
      const lang = langMatch[1]
      setUserLang(userId, lang)
      bot.sendMessage(chatId,
        `${t('langSet', lang)}\n\n${t('tapMenu', lang)}`, {
          parse_mode: 'Markdown',
          ...miniAppButton(t('openMenu', lang), lang),
        }
      )
      bot.answerCallbackQuery(cq.id)
      return
    }

    // 2) Admin actions: prep / ready / cancel / admin_list
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(cq.id, { text: t('notAuthorised', 'en') })
      return
    }

    if (data === 'admin_list') {
      const { rows } = await pool.query(
        `SELECT id, customer_name, total, status FROM orders ORDER BY created_at DESC LIMIT 8`
      )
      if (!rows.length) {
        bot.sendMessage(chatId, t('adminNoOrders', 'en'))
      } else {
        const lines = rows.map((r) => `#${r.id} · ${r.customer_name} · ${r.total} Br · ${r.status}`)
        bot.sendMessage(chatId, `${t('adminOrders', 'en')}\n\n${lines.join('\n')}`)
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
      const updated = await updateOrderStatus(id, newStatus, { by: userId })
      if (!updated) {
        bot.answerCallbackQuery(cq.id, { text: t('orderNotFoundAdmin', 'en') })
        return
      }
      bot.answerCallbackQuery(cq.id, { text: `${t('marked', 'en')}: ${newStatus}` })

      // Tell the customer their order status changed (in their language)
      const lang = getUserLang(updated.tg_user_id)
      const readyText = updated.service_type === 'delivery' ? t('statusReadyDelivery', lang) : t('statusReadyPickup', lang)
      let custMsg
      if (newStatus === 'preparing') custMsg = `Order #${id} ${t('statusPreparing', lang)}`
      else if (newStatus === 'ready') custMsg = `Order #${id} ${t('statusReady', lang)} ${readyText}`
      else custMsg = `Order #${id} ${t('statusCancelled', lang)}`
      try { bot.sendMessage(updated.tg_user_id, custMsg) } catch (e) {
        console.warn(`[bot] customer status message failed for ${updated.tg_user_id}:`, e.message)
      }
      return
    }

    bot.answerCallbackQuery(cq.id, { text: t('unknownAction', 'en') })
  })

  // Replace simple polling_error log with exponential backoff handling
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
            // restart polling
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
  if (OWNER_ID) {
    bot.sendMessage(OWNER_ID, 'Selam Cafe bot is online.').catch(() => {})
  }

  return bot
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

  const countText = `${todaysCount} ${todaysCount === 1 ? t('orderOne', lang) : t('orderMany', lang)}`
  const opts = { parse_mode: 'Markdown' }
  if (WEBAPP_URL) {
    opts.reply_markup = miniAppButton(t('orderAgain', lang), lang).reply_markup
  }

  return bot.sendMessage(
    chatId,
    `*${t('orderReceived', lang)}*\n\n` +
      `${t('yourTicket', lang)} *#${order.id}*.\n` +
      `${t('wellNotify', lang)}\n\n` +
      `_${t('ordersToday', lang).replace('orders', countText)}_`,
    opts
  )
}

export function notifyStaff(order, payload, from = {}) {
  const bot = activeBot
  if (!bot) throw new Error('bot not started')

  const staffMsg =
    `*${t('newOrder', 'en')} #${order.id}*\n` +
    `${t('from', 'en')}: @${from.username || '--'} (${from.firstName || ''})\n` +
    formatOrderReceipt(fullOrderForStaff(payload, order.id)).replace(/.*\n/, '')

  const staffKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: t('startPreparing', 'en'), callback_data: `prep_${order.id}` },
          { text: t('markReady', 'en'), callback_data: `ready_${order.id}` },
        ],
        [{ text: t('cancelOrder', 'en'), callback_data: `cancel_${order.id}` }],
      ],
    },
  }

  for (const id of NOTIFY_CHAT_IDS) {
    bot.sendMessage(id, staffMsg, { parse_mode: 'Markdown', ...staffKeyboard }).catch((e) => {
      console.warn(`[bot] notify chat ${id} failed:`, e.message)
    })
  }
}
