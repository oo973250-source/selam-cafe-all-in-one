// SANDBOX PREVIEW HARNESS — GET /api/blocked-users/customers/directory?q=
// Aggregated customers from orders; max 50, newest first (per contract)
import { demo, json } from '@/lib/demo/data'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').toLowerCase()

  const map = new Map<number, { tg_user_id: number; tg_username: string | null; display_name: string; order_count: number; total_spent: number; last_order_at: string }>()
  for (const o of demo.orders) {
    const cur = map.get(o.tg_user_id)
    if (cur) {
      cur.order_count += 1
      cur.total_spent += o.total
      if (o.created_at > cur.last_order_at) cur.last_order_at = o.created_at
    } else {
      map.set(o.tg_user_id, {
        tg_user_id: o.tg_user_id,
        tg_username: o.tg_username,
        display_name: o.customer_name || o.tg_first_name,
        order_count: 1,
        total_spent: o.total,
        last_order_at: o.created_at,
      })
    }
  }

  let users = [...map.values()].sort((a, b) => (a.last_order_at < b.last_order_at ? 1 : -1))
  if (q) {
    users = users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        (u.tg_username || '').toLowerCase().includes(q) ||
        String(u.tg_user_id).includes(q),
    )
  }
  return json({ users: users.slice(0, 50) })
}
