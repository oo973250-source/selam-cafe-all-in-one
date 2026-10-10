// SANDBOX PREVIEW HARNESS — PATCH/DELETE /api/menu/categories/:id
// DELETE: 409 { error, itemCount } when items exist unless ?force=true (per contract)
import { demo, json, readBody } from '@/lib/demo/data'

const FIELDS = ['name_en', 'name_am', 'icon', 'section', 'hidden', 'sort_order', 'no_delivery'] as const

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cat = demo.categories.find((c) => c.id === id)
  if (!cat) return json({ error: 'category not found' }, 404)

  const body = await readBody(req)
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      ;(cat as unknown as Record<string, unknown>)[f] = body[f]
    }
  }
  return json({ category: cat })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idx = demo.categories.findIndex((c) => c.id === id)
  if (idx === -1) return json({ error: 'category not found' }, 404)

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'
  const itemCount = demo.menu.filter((i) => i.category === id).length

  if (itemCount > 0 && !force) {
    return json({ error: 'category still has items', itemCount }, 409)
  }
  if (force) {
    demo.menu = demo.menu.filter((i) => i.category !== id)
  }
  demo.categories.splice(idx, 1)
  return json({ ok: true, deletedItems: force ? itemCount : 0 })
}
