// SANDBOX PREVIEW HARNESS — DELETE /api/blocked-users/:tgUserId
import { demo, json } from '@/lib/demo/data'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idx = demo.blocked.findIndex((b) => b.tg_user_id === Number(id))
  if (idx === -1) return json({ error: 'user is not blocked' }, 404)
  demo.blocked.splice(idx, 1)
  return json({ ok: true })
}
