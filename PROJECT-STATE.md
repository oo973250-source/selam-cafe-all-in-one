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
- Committed as `1744506` on `main` and pushed (rebased on top of remote Neon workflow + cloche source-frame deletions).

## ⚠️ Known issues / before production

1. **Cloche animation source frames deleted on remote** (9 commits removed `miniapp/public/cloche/*.png`). The built copies in `miniapp/dist/cloche/` still exist, so the **current** build works — but any future `vite build` will ship without the intro animation. → Restore frames from history (`git show 7ef62d4:miniapp/public/cloche/frame-001.png`) or make the animation pure CSS.
2. **Required env vars on Railway**: `DATABASE_URL` (Neon/Postgres — the `neon_workflow.yml` suggests branching DB), `BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TELEGRAM_IDS`, `WEBAPP_URL` (Railway domain), `WEBHOOK_SECRET`. Optional: `CHAPA_SECRET_KEY` for live payments.
3. After first deploy: set **BotFather → Menu Button** to the Railway URL, and press Start once as a customer.

## 🚀 Next phase — feature add/remove ideas

- Live Chapa keys → real payments (webhook at `/api/payment/webhook`)
- Order history / favorites for repeat customers
- Kitchen display mode on the admin panel
- Real DB-backed menu in the Mini App (currently bundled static menu; only orders hit the DB)
- Restore/replace cloche animation (issue #1)
