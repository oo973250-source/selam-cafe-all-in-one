// SANDBOX PREVIEW HARNESS — GET/POST /api/menu/categories
// POST with an existing id upserts/renames (per contract).
import { demo, json, readBody } from '@/lib/demo/data'

export async function GET() {
  return json({ categories: demo.categories })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const name_en = body.name_en ? String(body.name_en) : undefined
  const section = body.section ? String(body.section) : undefined
  if (!name_en) return json({ error: 'name_en is required' }, 400)
  if (section !== 'food' && section !== 'drink') {
    return json({ error: "section is required ('food' | 'drink')" }, 400)
  }

  const id = body.id ? String(body.id) : name_en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const existing = demo.categories.find((c) => c.id === id)
  if (existing) {
    existing.name_en = name_en
    if (body.name_am) existing.name_am = String(body.name_am)
    if (body.icon) existing.icon = String(body.icon)
    if (typeof body.sort_order === 'number') existing.sort_order = body.sort_order
    return json({ category: existing }, 201)
  }

  const category = {
    id,
    name_en,
    name_am: body.name_am ? String(body.name_am) : undefined,
    icon: body.icon ? String(body.icon) : undefined,
    section: section as 'food' | 'drink',
    hidden: false,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : demo.categories.length,
    no_delivery: false,
  }
  demo.categories.push(category)
  return json({ category }, 201)
}
