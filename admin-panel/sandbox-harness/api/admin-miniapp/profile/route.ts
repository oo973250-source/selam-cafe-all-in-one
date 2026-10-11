// SANDBOX PREVIEW HARNESS — GET/PATCH /api/admin-miniapp/profile
// Page 9 cafe profile & business settings (cafe name / phone / location / logo /
// opening hours / description). ⚠️ INTEGRATION POINT: no such endpoints in the
// RULES contract yet — this stub exists ONLY so the screen is fully clickable.
// GET   → { profile }
// PATCH → partial merge of the whitelisted + validated fields → { profile }
// CAFE-IDENTITY CONTROLLER: this record is the SINGLE SOURCE OF TRUTH for the
// cafe identity. When cafe_name (or anything else) changes here, the real
// backend MUST (a) stamp updated_at, (b) broadcast `profile:update` to all
// connected admin devices, (c) broadcast `brand:update` to the customer miniapp,
// and (d) make the bot read the new name at runtime — so the new name shows up
// EVERYWHERE it is mentioned (bot greetings, order messages, receipts, customer
// app header) with no redeploy. Other surfaces read GET /api/brand (public).
import { demo, json, readBody } from '@/lib/demo/data'

const DEFAULT_PROFILE = {
  cafe_name: 'Medi Cafe',
  phone: '',
  location: '',
  logo_url: '',
  hours_open: '08:00',
  hours_close: '22:00',
  description: '',
}

// Defensive default for a stale dev-server singleton (pre-Page-9 demo object).
function current() {
  if (!demo.profile) demo.profile = { ...DEFAULT_PROFILE, updated_at: null }
  return demo.profile
}

export async function GET() {
  return json({ profile: current() })
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function PATCH(req: Request) {
  const body = await readBody(req)
  const p = current()
  let touched = false

  if (body.cafe_name !== undefined) {
    const s = String(body.cafe_name).trim().slice(0, 60)
    if (!s) return json({ error: 'Cafe name is required' }, 400)
    p.cafe_name = s
    touched = true
  }
  if (body.phone !== undefined) {
    p.phone = String(body.phone).trim().slice(0, 24)
    touched = true
  }
  if (body.location !== undefined) {
    p.location = String(body.location).trim().slice(0, 120)
    touched = true
  }
  if (body.logo_url !== undefined) {
    const u = String(body.logo_url)
    if (u.length > 400_000) return json({ error: 'Logo image too large' }, 413)
    p.logo_url = u
    touched = true
  }
  if (body.hours_open !== undefined) {
    if (!HHMM.test(String(body.hours_open))) return json({ error: 'hours_open must be HH:MM (24h)' }, 400)
    p.hours_open = String(body.hours_open)
    touched = true
  }
  if (body.hours_close !== undefined) {
    if (!HHMM.test(String(body.hours_close))) return json({ error: 'hours_close must be HH:MM (24h)' }, 400)
    p.hours_close = String(body.hours_close)
    touched = true
  }
  if (body.description !== undefined) {
    p.description = String(body.description).slice(0, 200)
    touched = true
  }

  // identity-version stamp — consumers (customer app / bot) use it to detect a
  // changed cafe profile without diffing every field.
  if (touched) p.updated_at = new Date().toISOString()

  return json({ profile: p })
}
