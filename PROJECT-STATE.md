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
- **Receipt-style messages (per user request):** the customer confirmation is now a boxed "🧾 ORDER RECEIPT" with ticket #, order count today, and every item listed (qty × name — line total), grand total and status with emoji badge; the staff alert is a matching boxed "🔔 NEW ORDER ALERT (#id)" with customer @handle, service type, full item list, total and status. Both render in the recipient's own language (new keys: receipt/word/service labels for en/am/om). Sent as plain text so the dividers draw correctly.
- **Localized order-received popup:** the Mini App's "Order received! Your ticket is #N" alert now uses the i18n dictionary (follows `?lang=` set by bot buttons) instead of hardcoded English.
- **Admin web login fixed — no BotFather dependency:** the Telegram Login Widget silently fails unless the bot's domain was allowlisted via BotFather `/setdomain`, which is why the admin page could never sign anyone in. New flow that needs zero BotFather setup: send `/login` to the bot → it replies with a one-time 6-digit code (10-min TTL, single-use) → type it on the /admin page (`POST /api/auth/login-code`) → same JWT cookie session. The widget remains available as a secondary method.

## ⚠️ Known issues / before production

1. **Required env vars on Railway**: `DATABASE_URL` (Railway Postgres reference `${{Postgres.DATABASE_URL}}` or Neon), `BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TELEGRAM_IDS`, `WEBAPP_URL` (Railway domain), `WEBHOOK_SECRET`. Optional: `CHAPA_SECRET_KEY` for live payments.
1b. **Staff notifications are language-aware**: each staff ID receives order alerts in their own `/lang` choice (stored in `user_langs`); unknown staff default to English.
1c. **Admin recognition fix (important):** `bot.js` originally only checked `NOTIFY_CHAT_IDS`/`OWNER_TELEGRAM_ID` and **ignored `ADMIN_TELEGRAM_IDS`** — staff who set `ADMIN_TELEGRAM_IDS` were never recognized and got no staff alerts. The bot now checks `ADMIN_TELEGRAM_IDS` too; staff alerts go to the union of ADMIN_TELEGRAM_IDS + NOTIFY_CHAT_IDS + OWNER_TELEGRAM_ID (deduped). The bot logs the resolved admin lists at startup, and `/ping` in the bot replies with **your Telegram ID and whether the bot sees you as admin** — use it to confirm the env var matches.
1d. **Localized Menu Button:** choosing a language in the bot also updates your per-chat Menu Button (above the keyboard) via `setChatMenuButton`, in the chosen language, with `?lang=` — so the persistent button matches too.
1e. **Order diagnostics:** `POST /api/miniapp/orders` logs every step (order received → saved → confirmation sent); rejections say exactly why (missing initData vs BOT_TOKEN mismatch). If an order still doesn't arrive, check Railway logs for `[miniapp]` lines at the moment you tap Place Order — no line means the request never reached the server (old deploy or wrong Menu Button URL).
2. After first deploy: set **BotFather → Menu Button** to the Railway URL, and press Start once as a customer.

## 🚀 Next phase — feature add/remove ideas

- Live Chapa keys → real payments (webhook at `/api/payment/webhook`)
- Order history / favorites for repeat customers
- Kitchen display mode on the admin panel
- Real DB-backed menu in the Mini App (currently bundled static menu; only orders hit the DB)
- In-app language switcher inside the Mini App (currently language comes from the bot choice / client language / `?lang=`)
- **Remove the 🧪 "Place Order (skip payment)" test button** in `ConfirmOrder.jsx` before real customers use the app (it was added only to verify the order pipeline without paying).
- Optionally finish BotFather setup: `/setdomain` → Railway domain so the Telegram Login Widget on /admin also works (the /login code flow already covers sign-in without it).
