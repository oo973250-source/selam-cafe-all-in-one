// Updated by assistant to validate order IDs and guard DB calls
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

// ── Config ───────────────────────────────────────────────────────────��[...]
const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const NOTIFY_CHAT_IDS = (process.env.NOTIFY_CHAT_IDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
const OWNER_ID = process.env.OWNER_TELEGRAM_ID
  ? Number(process.env.OWNER_TELEGRAM_ID) : null

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
    welcomeBack: 'እንደገና እንኳን ደህና መጡ',
    langSet: 'ቋንቋ አማርኛ ተመርጧል',
    tapMenu: 'ምናሌን ለመክፈት ከታች ይጫኑ',
    openMenu: '☕ ምናሌ ይክፈቱ',
    orderAgain: '☕ ድጋሚ ይዘዙ',
    menuChooseLang: 'ምናሌን ለከፈት ቋንቋ ይምረጡ',
    adminPanel: 'አስተዳዳሪ ፓነል',
    adminLink: 'የአስተዳዳሪ ፓነል (ዌብ) ይክፈቱ',
    adminOrders: 'የቅርብ ጊዜ ትዕዛዞች (ቦት)',
    adminNoOrders: 'ገና ምንም ትዕዛዝ የለም።',
    adminNotConfigured: 'የአስተዳዳሪ ፓነል URL አልተዋቀረም።',
    helpTitle: 'ሰላም ካፌ ቦት',
    helpStart: '/start — እንኳን ደህና መጡ',
    helpMenu: '/menu — ምናሌ ይክፈቱ',
    helpAdmin: '/admin — አስተዳዳሪ ፓነል',
    helpMyorders: '/myorders — የቅርብ ጊዜ 3 ትዕዛዞችዎ',
    helpStatus: '/status <id> — የትዕዛዝ ሁኔታ',
    helpHelp: '/help — ይህ መልዕክት',
    helpLang: '/lang — ቋንቋ መቀየር',
    noOrders: 'ገና ምንም ትዕዛዝ አላከናወንምም።',
    orderReceived: 'ትዕዛዝ ተቀብሏል!',
    yourTicket: 'ትክትል ቁጥርዎ',
    wellNotify: 'በማዘጋጀት እና በማዝገቡ ጊዜ እንደምንም እንልክልዎታለን።',
    ordersToday: 'ዛሬ ትዕዛዝ አከናወንተዋል።',
    orderOne: 'ትዕዛዝ',
    orderMany: 'ትዕዛዞች',
    yourLastOrders: 'የቅርብ ጊዜ 3 ትዕዛዞችዎ:',
    statusPreparing: 'በማዘጋጀት ላይ ነው። ይጠብቁ!',
    statusReady: 'ዝግጁ ነው!',
    statusReadyDelivery: 'ራይደርዎ በመጪው ነው።',
    statusReadyPickup: 'እባክዎ ይመጡ ያስወጡት።',
    statusCancelled: 'ተሰርዟል። ጥያቄ ካለዎት ያግኙን።',
    orderNotFound: 'ትዕዛዝ አልተገኘም።',
    adminUnauthorized: 'ይህን የአስተዳዳሪ ትዕዛዝ ለመጠቀም ፈቃድ የለዎም።',
    newOrder: 'አዲስ ትዕዛዝ',
    from: 'ከ',
    startPreparing: 'ማዘጋጀት ጀምር',
    markReady: 'ዝግጁ ምልክት',
    cancelOrder: 'ሰርዝ',
    marked: 'ሁኔታ ተቀይሯል',
    notAuthorised: 'ፈቃድ የለም',
    unknownAction: 'ስህተት',
    orderNotFoundAdmin: 'ትዕዛዝ አልተገኘም',
    changeLang: 'ቋንቋ መቀየር',
    items: 'እቃዎች',
    total: 'ጠቅላላ',
    status: 'ሁኔታ',
    time: 'ጊዜ',
    customer: 'ደንበኛ',
    service: 'አገልግሎት',
    location: 'ቦታ',
  },
  om: {
    welcome: 'Baga nagaan dhuftan Kafeessa Selam',
    chooseLang: 'Afaan keessan filadhaa itti fufuuf:',
    welcomeBack: 'Baga irra deebiin nagaan dhuftan',
    langSet: 'Afaan Afaan Oromoo filameera',
    tapMenu: 'Minjeessa baniif tuqa xiqqaa',
    openMenu: '☕ Minjeecha Bani',
    orderAgain: '☕ Rakoo Dabali',
    menuChooseLang: 'Minjeessa baniif afaan filadhaa',
    adminPanel: 'Giddugala Bulchiinsaa',
    adminLink: 'Giddugala Bulchiinsaa (Web) Bani',
    adminOrders: 'Orderwwan Dhiyoo (Bot)',
    adminNoOrders: 'Rakoo hin jiru.',
    adminNotConfigured: 'URL giddugala bulchiinsaa hin qindaa\'ine.',
    helpTitle: 'Botii Kafeessa Selam',
    helpStart: '/start — Baga nagaan dhuftan',
    helpMenu: '/menu — Minjeecha bani',
    helpAdmin: '/admin — Giddugala bulchiinsaa',
    helpMyorders: '/myorders — Orderwwan 3 dhiyoo',
    helpStatus: '/status <id> — Haala rakoo ilaali',
    helpHelp: '/help — Ergaa kanaa',
    helpLang: '/lang — Afaan jijjiiri',
    noOrders: 'Rakoo hin godhatin haaraan.',
    orderReceived: 'Rakoo argameera!',
    yourTicket: 'Namba rakootti keessanii',
    wellNotify: 'Yeroo rakkoon itti fufe nu ergina.',
    ordersToday: 'Order har\'aa godhatani.',
    orderOne: 'rakoo',
    orderMany: 'orderwwan',
    yourLastOrders: 'Orderwwan 3 dhiyoo keessanii:',
    statusPreparing: 'Rakkoon siif qophaa\'aa jira. Sitti eegaa!',
    statusReady: 'Rakoon ready ta\'eera!',
    statusReadyDelivery: 'Naannoon keenya daqiiqaa dha.',
    statusReadyPickup: 'Har\'aa dhihee natti fudhadhaa.',
    statusCancelled: 'Rakoon banaa\'eera. Gaaffii qabaattan nuquuf salaa.',
    orderNotFound: 'Rakoo iddoo kennamee hin argamne.',
    adminUnauthorized: 'Tajaajila bulchiinsaa fayyaduu dandeessuu miti.',
    newOrder: 'Rakoo Haaraa',
    from: 'Kan',
    startPreparing: 'Qopha\'uu Jalqabi',
    markReady: 'Readytti Mirkaneessi',
    cancelOrder: 'Banaa\'i',
    marked: 'Haalli jijjiirameera',
    notAuthorised: 'Dandeessii hin jiru',
    unknownAction: 'Dogoggora',
    orderNotFoundAdmin: 'Rakoo hin argamne',
    changeLang: 'Afaan Jijjiiri',
    items: 'Shaakala',
    total: 'Waliigala',
    status: 'Haala',
    time: 'Yeroo',
    customer: 'Mijaawaa',
    service: 'Tajaajila',
    location: 'Bakka',
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
}

