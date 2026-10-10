// SANDBOX PREVIEW HARNESS — PATCH/DELETE /api/admin-miniapp/admins/:id
// PATCH: role / permissions / active (suspend without deleting) / shift /
//        branch / refund_limit. DELETE: revoke access + archive shift history.
import { demo, json, readBody, staffView } from '@/lib/demo/data'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = demo.staff.find((a) => String(a.tg_user_id) === id)
  if (!admin) return json({ error: 'admin not found' }, 404)

  const body = await readBody(req)
  if (['cashier', 'kitchen', 'delivery'].includes(String(body.role))) admin.role = body.role
  if (Array.isArray(body.permissions)) admin.permissions = body.permissions.map(String)
  if (typeof body.active === 'boolean') admin.active = body.active
  if (['morning', 'afternoon', 'night'].includes(String(body.shift))) admin.shift = body.shift
  if (body.branch !== undefined) admin.branch = String(body.branch)
  if (Number.isFinite(Number(body.refund_limit))) admin.refund_limit = Number(body.refund_limit)
  if (body.name) admin.name = String(body.name)
  return json({ admin: staffView(admin) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idx = demo.staff.findIndex((a) => String(a.tg_user_id) === id)
  if (idx === -1) return json({ error: 'admin not found' }, 404)

  const [removed] = demo.staff.splice(idx, 1)
  // "archives their shift history" — sandbox just drops the record
  return json({ ok: true, archived: true, tg_user_id: removed.tg_user_id })
}
