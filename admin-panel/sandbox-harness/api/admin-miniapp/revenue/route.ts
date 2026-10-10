// SANDBOX PREVIEW HARNESS — GET /api/admin-miniapp/revenue?period=day|week|month
// Page 8 Revenue analytics. ⚠️ INTEGRATION POINT: no such endpoint in the RULES
// contract yet — this stub serves plausible per-period demo numbers so the screen
// is clickable. The real server should compute per period: orders count, SUM(total)
// over completed/paid orders (integer Birr), completed-delivery count.
import { json } from '@/lib/demo/data'

const DEMO_REVENUE: Record<string, { orders: number; revenue: number; delivered: number }> = {
  day: { orders: 47, revenue: 38650, delivered: 19 },
  week: { orders: 312, revenue: 254300, delivered: 128 },
  month: { orders: 1284, revenue: 1048700, delivered: 526 },
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'day'
  const stats = DEMO_REVENUE[period] || DEMO_REVENUE.day
  return json({ period, ...stats })
}