// ── Main bot function ────────────────────────────────────────────────────
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

  // ── /start ──────────────────────────────────────────────────────────��[...]
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

  // ── /menu ───────────────────────────────────────────────────────────[...] 
  bot.onText(/\/menu$/, (msg) => {
    const lang = getUserLang(msg.from.id)
    bot.sendMessage(msg.chat.id, t('menuChooseLang', lang), languageButtons())
  })

  // ── /lang ───────────────────────────────────────────────────────────[...] 
  bot.onText(/\/lang$/, (msg) => {
    bot.sendMessage(msg.chat.id, t('chooseLang', 'en'), languageButtons())
  })

  // ── /admin ──────────────────────────────────────────────────────────��[...]
  bot.onText(/\/admin$/, (msg) => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, t('adminUnauthorized', getUserLang(msg.from.id)))
      return
    }
    bot.sendMessage(msg.chat.id, `*${t('adminPanel', 'en')}*`, {
      parse_mode: 'Markdown',
      ...adminMenuButtons(),
    })
  })

  // ── /help ───────────────────────────────────────────────────────────[...] 
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

  // ── /myorders ─────────────────────────────────────────────────────────
  bot.onText(/\/myorders$/, async (msg) => {
    const lang = getUserLang(msg.from.id)
    let rows
    try {
      const res = await pool.query(
        `SELECT id, service_type, customer_name, total, status, payment_status, created_at
           FROM orders WHERE tg_user_id = $1::bigint ORDER BY created_at DESC LIMIT 3`,
        [msg.from.id]
      )
      rows = res.rows
    } catch (e) {
      console.error('[bot] DB error in /myorders:', e)
      bot.sendMessage(msg.chat.id, 'Error fetching your orders. Please try again later.')
      return
    }

    if (!rows.length) {
      bot.sendMessage(msg.chat.id, t('noOrders', lang), miniAppButton(t('openMenu', lang), lang))
      return
    }
    const lines = rows.map((o) => {
      const time = new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      const emoji = o.status === 'served' ? '✅' : o.status === 'cancelled' ? '❌' : '⏳'
      return `${emoji} *#${o.id}* -- ${o.total} Br - ${SERVICE_LABELS[o.service_type] || o.service_type}\n   ${time} - ${o.status} - ${o.payment_status}`
    })
    bot.sendMessage(msg.chat.id, `*${t('yourLastOrders', lang)}*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' })
  })

  // ── /status <id> ───────────────────────────────────────────────────────
  bot.onText(/\/status\s+(\d+)$/, async (msg, match) => {
    const lang = getUserLang(msg.from.id)
    const orderIdRaw = match[1]
    const orderId = Number(orderIdRaw)

    if (!isValidOrderId(orderId)) {
      bot.sendMessage(msg.chat.id, 'Invalid order ID. Please provide the numeric order ID from your receipt.')
      return
    }

    let rows
    try {
      const res = await pool.query(
        `SELECT * FROM orders WHERE id = $1 AND tg_user_id = $2::bigint`,
        [orderId, msg.from.id]
      )
      rows = res.rows
    } catch (e) {
      console.error('[bot] DB error in /status:', e)
      bot.sendMessage(msg.chat.id, 'Error checking order. Please try again later.')
      return
    }

    if (!rows.length) {
      bot.sendMessage(msg.chat.id, t('orderNotFound', lang))
      return
    }
    bot.sendMessage(msg.chat.id, formatOrderReceipt(rows[0]), { parse_mode: 'Markdown' })
  })

  // ── web_app_data — order received from miniapp ─────────────────────────
  bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id
    const user = msg.from
    const lang = getUserLang(user.id)
    const raw = msg.web_app_data?.data

    console.log(`[bot] web_app_data from ${user.id} (${user.username || 'no-username'})`)

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

  // ── callback_query ─────────────────────────────────────────────────────
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

    // 2) Admin: list recent orders
    if (data === 'admin_list') {
      if (!isAdmin(userId)) {
        bot.answerCallbackQuery(cq.id, { text: t('notAuthorised', 'en') })
        return
      }
      let rows
      try {
        const res = await pool.query(
          `SELECT id, service_type, customer_name, total, status, created_at
             FROM orders ORDER BY created_at DESC LIMIT 10`
        )
        rows = res.rows
      } catch (e) {
        console.error('[bot] DB error in admin_list:', e)
        bot.answerCallbackQuery(cq.id, { text: 'Error fetching orders' })
        return
      }
      if (!rows.length) {
        bot.sendMessage(chatId, t('adminNoOrders', 'en'))
        bot.answerCallbackQuery(cq.id)
        return
      }
      for (const o of rows) {
        const time = new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        const emoji = o.status === 'served' ? '✅' : o.status === 'cancelled' ? '❌' : o.status === 'ready' ? '🍽' : o.status === 'preparing' ? '👨‍🍳' : '🆕'
        const text =
          `${emoji} *#${o.id}* | ${o.total} Br | ${o.status}\n` +
          `${SERVICE_LABELS[o.service_type] || o.service_type} -- ${o.customer_name} -- ${time}`
        const keyboard = {
          reply_markup: {
            inline_keyboard: [[
              { text: '👨‍🍳 Prep', callback_data: `prep_${o.id}` },
              { text: '✅ Ready', callback_data: `ready_${o.id}` },
              { text: '🚫 Cancel', callback_data: `cancel_${o.id}` },
            ]],
          },
        }
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard })
      }
      bot.answerCallbackQuery(cq.id)
      return
    }

    // 3) Staff action buttons (prep/ready/cancel)
    const m = data?.match(/^(prep|ready|cancel)_(\d+)$/)
    if (m) {
      if (!isAdmin(userId)) {
        bot.answerCallbackQuery(cq.id, { text: t('notAuthorised', 'en') })
        return
      }
      const [, action, orderIdStr] = m
      const orderId = Number(orderIdStr)

      if (!isValidOrderId(orderId)) {
        bot.answerCallbackQuery(cq.id, { text: 'Invalid order ID' })
        return
      }

      const newStatus = action === 'prep' ? 'preparing' : action === 'ready' ? 'ready' : 'cancelled'

      let updated
      try {
        updated = await updateOrderStatus(orderId, newStatus)
      } catch (e) {
        console.error('[bot] DB error updating status:', e)
        bot.answerCallbackQuery(cq.id, { text: 'Error updating order' })
        return
      }
      if (!updated) {
        bot.answerCallbackQuery(cq.id, { text: t('orderNotFoundAdmin', 'en') })
        return
      }

      // Edit the staff message to show new status
      try {
        bot.editMessageText(
          cq.message.text + `\n\n_Status: *${newStatus}* by @${cq.from.username || cq.from.first_name}_`,
          { chat_id: chatId, message_id: cq.message.message_id, parse_mode: 'Markdown' }
        )
      } catch (_) { /* message already edited */ }

      // Notify the customer in THEIR language
      if (updated.tg_user_id) {
        const cLang = getUserLang(updated.tg_user_id)
        let customerMsg
        if (newStatus === 'preparing') {
          customerMsg = `*#${orderId}* ${t('statusPreparing', cLang)}`
        } else if (newStatus === 'ready') {
          const extra = updated.service_type === 'delivery'
            ? t('statusReadyDelivery', cLang)
            : t('statusReadyPickup', cLang)
          customerMsg = `*#${orderId}* ${t('statusReady', cLang)} ${extra}`
        } else {
          customerMsg = `*#${orderId}* ${t('statusCancelled', cLang)}`
        }
        bot.sendMessage(updated.tg_user_id, customerMsg, { parse_mode: 'Markdown' }).catch(() => {})
      }

      bot.answerCallbackQuery(cq.id, { text: `${t('marked', 'en')}: ${newStatus}` })
      return
    }

    // Unknown callback
    bot.answerCallbackQuery(cq.id, { text: t('unknownAction', 'en') })
  })

  bot.on('polling_error', (err) => console.error('[bot] polling_error:', err.message))

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
