// SANDBOX PREVIEW HARNESS — GET/POST /api/admin-miniapp/admins
// Page 6 staff admins. ⚠️ INTEGRATION POINT: no such endpoints in the RULES
// contract yet — this stub exists ONLY so the Admins screen is clickable.
// GET  → { admins: [ { ...adminFields, stats: { day, week, month } } ] }
// POST → create from a verified profile { tg_user_id, name, role, ... }
import { demo, json, readBody, staffView, demoVerifyProfile } from '@/lib/demo/data'

export async function GET() {
  return json({ admins: demo.staff.map(staffView) })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const tg_user_id = Number(body.tg_user_id)
  if (!Number.isFinite(tg_user_id) || tg_user_id <= 0) {
    return json({ error: 'a verified Telegram User ID is required' }, 400)
  }
  if (demo.staff.some((a) => a.tg_user_id === tg_user_id)) {
    return json({ error: 'this Telegram User ID is already an admin' }, 409)
  }

  const role = ['cashier', 'kitchen', 'delivery'].includes(String(body.role)) ? (body.role as 'cashier') : 'cashier'
  const shift = ['morning', 'afternoon', 'night'].includes(String(body.shift)) ? (body.shift as 'morning') : 'morning'

  // Server-side "Bot API verification" stand-in: fill name/username from the demo pool
  // when the client only sent the raw ID (real backend will look these up itself).
  const profile = demoVerifyProfile(String(tg_user_id))

  demo.staff.push({
    tg_user_id,
    username: body.username ? String(body.username) : profile.username ?? null,
    name: body.name ? String(body.name) : profile.name,
    photo_url: body.photo_url ? String(body.photo_url) : profile.photo_url,
    role,
    permissions: Array.isArray(body.permissions) ? (body.permissions as string[]).map(String) : ['orders'],
    shift,
    branch: body.branch ? String(body.branch) : 'Main',
    active: true,
    refund_limit: Number.isFinite(Number(body.refund_limit)) ? Number(body.refund_limit) : 0,
    done: [],
  })
  return json({ admin: staffView(demo.staff[demo.staff.length - 1]) }, 201)
}
