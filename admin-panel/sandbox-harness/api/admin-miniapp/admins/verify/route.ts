// SANDBOX PREVIEW HARNESS — GET /api/admin-miniapp/admins/verify?id=
// Page 6 "Instant verification" stand-in: the real flow needs a Telegram Bot API
// lookup server-side (INTEGRATION POINT). Here we resolve a demo profile.
import { json, demoVerifyProfile } from '@/lib/demo/data'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id || !id.trim()) return json({ error: 'id query parameter is required' }, 400)
  return json({ profile: demoVerifyProfile(id) })
}
