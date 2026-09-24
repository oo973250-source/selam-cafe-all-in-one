/**
 * server/middleware/auth.js
 * -------------------------
 * JWT auth middleware (admin only).
 */

import jwt from 'jsonwebtoken'
import 'dotenv/config'

const JWT_SECRET = process.env.JWT_SECRET
// Long-lived session: the admin authenticates once and stays signed in for
// 30 days (matches the cookie maxAge in routes/auth.js) unless they log out.
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d'

// Warn instead of crashing the whole process at import time — the server
// should still boot (health, miniapp, menu) even if JWT_SECRET is missing;
// admin-protected routes will simply reject every request.
if (!JWT_SECRET) {
  console.error('[auth] WARNING: JWT_SECRET is not set — admin login will fail until it is configured')
}

export function signToken(payload) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) }
  catch { return null }
}

export function requireAuth(req, res, next) {
  const cookie = req.cookies?.selam_token
  const header = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  const token = cookie || header
  if (!token) return res.status(401).json({ error: 'not authenticated' })
  const decoded = verifyToken(token)
  if (!decoded) return res.status(401).json({ error: 'invalid or expired token' })
  req.user = decoded
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'not authenticated' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'insufficient role' })
    next()
  }
}
