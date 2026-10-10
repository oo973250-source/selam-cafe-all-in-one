// SANDBOX PREVIEW HARNESS — POST /api/menu/categories/reorder
// body { ids: [...] } = FULL ordered list for ONE section
import { demo, json, readBody } from '@/lib/demo/data'

export async function POST(req: Request) {
  const body = await readBody(req)
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : null
  if (!ids || ids.length === 0) return json({ error: 'ids array is required' }, 400)

  const section = demo.categories.find((c) => c.id === ids[0])?.section
  ids.forEach((id, idx) => {
    const cat = demo.categories.find((c) => c.id === id)
    if (cat && cat.section === section) cat.sort_order = idx
  })
  return json({ ok: true })
}
