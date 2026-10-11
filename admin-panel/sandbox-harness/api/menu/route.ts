// SANDBOX PREVIEW HARNESS — GET/POST /api/menu
import { demo, json, readBody } from '@/lib/demo/data'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const available = url.searchParams.get('available')

  let items = [...demo.menu]
  if (category) items = items.filter((i) => i.category === category)
  if (available === 'true') items = items.filter((i) => i.available)
  if (available === 'false') items = items.filter((i) => !i.available)
  return json({ items })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const { category, name_en, price } = body as Record<string, string | number>
  if (!category || !name_en || price === undefined) {
    return json({ error: 'category, name_en and price are required' }, 400)
  }
  // Client-created items arrive WITHOUT an id — the server assigns one
  // (matches the real backend, which generates ids server-side).
  const id = body.id !== undefined && body.id !== null && String(body.id).length > 0
    ? String(body.id)
    : `mi-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
  if (demo.menu.some((i) => i.id === id)) return json({ error: 'item id already exists' }, 409)

  const item = {
    id,
    category: String(category),
    name_en: String(name_en),
    name_am: body.name_am ? String(body.name_am) : undefined,
    price: Number(price),
    description: body.description ? String(body.description) : undefined,
    image_url: body.image_url ? String(body.image_url) : undefined,
    available: body.available !== undefined ? body.available !== false : true,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : demo.menu.length,
  }
  demo.menu.push(item)
  return json({ item }, 201)
}
