// Page 5 — "New category" modal (the circular "+" button).
// Name (required) + section = active Foods/Drinks toggle (shown as a static
// pill). POST /api/menu/categories { name_en, section } → parent refetches.
import React, { useState } from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

export default function CategoryAddModal({ section, onClose, onErr }) {
  const { toast, addCategory } = useApp()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving) return
    if (!name.trim()) {
      haptic('error')
      toast('Category name is required')
      return
    }
    setSaving(true)
    try {
      await addCategory(name, section)
      haptic('success')
      toast('Category created ✓')
      onClose()
    } catch (e) {
      // 503/network already toasted by the api layer; SessionExpired routed by onErr
      onErr(e)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="New category" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">New category</h3>

        <div className="f-label">Section</div>
        <div className="f-section">{section === 'food' ? 'Foods' : 'Drinks'}</div>

        <div className="f-label">Name</div>
        <input
          className="f-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Vegetarian"
          autoFocus
        />

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-gold" onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
