# medi Cafe — All-in-One

**One repo. One Railway service. One bill. Everything works.**

This is the unified version of the Selam Cafe backend — customer Mini App + Telegram bot + Chapa payment proxy + Admin CMS, all running in a single Node.js process.

## Why this exists

Railway's free trial limits you to a small number of services. If you deploy the customer app, bot, proxy, and admin as 4 separate services, you'll hit the limit fast.

The all-in-one package combines all 4 into **ONE service**, so it counts as 1 service on Railway. You still get all the features — you just deploy it as one unit.

## What's inside

```
selam-cafe-all-in-one/
├── package.json              ← one set of dependencies
├── railway.json              ← one service config
├── .env.example              ← all env vars in one place
├── .gitignore
│
├── server/                   ← the Node.js backend (runs everything)
│   ├── index.js              ← main Express app + Socket.io + bot launcher
│   ├── db.js                 ← shared Postgres pool + schema + helpers
│   ├── bot.js                ← Telegram bot (polling)
│   ├── chapa-client.js       ← Chapa API wrapper (mock mode supported)
│   ├── middleware/auth.js    ← JWT auth for admin
│   ├── routes/
│   │   ├── auth.js           ← Telegram Login Widget verification
│   │   ├── orders.js         ← orders CRUD + stats
│   │   ├── menu.js           ← menu CRUD
│   │   └── payment.js        ← Chapa proxy routes
│   └── scripts/init-db.js
│
├── miniapp/                  ← the customer-facing Vite app
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/               ← backgrounds, brand, owner images
│   └── src/                  ← React code (uses /api/payment/* via proxy)
│
└── admin/                    ← the admin Vite app (served at /admin)
    ├── package.json
    ├── vite.config.js        ← base: '/admin/'
    ├── index.html
    └── src/                  ← React admin UI
```

## How it works

When the server starts, it:

1. Connects to Postgres and creates the schema (orders, order_events, menu_items, admin_users tables)
2. Starts the Telegram bot in polling mode (no public URL needed for the bot)
3. Serves the customer Mini App at `/` (from `miniapp/dist/`)
4. Serves the admin UI at `/admin` (from `admin/dist/`)
5. Exposes API routes:
   - `/api/payment/*` — Chapa proxy (called by the Mini App)
   - `/api/menu` — public menu read (called by the Mini App)
   - `/api/auth/*` — admin Telegram Login
   - `/api/orders/*` — admin orders CRUD (auth required)
6. Runs Socket.io for real-time admin notifications

All of this happens in one Node.js process. One Railway service.

## URLs after deployment

| What | URL |
|---|---|
| Customer Mini App | `https://your-app.up.railway.app/` |
| Admin panel | `https://your-app.up.railway.app/admin` |
| Health check | `https://your-app.up.railway.app/health` |
| Chapa initialize | `https://your-app.up.railway.app/api/payment/initialize` |
| Chapa webhook | `https://your-app.up.railway.app/api/payment/webhook` |

The `WEBAPP_URL` env var should be set to your Railway domain (e.g. `https://your-app.up.railway.app`).

## Deploy to Railway (single service)

### Step 1 — Push to GitHub

1. Download the ZIP from the chat → unzip it
2. Open GitHub Desktop → **File → Add local repository…**
3. Choose the `selam-cafe-all-in-one` folder
4. Click **create a repository here** → **Create repository**
5. Type `Initial commit` in Summary → **Commit to main**
6. Click **Publish repository** → uncheck "Keep this code private" → name it `selam-cafe-all-in-one` → **Publish**

### Step 2 — Create Railway project

1. Go to https://railway.app → Login with GitHub
2. **New Project** → **Deploy from GitHub repo** → pick `selam-cafe-all-in-one`
3. Railway auto-detects the `railway.json` and starts building

### Step 3 — Add Postgres

1. In the Railway project, click **New** (top-right of canvas)
2. **Database** → **Add PostgreSQL**
3. Click the PostgreSQL card → **Variables** tab → find `DATABASE_URL` → copy its value

### Step 4 — Set environment variables

Click your `selam-cafe-all-in-one` service card → **Variables** tab → add each of these:

```
DATABASE_URL=postgresql://postgres:xxxxx@...railway.app:5432/railway
BOT_TOKEN=1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WEBAPP_URL=https://your-app.up.railway.app
MOCK_MODE=true
JWT_SECRET=<random 48-char string>
TELEGRAM_BOT_NAME=SelamCafeBot
ADMIN_TELEGRAM_IDS=<your Telegram user ID>
CHAPA_SECRET_KEY=cs_test_placeholder
CHAPA_PUBLIC_KEY=ck_test_placeholder
WEBHOOK_SECRET=<random 24-char string>
INTERNAL_SECRET=<random 24-char string>
```

> Get your Telegram user ID by messaging `@userinfobot` in Telegram.
> Generate random secrets at https://www.random.org/strings (alphanumeric, 30+ chars).

### Step 5 — Generate domain

