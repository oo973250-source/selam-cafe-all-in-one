/**
 * server/routes/menu.js
 * ---------------------
 * Menu + category CRUD. Public GETs (the Mini App reads these live, so admin
 * edits appear without a redeploy). All writes require manager+.
 *
 * Categories are split into two independent sections: 'food' and 'drink'
 * (Task 2). Every category belongs to exactly one section; editing a food
 * category never touches drink categories. Reordering is per-section and
 * atomic (single transaction, contiguous 1..N).
 */

import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// Public — categories for the Mini App (includes section/hidden so the app
// can group Food vs Drink and hide disabled categories).
router.get('/categories', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name_en, name_am, icon, section, hidden, sort_order
         FROM menu_categories
        ORDER BY section, sort_order, name_en`
    )
    res.json({ categories: rows })
  } catch (e) {
    console.error('[menu] categories list failed:', e.message)
    res.status(503).json({ error: 'menu unavailable', categories: [] })
  }
})

// Public — used by the customer-facing Mini App to load the menu
router.get('/', async (req, res) => {
  const { category, available } = req.query
  const where = []
  const params = []
  if (category) { params.push(category); where.push(`category = $${params.length}`) }
  if (available !== undefined) { params.push(available === 'true'); where.push(`available = $${params.length}`) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const { rows } = await pool.query(
      `SELECT * FROM menu_items ${whereClause} ORDER BY category, sort_order, name_en`,
      params
    )
    res.json({ items: rows })
  } catch (e) {
    console.error('[menu] list failed:', e.message)
    res.status(503).json({ error: 'menu unavailable', items: [] })
  }
})

// ── Category writes (auth required) ─────────────────────────────────────

// Create a category. Body: { id?, name_en, name_am?, icon?, section, sort_order? }
router.post('/categories', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const { id, name_en, name_am, icon, section = 'food', sort_order } = req.body || {}
  if (!name_en || !['food', 'drink'].includes(section)) {
    return res.status(400).json({ error: 'name_en and section (food|drink) required' })
  }
  const slug = (id || name_en)
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
    || `cat_${Date.now()}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO menu_categories (id, name_en, name_am, icon, section, sort_order)
       VALUES ($1, $2, $3, $4, $5,
         COALESCE($6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM menu_categories WHERE section = $5)))
       ON CONFLICT (id) DO UPDATE SET
         name_en = EXCLUDED.name_en, name_am = EXCLUDED.name_am,
         icon = EXCLUDED.icon, section = EXCLUDED.section
       RETURNING *`,
      [slug, name_en, name_am || null, icon || '🍽️', section, sort_order != null ? Number(sort_order) : null]
    )
    res.status(201).json({ category: rows[0] })
  } catch (e) {
    console.error('[menu] category create failed:', e.message)
    res.status(503).json({ error: 'could not create category' })
  }
})

// Update a category: rename / re-icon / move section / hide / explicit order.
// Body: any of { name_en, name_am, icon, section, hidden, sort_order }
router.patch('/categories/:id', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const id = req.params.id
  const fields = ['name_en', 'name_am', 'icon', 'section', 'hidden', 'sort_order']
  const sets = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(f === 'hidden' ? Boolean(req.body[f]) : req.body[f])
      sets.push(`${f} = $${params.length}`)
    }
  }
  if (req.body.section !== undefined && !['food', 'drink'].includes(req.body.section)) {
    return res.status(400).json({ error: 'section must be food or drink' })
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  params.push(id)

  try {
    const { rows } = await pool.query(
      `UPDATE menu_categories SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    res.json({ category: rows[0] })
  } catch (e) {
    console.error('[menu] category update failed:', e.message)
    res.status(503).json({ error: 'could not update category' })
  }
})

// Reorder categories WITHIN one section. Body: { ids: ['a','b',...] } — the
// full ordered list for that section; positions are rewritten 1..N inside a
// transaction so a food reorder can never disturb drink ordering.
router.post('/categories/reorder', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE menu_categories SET sort_order = $1 WHERE id = $2`,
        [i + 1, String(ids[i])]
      )
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[menu] category reorder failed:', e.message)
    res.status(503).json({ error: 'could not reorder categories' })
  } finally {
    client.release()
  }
})

// Delete a category — SAFEGUARD (Task 2): refuse while items still reference
// it. ?force=true deletes the items too.
router.delete('/categories/:id', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const id = req.params.id
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM menu_items WHERE category = $1`, [id]
    )
    const itemCount = rows[0]?.n || 0
    if (itemCount > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        error: `category still has ${itemCount} item(s). Move or delete them first, or retry with ?force=true.`,
        itemCount,
      })
    }
    await pool.query(`DELETE FROM menu_categories WHERE id = $1`, [id])
    if (req.query.force === 'true') {
      await pool.query(`DELETE FROM menu_items WHERE category = $1`, [id])
    }
    res.json({ ok: true, deletedItems: req.query.force === 'true' ? itemCount : 0 })
  } catch (e) {
    console.error('[menu] category delete failed:', e.message)
    res.status(503).json({ error: 'could not delete category' })
  }
})

// ── Item writes (auth required) ─────────────────────────────────────────

router.post('/', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const { id, category, name_en, name_am, price, description, image_url, sort_order = 0 } = req.body || {}
  if (!id || !category || !name_en || price == null) {
    return res.status(400).json({ error: 'id, category, name_en, price required' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO menu_items (id, category, name_en, name_am, price, description, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, category, name_en, name_am || null, Number(price), description || null, image_url || null, Number(sort_order)]
    )
    res.status(201).json({ item: rows[0] })
  } catch (e) {
    console.error('[menu] create failed:', e.message)
    res.status(503).json({ error: 'could not create item' })
  }
})

router.patch('/:id', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  const id = req.params.id
  const fields = ['category', 'name_en', 'name_am', 'price', 'description', 'image_url', 'available', 'sort_order']
  const sets = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f])
      sets.push(`${f} = $${params.length}`)
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  sets.push(`updated_at = now()`)
  params.push(id)

  try {
    const { rows } = await pool.query(
      `UPDATE menu_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    res.json({ item: rows[0] })
  } catch (e) {
    console.error('[menu] update failed:', e.message)
    res.status(503).json({ error: 'could not update item' })
  }
})

router.delete('/:id', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM menu_items WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    console.error('[menu] delete failed:', e.message)
    res.status(503).json({ error: 'could not delete item' })
  }
})

export default router
