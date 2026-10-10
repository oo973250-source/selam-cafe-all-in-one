// SANDBOX PREVIEW HARNESS — GET/POST /api/admin-miniapp/announcements
// Announcements page: broadcast messages sent to customers. The real server must
// persist these and fan each one out to the customer app / bot channel.
// GET  → { announcements: [...] } (newest first)
// POST { message } → { announcement } (message required, ≤300 chars)
import { demo, json, readBody } from '@/lib/demo/data'

export async function GET() {
  if (!Array.isArray(demo.announcements)) demo.announcements = []
  const announcements = [...demo.announcements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return json({ announcements })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const message = String(body.message || '').trim()
  if (!message) return json({ error: 'message is required' }, 400)
  if (message.length > 300) return json({ error: 'message must be 300 characters or fewer' }, 400)

  const announcement = {
    id: ++demo.annSeq,
    message,
    author: 'Owner', // real backend: authenticated admin's display name
    created_at: new Date().toISOString(),
  }
  demo.announcements.push(announcement)
  return json({ announcement }, 201)
}