1. Click **Settings** tab → **Networking** → **Generate Domain**
2. You get a URL like `https://selam-cafe-all-in-one-production.up.railway.app`
3. **Copy this URL**
4. Go back to **Variables** → edit `WEBAPP_URL` → paste the URL → save

### Step 6 — Verify it's running

1. Open `https://your-app.up.railway.app/health` in your browser
   - Should return: `{"ok":true,"ts":1234567890}`
2. Open `https://your-app.up.railway.app/` — should show your Mini App
3. Open `https://your-app.up.railway.app/admin` — should show admin login

### Step 7 — Connect Telegram bot

1. In Telegram, message `@BotFather`
2. `/newbot` → name it `Selam Cafe` → pick a username ending in `bot`
3. Save the **bot token** → put it in Railway's `BOT_TOKEN` variable
4. `/newapp` → pick your bot → send your Railway URL → confirm with the 6-digit code
5. `/setmenubutton` → pick your bot → send the URL → send label `Order Food`

### Step 8 — Test end-to-end

1. Open your bot in Telegram → tap **Menu** button → Mini App loads
2. Place a test order → bot replies with `✅ Order received! Your ticket is #1`
3. Open `https://your-app.up.railway.app/admin` → log in with Telegram → see the order

### Step 9 — (Later) Real Chapa payments

When you're ready to accept real money:

1. Sign up at https://chapa.co → get your test keys
2. Edit Railway Variables:
   - `CHAPA_SECRET_KEY` = your `cs_test_...` key
   - `CHAPA_PUBLIC_KEY` = your `ck_test_...` key
   - `MOCK_MODE` = `false`
3. Chapa Dashboard → Settings → Webhooks → Add Endpoint:
   - URL: `https://your-app.up.railway.app/api/payment/webhook`
   - Events: `success`, `failed`
   - Header: `Authorization: Bearer <your WEBHOOK_SECRET value>`

### Step 10 — Authorize admin login

1. Message `@BotFather` → `/mybots` → pick your bot
2. **Bot Settings → Domain → Add domain**
3. Add `your-app.up.railway.app` (without https://)

## Local development

If you want to run it on your own computer:

```bash
cd selam-cafe-all-in-one
npm install
npm run build:all   # builds miniapp + admin
cp .env.example .env
# edit .env with your values (you need a local Postgres or use Railway's)
npm start
```

Open:
- http://localhost:3000/ — customer Mini App
- http://localhost:3000/admin — admin panel
- http://localhost:3000/health — health check

## Cost on Railway

| Component | Monthly |
|---|---|
| All-in-one service (Node.js) | ~$3.00 |
| Postgres (1 GB) | ~$5.00 |
| **Total** | **~$8.00/mo** |

Cheaper than the 4-service setup ($10.50) and stays within Railway's free trial longer.

## Troubleshooting

**Build fails on Railway:**
- Check the build logs in Railway
- Most common cause: missing env vars during build. Vite needs `VITE_API_BASE` at build time, but in the all-in-one setup we leave it empty (uses relative URLs).

**Mini App shows but backgrounds missing:**
- Verify the files are on GitHub: `github.com/you/selam-cafe-all-in-one/tree/main/miniapp/public/backgrounds`
- Should see 6+ PNG files

**Bot doesn't reply to orders:**
- Check Railway → your service → **Logs** tab
- Look for `[bot]` errors
- Verify `BOT_TOKEN` and `DATABASE_URL` are set
- Make sure you opened the Mini App from inside Telegram (not a regular browser)

**Admin login fails:**
- Verify `BOT_TOKEN` matches the real bot token
- Verify the Railway domain was added to BotFather's domain list (Step 10)
- Verify your Telegram user ID is in `ADMIN_TELEGRAM_IDS`

**Payments don't work:**
- If `MOCK_MODE=true`: should always succeed (test mode)
- If using real Chapa keys: use Chapa's test card numbers from their docs
- Check `/api/payment/webhook` is reachable from Chapa's servers (no auth needed for the test call)

## Limitations of the all-in-one approach

- **Single point of failure** — if the Node process crashes, everything goes down. Railway auto-restarts, but still.
- **Shared resources** — if the bot is doing heavy work, the admin UI might be slow. Not an issue at cafe-scale.
- **Can't scale independently** — if you get 1000 orders/hour, you'd want to split the bot from the web server. For a small cafe, this is fine.

When you outgrow the all-in-one (probably never for a single cafe), split into the 4 separate services using the folders in the previous ZIP.

## Files modified vs the 4-service version

- `miniapp/src/utils/chapa.js` — now calls `/api/payment/*` via the proxy instead of Chapa directly (uses relative URL when `VITE_API_BASE` is empty)
- `admin/vite.config.js` — `base: '/admin/'` so assets load from `/admin/assets/...`
- `server/index.js` — unified Express app that mounts all routes + serves static files
- `server/bot.js` — exports `startBot(io)` so the main server can launch it in-process

## Need help?

If something breaks, take a screenshot of:
1. The Railway **Deploy** logs (the build output)
2. The Railway **Logs** tab (runtime output after deploy)
3. The browser DevTools console (F12 → Console) of the failing page

Send me those and I'll figure out what's wrong.
