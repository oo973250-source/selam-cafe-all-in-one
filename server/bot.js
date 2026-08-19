/**
 * server/bot.js
 * -------------
 * Telegram bot. Exports startBot() so the main server can launch it.
 * Uses long-polling (no public URL needed for the bot).
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

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const NOTIFY_CHAT_IDS = (process.env.NOTIFY_CHAT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const OWNER_ID = process.env.OWNER_TELEGRAM_ID
  ? Number(process.env.OWNER_TELEGRAM_ID)
  : null

const SERVICE_LABELS = {
  dine_in: 'Dine in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

function miniAppButton(label = '☕ Open Menu', lang = '') {
  const url = lang ? `${WEBAPP_URL}?lang=${lang}` : WEBAPP_URL
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: label, web_app: { url } },
      ]],
    },
  }
}

function languageButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' },
          { text: '🇪🇹 Afaan Oromoo', callback_data: 'lang_om' },
        ],
      ],
    },
  }
}

function formatOrderReceipt(order) {
  const itemLines = (order.items || [])
    .map((i) => `  • ${i.quantity}× ${i.nameEn || i.nameAm || i.id} — ${i.price * i.quantity} Br`)
    .join('\n')
  const loc = order.customer_loc
  const locStr = loc?.address
    ? `\n📍 *Location:* ${loc.address}` + (loc.lat ? ` (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})` : '')
    : ''
  return (
    `🧾 *Order #${order.id}*\n` +
    `👤 ${order.customer_name}\n` +
    `🍽 ${SERVICE_LABELS[order.service_type] || order.service_type}\n` +
    `\n*Items:*\n${itemLines}\n` +
    `\n*Total:* ${order.total} Br` +
    locStr +
    `\n\nStatus: _${order.status}_`
  )
}

export async function startBot(io) {
  if (!BOT_TOKEN) {
    console.warn('[bot] BOT_TOKEN not set — bot disabled')
    return null
  }
  if (!WEBAPP_URL) {
    console.warn('[bot] WEBAPP_URL not set — /start and /menu buttons will be missing')
  }

  await ensureSchema()

  const bot = new TelegramBot(BOT_TOKEN, { polling: true })

  // /start — shows language selection first
  bot.onText(/^\/start(\s+(.+))?$/, async (msg, match) => {
    const name = msg.from?.first_name || 'there'
    const deepLink = match?.[2]
    let greeting = `👋 Welcome to *Selam Cafe*, ${name}!\n\n` +
      `Please choose your language to continue:`
    if (deepLink === 'reorder') {
      greeting = `👋 Welcome back, ${name}!\n\nPlease choose your language:`
    }
    bot.sendMessage(msg.chat.id, greeting, {
      parse_mode: 'Markdown',
      ...languageButtons(),
    })
  })

  // /menu — also shows language selection
  bot.onText(/^\/menu$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Choose your language to open the menu ☕', languageButtons())
  })

  // /admin — sends admin panel link
  bot.onText(/^\/admin$/, (msg) => {
    if (!WEBAPP_URL) {
      bot.sendMessage(msg.chat.id, '⚠️ Admin panel URL not configured.')
      return
    }
    const adminUrl = WEBAPP_URL + '/admin'
    bot.sendMessage(msg.chat.id, `📊 *Admin Panel*\n\n${adminUrl}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📊 Open Admin Panel', url: adminUrl }]],
      },
    })
  })

  // /help
  bot.onText(/^\/help$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      [
        '*Selam Cafe Bot* ☕',
        '',
        '/start — welcome + choose language',
        '/menu — open the menu',
        '/admin — open admin panel',
        '/myorders — your last 3 orders',
        '/status <id> — check order status',
        '/help — this message',
      ].join('\n'),
      { parse_mode: 'Markdown' }
    )
  })

  // /myorders
  bot.onText(/^\/myorders$/, async (msg) => {
    const { rows } = await pool.query(
      `SELECT id, service_type, customer_name, total, status, payment_status, created_at
         FROM orders WHERE tg_user_id = $1
         ORDER BY created_at DESC LIMIT 3`,
      [msg.from.id]
    )
    if (!rows.length) {
      bot.sendMessage(msg.chat.id, "You haven't placed any orders yet. Tap /menu to get started! ☕", miniAppButton('☕ Open Menu'))
      return
    }
    const lines = rows.map((o) => {
      const time = new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      const emoji = o.status === 'served' ? '✅' : o.status === 'cancelled' ? '❌' : '⏳'
      return `${emoji} *#${o.id}* — ${o.total} Br · ${SERVICE_LABELS[o.service_type] || o.service_type}\n   ${time} · ${o.status} · ${o.payment_status}`
    })
    bot.sendMessage(msg.chat.id, `*Your last 3 orders:*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' })
  })

  // /status <id>
  bot.onText(/^\/status\s+(\d+)$/, async (msg, match) => {
    const orderId = Number(match[1])
    const { rows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1 AND tg_user_id = $2`,
      [orderId, msg.from.id]
    )
    if (!rows.length) {
      bot.sendMessage(msg.chat.id, `No order found with ID ${orderId} for your account.`)
      return
    }
    bot.sendMessage(msg.chat.id, formatOrderReceipt(rows[0]), { parse_mode: 'Markdown' })
  })

  // web_app_data — main order handler
  bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id
    const user = msg.from
    const raw = msg.web_app_data?.data

    console.log(`[bot] web_app_data from ${user.id} (${user.username || 'no-username'})`)

    if (!raw) {
      bot.sendMessage(chatId, '⚠️ Received an empty order payload.')
      return
    }

    let payload
    try { payload = JSON.parse(raw) }
    catch {
      bot.sendMessage(chatId, '⚠️ Could not parse your order.')
      return
    }

    if (payload.type !== 'cafe_order') {
      bot.sendMessage(chatId, '⚠️ Unrecognised order payload.')
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
      bot.sendMessage(chatId, '⚠️ Something went wrong saving your order. Our staff has been notified.')
      if (OWNER_ID) bot.sendMessage(OWNER_ID, `❌ DB insert failed for ${user.id}: ${e.message}`)
      return
    }

    const todaysCount = await countTodaysOrdersForUser(user.id)
    bot.sendMessage(chatId,
      `✅ *Order received!*\n\nYour ticket is *#${order.id}*.\n` +
      `We'll message you when it's being prepared and again when it's ready.\n\n` +
      `_You've placed ${todaysCount} ${todaysCount === 1 ? 'order' : 'orders'} today._`,
      { parse_mode: 'Markdown', ...miniAppButton('☕ Order again') }
    )

    // Push real-time update to admin dashboard
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

    // Notify staff chats
    const staffMsg =
      `🔔 *NEW ORDER #${order.id}*\n` +
      `From: @${user.username || '—'} (${user.first_name || ''})\n` +
      formatOrderReceipt(fullOrderForStaff(payload, order.id)).replace(/^🧾.*\n/, '')

    const staffKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👨‍🍳 Start preparing', callback_data: `prep_${order.id}` },
            { text: '✅ Mark ready', callback_data: `ready_${order.id}` },
          ],
          [{ text: '🚫 Cancel', callback_data: `cancel_${order.id}` }],
        ],
      },
    }

    for (const id of NOTIFY_CHAT_IDS) {
      bot.sendMessage(id, staffMsg, { parse_mode: 'Markdown', ...staffKeyboard }).catch((e) => {
        console.warn(`[bot] notify chat ${id} failed:`, e.message)
      })
    }
  })

  // callback_query — handles both language selection AND staff action buttons
  bot.on('callback_query', async (cq) => {
    const chatId = cq.message?.chat?.id
    const data = cq.data

    // 1) Language selection (any user can tap this)
    const langMatch = data?.match(/^lang_(en|am|om)$/)
    if (langMatch) {
      const lang = langMatch[1]
      const langNames = { en: 'English', am: 'Amharic', om: 'Afaan Oromoo' }
      bot.sendMessage(chatId,
        `✅ Language: *${langNames[lang]}*\n\nTap below to open the menu ☕`,
        { parse_mode: 'Markdown', ...miniAppButton('☕ Open Menu', lang) }
      )
      bot.answerCallbackQuery(cq.id)
      return
    }

    // 2) Staff action buttons (only authorised chat IDs)
    if (!NOTIFY_CHAT_IDS.includes(String(chatId))) {
      bot.answerCallbackQuery(cq.id, { text: 'Not authorised' })
      return
    }
    const m = data?.match(/^(prep|ready|cancel)_(\d+)$/)
    if (!m) { bot.answerCallbackQuery(cq.id, { text: 'Unknown action' }); return }

    const [, action, orderIdStr] = m
    const orderId = Number(orderIdStr)
    const newStatus = action === 'prep' ? 'preparing' : action === 'ready' ? 'ready' : 'cancelled'

    const updated = await updateOrderStatus(orderId, newStatus)
    if (!updated) { bot.answerCallbackQuery(cq.id, { text: 'Order not found' }); return }

    bot.editMessageText(
      cq.message.text + `\n\n_✏️ Status: *${newStatus}* by @${cq.from.username || cq.from.first_name}_`,
      { chat_id: chatId, message_id: cq.message.message_id, parse_mode: 'Markdown' }
    )

    if (updated.tg_user_id) {
      const customerUpdate =
        newStatus === 'preparing'
          ? `👨‍🍳 Your order #${orderId} is being prepared. Hang tight!`
          : newStatus === 'ready'
          ? `✅ Your order #${orderId} is ready! ` +
            (updated.service_type === 'delivery'
              ? 'Our rider is on the way.'
              : 'Please come pick it up.')
          : `⚠️ Your order #${orderId} was cancelled. Please message us if you have questions.`
      bot.sendMessage(updated.tg_user_id, customerUpdate).catch(() => {})
    }

    bot.answerCallbackQuery(cq.id, { text: `Marked ${newStatus}` })
  })

  bot.on('polling_error', (err) => console.error('[bot] polling_error:', err.message))

  console.log('[bot] polling started. Bot is live.')
  if (OWNER_ID) {
    bot.sendMessage(OWNER_ID, '☕ Selam Cafe bot is online.').catch(() => {})
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
