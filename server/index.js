/**
 * server/index.js
 * ---------------
 * Selam Cafe — All-in-One server.
 *
 * A single Node.js process that runs:
 *   1. The customer-facing Mini App (static files from miniapp/dist)
 *   2. The Chapa payment proxy (/api/payment/*)
 *   3. The Admin CMS API (/api/auth/*, /api/orders/*, /api/menu/*)
 *   4. The Admin CMS UI (static files from admin/dist)
 *   5. The Telegram bot (long-polling, in this same process)
 *   6. Socket.io for real-time admin updates
 *
 * Routes:
 *   GET  /health
 *   GET  /                       → customer Mini App (miniapp/dist)
 *   GET  /admin/*                → admin UI (admin/dist)
 *   POST /api/payment/initialize → Chapa checkout
 *   GET  /api/payment/verify/:tx
 *   POST /api/payment/webhook    → Chapa webhook
 *   *    /api/auth/*             → admin auth (Telegram Login)
 *   *    /api/orders/*           → admin orders CRUD
 *   *    /api/menu/*             → menu CRUD
 */

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { Server as IoServer } from 'socket.io'
import 'dotenv/config'

import { ensureSchema, pool } from './db.js'
import { requireAuth } from './middleware/auth.js'
import { startBot } from './bot.js'
import authRoutes from './routes/auth.js'
import ordersRoutes from './routes/orders.js'
import menuRoutes from './routes/menu.js'
import paymentRoutes from './routes/payment.js'

const PORT = process.env.PORT || 3000
const __dirname = dirname(fileURLToPath(import.meta.url))
const miniappDist = join(__dirname, '..', 'miniapp', 'dist')
const adminDist = join(__dirname, '..', 'admin', 'dist')

const ALLOWED_ORIGINS = [
  process.env.WEBAPP_URL,
  `http://localhost:5173`,
  `http://localhost:5174`,
  `http://localhost:3000`,
].filter(Boolean)

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      return cb(new Error(`Origin ${origin} not allowed`))
    },
    credentials: true,
  })
)

// Health
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ─── API routes ──────────────────────────────────────────────────────────────

// Public payment proxy (no auth — Mini App calls these)
app.use('/api/payment', paymentRoutes)

// Public menu read (no auth — Mini App loads menu)
app.use('/api/menu', menuRoutes)

// Public auth routes (login flow)
app.use('/api/auth', authRoutes)

// Internal endpoint — bot can POST here (but in all-in-one, the bot is in the
// same process, so it can just call io.emit directly. This is kept for external use.)
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'change-me'
app.post('/api/internal/order-created', async (req, res) => {
  const authHeader = req.headers['authorization'] || ''
  const provided = authHeader.replace(/^Bearer\s+/i, '')
  if (provided !== INTERNAL_SECRET) return res.status(401).json({ error: 'unauthorized' })

  const orderId = Number(req.body?.orderId)
  if (!orderId) return res.status(400).json({ error: 'orderId required' })

  const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId])
  if (rows[0]) io.emit('order:new', rows[0])
  res.json({ ok: true })
})

// Protected admin routes
app.use('/api/orders', requireAuth, ordersRoutes)

// ─── Static: Admin UI (at /admin) ────────────────────────────────────────────
if (existsSync(adminDist)) {
  app.use('/admin', express.static(adminDist))
  app.get(/^\/admin(\/.*)?$/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(join(adminDist, 'index.html'))
  })
  console.log('[server] admin UI mounted at /admin')
} else {
  console.warn('[server] admin UI not built (admin/dist missing). Run: npm run build:admin')
}

// ─── Static: Customer Mini App (at /) ────────────────────────────────────────
if (existsSync(miniappDist)) {
  app.use(express.static(miniappDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) return next()
    res.sendFile(join(miniappDist, 'index.html'))
  })
  console.log('[server] mini app mounted at /')
} else {
  console.warn('[server] mini app not built (miniapp/dist missing). Run: npm run build:miniapp')
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[server] error:', err.message)
  res.status(500).json({ error: 'internal error' })
})

// ─── HTTP server + Socket.io ─────────────────────────────────────────────────
const httpServer = createServer(app)
const io = new IoServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('[io] client connected:', socket.id)
  socket.on('disconnect', () => console.log('[io] client disconnected:', socket.id))
})

// ─── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  console.log('[server] ensuring db schema…')
  await ensureSchema()

  console.log('[server] starting telegram bot…')
  await startBot(io)

  httpServer.listen(PORT, () => {
    console.log(`[server] Selam Cafe all-in-one listening on :${PORT}`)
    console.log(`[server]   customer app:  http://localhost:${PORT}/`)
    console.log(`[server]   admin panel:   http://localhost:${PORT}/admin`)
    console.log(`[server]   health:        http://localhost:${PORT}/health`)
  })
}

boot().catch((e) => {
  console.error('[server] boot failed:', e)
  process.exit(1)
})
