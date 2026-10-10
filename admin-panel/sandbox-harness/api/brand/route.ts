// SANDBOX PREVIEW HARNESS — GET /api/brand (PUBLIC — no auth)
// Cafe identity for every OTHER surface: the customer miniapp, the bot's message
// templates, receipts, share texts. The admin Profile page is the CONTROLLER:
// PATCH /api/admin-miniapp/profile updates this same record, so a name change
// there propagates EVERYWHERE the cafe name is mentioned. Consumers should call
// this on boot and re-read when the backend broadcasts `brand:update`.
// ⚠️ INTEGRATION POINT: in the real backend, back this with the same DB row the
// profile endpoint uses (single source of truth) — do NOT copy the name.
import { demo, json } from '@/lib/demo/data'

export async function GET() {
  // Defensive default for a stale dev-server singleton (pre-Page-9 demo object).
  if (!demo.profile) {
    demo.profile = {
      cafe_name: 'UniCafe',
      phone: '',
      location: '',
      logo_url: '',
      hours_open: '08:00',
      hours_close: '22:00',
      description: '',
      updated_at: null,
    }
  }
  const p = demo.profile
  return json({ name: p.cafe_name, logo_url: p.logo_url, updated_at: p.updated_at || null })
}
