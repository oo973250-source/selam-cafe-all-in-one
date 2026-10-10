// SANDBOX PREVIEW HARNESS — PATCH/DELETE /api/menu/:id
import { demo, json, readBody } from '@/lib/demo/data'

const FIELDS = ['category', 'name_en', 'name_am', 'price', 'description', 'image_url', 'available', 'sort_order'] as const

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = demo.menu.find((i) => i.id === id)
  if (!item) return json({ error: 'item not found' }, 404)

  const body = await readBody(req)
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      ;(item as unknown as Record<string, unknown>)[f] = body[f]
    }
  }
  return json({ item })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idx = demo.menu.findIndex((i) => i.id === id)
  if (idx === -1) return json({ error: 'item not found' }, 404)
  demo.menu.splice(idx, 1)
  return json({ ok: true })
}
