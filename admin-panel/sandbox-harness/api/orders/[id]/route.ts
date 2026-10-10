// SANDBOX PREVIEW HARNESS — GET/PATCH /api/orders/:id
import { demo, json, readBody } from '@/lib/demo/data'

const ORDER_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'] as const
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cod'] as const

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = demo.orders.find((o) => o.id === Number(id))
  if (!order) return json({ error: 'order not found' }, 404)
  return json({ order, events: demo.events.get(Number(id)) || [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = demo.orders.find((o) => o.id === Number(id))
  if (!order) return json({ error: 'order not found' }, 404)

  const body = await readBody(req)
  if (typeof body.status === 'string' && (ORDER_STATUSES as readonly string[]).includes(body.status)) {
    if (body.status === 'served' && order.status !== 'served') {
      // Page 1 v5: stamp WHEN the order was finished — done-state cards only stay
      // in the live queue for the rest of the current day (older ones live in history).
      order.served_at = new Date().toISOString()
    }
    order.status = body.status as (typeof ORDER_STATUSES)[number]
  }
  // Page 1 v3: staff/cooker name stamped when an admin taps "start" — persisted on
  // the order so every admin device sees who is taking which order. The real
  // backend should derive this from the authenticated admin (Bearer token) and
  // treat the client-sent value as advisory only.
  if (typeof body.started_by === 'string' && body.started_by.trim()) {
    order.started_by = body.started_by.trim().slice(0, 40)
  }
  // Page 1 v5 two-step completion: "Finished ✅" marks the order served (it STAYS
  // in the queue); the explicit "Done" tap sends dismissed=true which removes it
  // from the live queue. The real backend should persist a dismissed_at timestamp
  // on the order row and keep returning served-until-dismissed orders in GET.
  if (body.dismissed === true) order.dismissed_at = new Date().toISOString()
  else if (body.dismissed === false) order.dismissed_at = null
  if (
    typeof body.payment_status === 'string' &&
    (PAYMENT_STATUSES as readonly string[]).includes(body.payment_status)
  ) {
    order.payment_status = body.payment_status as (typeof PAYMENT_STATUSES)[number]
  }
  order.updated_at = new Date().toISOString()

  const events = demo.events.get(order.id) || []
  events.push({
    id: demo.eventSeq++,
    event: 'status_changed',
    payload: body,
    created_at: new Date().toISOString(),
  })
  demo.events.set(order.id, events)

  return json({ order })
}
