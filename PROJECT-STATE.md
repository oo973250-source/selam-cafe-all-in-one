# Selam Cafe — Project State

_Living doc. Update after each phase. (Source of truth; the old README is outdated.)_

## 🎯 Goal

A **Telegram-based food ordering system for an Ethiopian cafe**, running as a **single Railway service** (one Node process) to fit free-trial limits:

Customer opens the Telegram bot → taps the Menu button → themed Mini App loads (trilingual: English / Amharic / Afaan Oromoo) → orders food → pays via **Chapa** (Ethiopian gateway; mock mode without keys) → cafe staff see the order live on the admin dashboard and tap prep/ready/cancel → the bot sends the customer a **"Order received! Ticket #N"** confirmation plus status updates.

## 🏗 Architecture

| Piece | What it does |
|---|---|
| `server/index.js` | Express + Socket.io; serves Mini App at `/`, admin at `/admin`, API, `/health` |
| `server/bot.js` | Telegram bot (long-polling + backoff), i18n, order confirmations, staff notifications with action buttons; exports `sendOrderConfirmation` / `notifyStaff` |
| `server/routes/miniapp.js` | **New order path**: `POST /api/miniapp/orders` — verifies Telegram `initData` (HMAC-SHA256, 24h freshness, timing-safe) |
| `server/db.js` | Postgres: `orders`, `order_events`, `menu_items`, `admin_users`; auto schema + Ethiopian menu seed |
| `server/routes/payment.js` + `chapa-client.js` | Server-side Chapa proxy; webhook verification; **mock mode** without `CHAPA_SECRET_KEY` |
| `server/routes/auth.js` + `middleware/auth.js` | Admin auth via Telegram Login Widget → JWT cookie; `ADMIN_TELEGRAM_IDS` allowlist |
| `miniapp/` | React+Vite customer app (8-frame flow, cloche intro animation, Telegram WebApp SDK) |
| `admin/` | React+Vite staff dashboard (live orders via Socket.io, today's stats, menu CRUD) |

## ✅ What has been done

- **Fixed the core bug**: Mini App orders went via `tg.sendData()`, which Telegram **silently discards** when the app opens from the Menu button. Orders now submit over **HTTP** (`POST /api/miniapp/orders`) with cryptographic identity verification → confirmation always fires. (`miniapp/dist` rebuilt.)
- Restored all missing bot handlers (`/menu` `/lang` `/help` `/myorders` `/status` `/admin`, staff prep/ready/cancel callbacks) + Amharic/Afaan Oromoo strings.
- Hardened every route: try/catch around all async handlers (Express 4 left DB-down requests hanging forever), clean JSON 503s instead.
- `auth.js` no longer `process.exit(1)` at import; server boots and serves statics even without a DB.
- Menu write routes now actually require admin auth (were permanently 401).
- Committed and pushed to `main` (rebased on top of remote Neon workflow + cloche source-frame deletions).
- **Language selection overhauled (per user feedback):** chosen language now persists in a `user_langs` DB table (survives redeploys/restarts; seeds from the Telegram client language), language keyboard is in **2 rows** (English + Amharic / Afaan Oromoo), and the confirmation message, status updates, and Mini App URL (`?lang=`) all follow the user's stored language.
- **Cloche animation fully removed** (user doesn't want it): component, CSS keyframes, `dist/cloche` frames, and stale comments deleted. Intro is now the 2-phase welcome splash only.
- **Postgres SSL fix:** `db.js` now enables TLS for any hosted DB (Railway public proxy, Neon, Supabase, Render) instead of only URLs containing "railway" — this is what made Neon connections fail with an SSL error. **Railway internal endpoints** (`*.internal`, e.g. `postgres.railway.internal`) are detected by hostname and skip SSL, since the private-network endpoint can refuse TLS and traffic never leaves the network. Works with Railway's own Postgres service via `${{Postgres.DATABASE_URL}}` reference variables.

## ⚠️ Known issues / before production

1. **Required env vars on Railway**: `DATABASE_URL` (Railway Postgres reference `${{Postgres.DATABASE_URL}}` or Neon), `BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TELEGRAM_IDS`, `WEBAPP_URL` (Railway domain), `WEBHOOK_SECRET`. Optional: `CHAPA_SECRET_KEY` for live payments.
1b. **Staff notifications are language-aware**: each staff ID in `ADMIN_TELEGRAM_IDS`/`NOTIFY_CHAT_IDS` receives order alerts in their own `/lang` choice (stored in `user_langs`); unknown staff default to English.
2. After first deploy: set **BotFather → Menu Button** to the Railway URL, and press Start once as a customer.

## 🚀 Next phase — feature add/remove ideas

- Live Chapa keys → real payments (webhook at `/api/payment/webhook`)
- Order history / favorites for repeat customers
- Kitchen display mode on the admin panel
- Real DB-backed menu in the Mini App (currently bundled static menu; only orders hit the DB)
- In-app language switcher inside the Mini App (currently language comes from the bot choice / client language / `?lang=`)
