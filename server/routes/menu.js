/**
 * server/routes/menu.js
 * ---------------------
 * Menu CRUD. Public GET (anyone can read menu). Writes require manager+.
 */

import { Router } from 'express'
import { pool } from '../db.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()

// Public — used by the customer-facing Mini App to load the menu
router.get('/', async (req, res) => {
  const { category, available } = req.query
  const where = []
  const params = []
  if (category) { params.push(category); where.push(`category = $${params.length}`) }
  if (available !== undefined) { params.push(available === 'true'); where.push(`available = $${params.length}`) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await pool.query(
    `SELECT * FROM menu_items ${whereClause} ORDER BY category, sort_order, name_en`,
    params
  )
  res.json({ items: rows })
})

router.post('/', requireRole('manager', 'owner'), async (req, res) => {
  const { id, category, name_en, name_am, price, description, image_url, sort_order = 0 } = req.body || {}
  if (!id || !category || !name_en || price == null) {
    return res.status(400).json({ error: 'id, category, name_en, price required' })
  }
  const { rows } = await pool.query(
    `INSERT INTO menu_items (id, category, name_en, name_am, price, description, image_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, category, name_en, name_am || null, Number(price), description || null, image_url || null, Number(sort_order)]
  )
  res.status(201).json({ item: rows[0] })
})

router.patch('/:id', requireRole('manager', 'owner'), async (req, res) => {
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

  const { rows } = await pool.query(
    `UPDATE menu_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json({ item: rows[0] })
})

router.delete('/:id', requireRole('manager', 'owner'), async (req, res) => {
  await pool.query(`DELETE FROM menu_items WHERE id = $1`, [req.params.id])
  res.json({ ok: true })
})

export default router
