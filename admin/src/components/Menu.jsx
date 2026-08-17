import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const CATEGORIES = ['breakfast', 'hot_drinks', 'drinks', 'snacks']

const EMPTY = {
  id: '',
  category: 'hot_drinks',
  name_en: '',
  name_am: '',
  price: 0,
  description: '',
  image_url: '',
  available: true,
  sort_order: 0,
}

export default function Menu() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | item object
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const r = await api.listMenu()
      setItems(r.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function save() {
    try {
      if (editing.id && items.find((i) => i.id === editing.id && i !== editing)) {
        // Existing item — PATCH
        await api.updateMenuItem(editing.id, editing)
      } else {
        // New item — POST
        await api.createMenuItem(editing)
      }
      setEditing(null)
      refresh()
    } catch (e) {
      alert('Save failed: ' + e.message)
    }
  }

  async function remove(id) {
    if (!confirm(`Delete "${id}"? This cannot be undone.`)) return
    try {
      await api.deleteMenuItem(id)
      refresh()
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <h1>Menu</h1>
      {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

      <button className="primary" onClick={() => setEditing({ ...EMPTY })}>
        + Add new item
      </button>

      <div className="card" style={{ padding: 0, marginTop: 14 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Available</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><code>{i.id}</code></td>
                <td>
                  {i.name_en}
                  {i.name_am && <span style={{ color: '#888' }}> ({i.name_am})</span>}
                </td>
                <td>{i.category}</td>
                <td>{i.price} Br</td>
                <td>{i.available ? '✅' : '❌'}</td>
                <td>{i.sort_order}</td>
                <td>
                  <button onClick={() => setEditing({ ...i })}>Edit</button>{' '}
                  <button className="danger" onClick={() => remove(i.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card" style={{ position: 'sticky', bottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>{items.find((i) => i.id === editing.id) ? 'Edit' : 'New'} item</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              ID (slug)
              <input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} disabled={items.find((i) => i.id === editing.id)} />
            </label>
            <label>
              Category
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Name (English)
              <input value={editing.name_en} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} />
            </label>
            <label>
              Name (Amharic)
              <input value={editing.name_am || ''} onChange={(e) => setEditing({ ...editing, name_am: e.target.value })} />
            </label>
            <label>
              Price (Br)
              <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
            </label>
            <label>
              Sort order
              <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Description
              <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Image URL
              <input value={editing.image_url || ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://…" />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={editing.available}
                onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                style={{ width: 'auto' }}
              />
              Available
            </label>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="primary" onClick={save}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
