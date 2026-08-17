/**
 * server/middleware/auth.js
 * -------------------------
 * JWT auth middleware (admin only).
 */

import jwt from 'jsonwebtoken'
import 'dotenv/config'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'

if (!JWT_SECRET) {
  console.error('[auth] FATAL: JWT_SECRET is not set')
  process.exit(1)
}

export function signToken(payload) {
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
