// SANDBOX PREVIEW HARNESS — GET/POST /api/blocked-users
import { demo, json, readBody } from '@/lib/demo/data'

export async function GET() {
  const users = demo.blocked.map((b) => {
    const theirs = demo.orders.filter((o) => o.tg_user_id === b.tg_user_id)
    return {
      ...b,
      order_count: theirs.length,
      total_spent: theirs.reduce((s, o) => s + o.total, 0),
    }
  })
  return json({ users })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const raw = body.idOrUsername ? String(body.idOrUsername).trim() : ''
  if (!raw) return json({ error: 'idOrUsername is required' }, 400)

  let tgUserId: number | null = null
  let username: string | null = null

  if (/^\d+$/.test(raw)) {
    tgUserId = Number(raw)
  } else if (/^@\w+$/.test(raw)) {
    username = raw.slice(1)
    const known = demo.orders.find((o) => o.tg_username === username)
    if (!known) return json({ error: 'user has never ordered — numeric ID required' }, 404)
    tgUserId = known.tg_user_id
  } else {
    return json({ error: 'invalid ID — use numeric Telegram ID or @username' }, 400)
  }

  if (demo.blocked.some((b) => b.tg_user_id === tgUserId)) {
    return json({ error: 'user is already blocked' }, 409)
  }

  const known = demo.orders.find((o) => o.tg_user_id === tgUserId)
  demo.blocked.push({
    tg_user_id: tgUserId,
    username: known?.tg_username ?? username,
    reason: body.reason ? String(body.reason) : '',
    blocked_by: 'preview-admin',
    blocked_at: new Date().toISOString(),
  })
  return json({ ok: true, user: { tg_user_id: tgUserId, tg_username: known?.tg_username ?? username } })
}
