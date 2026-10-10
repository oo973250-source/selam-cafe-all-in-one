// SANDBOX PREVIEW HARNESS — GET /api/orders?status=&limit=50
import { demo, json } from '@/lib/demo/data'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const limit = Number(url.searchParams.get('limit') || 50)

  let orders = [...demo.orders].sort((a, b) => b.id - a.id)
  if (status) orders = orders.filter((o) => o.status === status)
  orders = orders.slice(0, Math.max(1, Math.min(200, limit)))
  return json({ orders })
}
