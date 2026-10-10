// SANDBOX PREVIEW HARNESS — GET /api/orders/stats/today
import { demo, json } from '@/lib/demo/data'

export async function GET() {
  const by = (s: string) => demo.orders.filter((o) => o.status === s).length
  const revenue = demo.orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0)
  return json({
    total_orders: demo.orders.length,
    new_orders: by('new'),
    preparing: by('preparing'),
    ready: by('ready'),
    served: by('served'),
    cancelled: demo.orders.filter((o) => o.status === 'cancelled').length,
    revenue_today: revenue,
  })
}
