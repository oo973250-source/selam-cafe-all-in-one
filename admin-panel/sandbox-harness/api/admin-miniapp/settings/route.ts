// SANDBOX PREVIEW HARNESS — GET/PATCH /api/admin-miniapp/settings
// Page 7 admin panel (order limit / throttle / delivery toggle / pause / close /
// closure reason / emergency kill-switch). ⚠️ INTEGRATION POINT: no such endpoints
// in the RULES contract yet — this stub exists ONLY so the screen is clickable.
// GET   → { settings } (expired timers normalize to null on read)
// PATCH → partial merge of the whitelisted fields → { settings }
// The PATCH also logs pause/close actions into demo.pauseHistory (Reports page)
// and stamps ended_at when the store resumes/reopens.
import { demo, json, readBody } from '@/lib/demo/data'

// Append a pause/closure event to the Reports history (defensive against a stale
// dev-server singleton that predates the pauseHistory seed).
function logPauseEvent(kind: 'emergency' | 'countdown' | 'closed', reason: string) {
  if (!Array.isArray(demo.pauseHistory)) demo.pauseHistory = []
  const entry = {
    id: ++demo.histSeq,
    kind,
    reason: String(reason || '').trim(),
    started_at: new Date().toISOString(),
    ended_at: null,
  }
  demo.pauseHistory.push(entry)
  return entry
}

// Stamp ended_at on the most recent still-ongoing event of the given kinds.
function closeOpenPauseEvents(kinds: string[]) {
  if (!Array.isArray(demo.pauseHistory)) return
  const now = new Date().toISOString()
  for (let i = demo.pauseHistory.length - 1; i >= 0; i--) {
    const e = demo.pauseHistory[i]
    if (e && !e.ended_at && kinds.includes(e.kind)) {
      e.ended_at = now
      return
    }
  }
}

// Defensive default for a stale dev-server singleton (pre-Page-7 demo object).
function current() {
  if (!demo.settings) {
    demo.settings = {
      order_limit: 0,
      pickup_throttle_min: 0,
      delivery_available: true,
      paused: false,
      pause_until: null,
      close_until: null,
      closure_reason: '',
    }
  }
  const s = demo.settings
  const now = Date.now()
  // Expired timers normalize on read — the real server owns auto-resume at integration.
  if (s.pause_until && new Date(s.pause_until).getTime() <= now) s.pause_until = null
  if (s.close_until && new Date(s.close_until).getTime() <= now) s.close_until = null
  return s
}

export async function GET() {
  return json({ settings: current() })
}

function asIso(v: unknown): string | null | undefined {
  if (v === null) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export async function PATCH(req: Request) {
  const body = await readBody(req)
  const s = current()

  if (body.order_limit !== undefined) {
    const n = Math.round(Number(body.order_limit))
    if (!Number.isFinite(n) || n < 0) return json({ error: 'order_limit must be a non-negative integer' }, 400)
    // No business cap (user directive): the ADMIN decides the maximum. 9999 is
    // only a technical sanity bound against typos — 0 means "no cap".
    s.order_limit = Math.min(9999, n)
  }
  if (body.pickup_throttle_min !== undefined) {
    const n = Math.round(Number(body.pickup_throttle_min))
    if (!Number.isFinite(n) || n < 0) return json({ error: 'pickup_throttle_min must be a non-negative integer' }, 400)
    s.pickup_throttle_min = Math.min(120, n)
  }
  if (body.delivery_available !== undefined) s.delivery_available = !!body.delivery_available
  if (body.paused !== undefined) {
    const next = !!body.paused
    if (next && !s.paused) logPauseEvent('emergency', String(body.closure_reason ?? s.closure_reason ?? ''))
    if (!next && s.paused) closeOpenPauseEvents(['emergency'])
    s.paused = next
  }
  if (body.pause_until !== undefined) {
    const v = asIso(body.pause_until)
    if (v === undefined) return json({ error: 'pause_until must be an ISO timestamp or null' }, 400)
    if (v && !s.pause_until) logPauseEvent('countdown', String(body.closure_reason ?? s.closure_reason ?? ''))
    if (!v && s.pause_until) closeOpenPauseEvents(['countdown', 'emergency'])
    s.pause_until = v
  }
  if (body.close_until !== undefined) {
    const v = asIso(body.close_until)
    if (v === undefined) return json({ error: 'close_until must be an ISO timestamp or null' }, 400)
    if (v && !s.close_until) logPauseEvent('closed', String(body.closure_reason ?? s.closure_reason ?? ''))
    if (!v && s.close_until) closeOpenPauseEvents(['closed', 'emergency', 'countdown'])
    s.close_until = v
  }
  if (body.closure_reason !== undefined) s.closure_reason = String(body.closure_reason).slice(0, 500)

  return json({ settings: s })
}
