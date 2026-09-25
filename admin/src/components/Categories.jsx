import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

/**
 * Categories (Task 2)
 * -------------------
 * Two INDEPENDENT top-level sections — Food and Drink. Every action operates
 * on exactly one category inside one section:
 *   • add (within a section)
 *   • rename
 *   • hide / show (without deleting its items)
 *   • reorder (up/down, within its own section only)
 *   • delete (safeguard: refused while the category still has items)
 *
 * Reorder persists via POST /api/menu/categories/reorder { section, ids } —
 * a food reorder can never touch drink ordering.
 */
export default function Categories() {
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState(null) // { id, name_en, name_am, icon }
  const [adding, setAdding] = useState(null) // 'food' | 'drink'
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🍽️')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const [c, m] = await Promise.all([api.listCategories(), api.listMenu()])
      setCats(c.categories || [])
      setItems(m.items || [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const itemCount = (catId) => items.filter((i) => i.category === catId).length

  async function toggleHidden(cat) {
    setBusy(true)
    try {
      await api.updateCategory(cat.id, { hidden: !cat.hidden })
      await refresh()
    } catch (e) { alert('Failed: ' + e.message) } finally { setBusy(false) }
  }

  async function move(cat, dir) {
    const section = cat.section || 'food'
    const sibs = cats
      .filter((c) => (c.section || 'food') === section)
      .sort((a, b) => a.sort_order - b.sort_order)
    const ids = sibs.map((c) => c.id)
    const i = ids.indexOf(cat.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setBusy(true)
    try {
      await api.reorderCategories(section, ids)
      await refresh()
    } catch (e) { alert('Failed: ' + e.message) } finally { setBusy(false) }
  }

  async function remove(cat) {
    const n = itemCount(cat.id)
    if (n > 0) {
      // Safeguard mirrors the server (409) — nothing is deleted while items exist.
      const force = confirm(
        `"${cat.name_en}" still has ${n} item(s). ` +
        `Delete the category AND all of its items? (Cancel = keep both.)`
      )
      if (!force) return
      if (!confirm('FINAL CONFIRMATION: this permanently deletes the category and its items.')) return
      setBusy(true)
      try { await api.deleteCategory(cat.id, true); await refresh() }
      catch (e) { alert('Delete failed: ' + e.message) } finally { setBusy(false) }
      return
    }
    if (!confirm(`Delete empty category "${cat.name_en}"?`)) return
    setBusy(true)
    try { await api.deleteCategory(cat.id); await refresh() }
    catch (e) { alert('Delete failed: ' + e.message) } finally { setBusy(false) }
  }

  async function saveRename(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateCategory(renaming.id, {
        name_en: renaming.name_en,
        name_am: renaming.name_am || null,
        icon: renaming.icon || '🍽️',
      })
      setRenaming(null)
      await refresh()
    } catch (e) { alert('Save failed: ' + e.message) } finally { setBusy(false) }
  }

  async function addCategory(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.createCategory({ name_en: newName, icon: newIcon || '🍽️', section: adding })
      setAdding(null)
      setNewName('')
      setNewIcon('🍽️')
      await refresh()
    } catch (e) { alert('Create failed: ' + e.message) } finally { setBusy(false) }
  }

  if (loading) return <div>Loading…</div>

  const renderSection = (key, label, icon) => {
    const list = cats
      .filter((c) => (c.section || 'food') === key)
      .sort((a, b) => a.sort_order - b.sort_order)
    return (
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{icon} {label}</h2>
          <span style={{ fontSize: 12, color: '#888' }}>{list.length} categories</span>
          <span style={{ flex: 1 }} />
          <button className="primary" onClick={() => setAdding(key)} disabled={busy}>
            + Add category
          </button>
        </div>

        {list.length === 0 && <p style={{ color: '#888' }}>No categories yet.</p>}

        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Category</th>
              <th>Amharic</th>
              <th>Items</th>
              <th>Visibility</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} style={{ opacity: c.hidden ? 0.55 : 1 }}>
                <td>{c.sort_order}</td>
                <td>
                  <strong>{c.icon} {c.name_en}</strong>
                  <div style={{ fontSize: 11, color: '#888' }}><code>{c.id}</code></div>
                </td>
                <td>{c.name_am || '—'}</td>
                <td>{itemCount(c.id)}</td>
                <td>
                  <span className={`pill ${c.hidden ? 'cancelled' : 'served'}`}>
                    {c.hidden ? '🚫 hidden' : '✅ visible'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => setRenaming({ ...c })}>Rename</button>{' '}
                  <button onClick={() => toggleHidden(c)} disabled={busy}>
                    {c.hidden ? 'Show' : 'Hide'}
                  </button>{' '}
                  <button onClick={() => move(c, -1)} disabled={busy}>↑</button>{' '}
                  <button onClick={() => move(c, 1)} disabled={busy}>↓</button>{' '}
                  <button className="danger" onClick={() => remove(c)} disabled={busy}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {adding === key && (
          <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input
              style={{ width: 60, textAlign: 'center' }}
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="🍽️"
              maxLength={4}
            />
            <input
              style={{ flex: 1 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`New ${label.toLowerCase()} category name (English)`}
              autoFocus
              required
            />
            <button className="primary" type="submit" disabled={busy || !newName.trim()}>Create</button>
            <button type="button" onClick={() => setAdding(null)}>Cancel</button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1>Categories</h1>
      {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

      <p style={{ color: '#888', marginTop: 0 }}>
        Food and Drink are independent: renaming, hiding or reordering a food
        category never changes drink categories, and vice versa. Hidden
        categories keep their items and just disappear from the customer Mini App.
      </p>

      {renderSection('food', 'Food', '🍲')}
      {renderSection('drink', 'Drink', '🥤')}

      {renaming && (
        <div className="card" style={{ position: 'sticky', bottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Rename category</h2>
          <form onSubmit={saveRename} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              Icon
              <input
                value={renaming.icon || ''}
                onChange={(e) => setRenaming({ ...renaming, icon: e.target.value })}
                maxLength={4}
              />
            </label>
            <label>
              Name (English)
              <input
                value={renaming.name_en}
                onChange={(e) => setRenaming({ ...renaming, name_en: e.target.value })}
                required
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Name (Amharic)
              <input
                value={renaming.name_am || ''}
                onChange={(e) => setRenaming({ ...renaming, name_am: e.target.value })}
              />
            </label>
          </form>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="primary" onClick={saveRename} disabled={busy}>Save</button>
            <button onClick={() => setRenaming(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
