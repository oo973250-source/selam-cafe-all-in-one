// Page 4 — "New item" modal (the circular + button, same pattern as the
// category + on Page 5). Fields mirror ItemEditModal: name (required),
// Amharic name (optional translation → name_am), price (INTEGER Birr),
// optional description + uploaded photo, availability toggle.
// Contract (RULES): POST /api/menu REQUIRES a client-generated unique slug id
// → slugify(name, existingIds). Servers that assign their own ids simply
// ignore/replace it. POST → parent refetches the list (RULES: refetch after
// successful POST). Save is guarded (no double submit).
// Section 4.3: Photo URL input REPLACED by the file-picker uploader.
import React, { useState } from 'react'
import { api, slugify } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'
import PhotoUploader from './PhotoUploader.jsx'

export default function ItemAddModal({ category, existingIds = [], onClose, onSaved, onErr }) {
  const { toast } = useApp()
  const [name, setName] = useState('')
  const [nameAm, setNameAm] = useState('')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [img, setImg] = useState('')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  // Money = INTEGER Birr — strip anything non-digit
  const digits = (v) => v.replace(/[^0-9]/g, '').slice(0, 6)

  async function save() {
    if (saving) return
    if (!name.trim()) {
      haptic('error')
      toast('Item name is required')
      return
    }
    const p = parseInt(price, 10)
    if (price === '' || !Number.isInteger(p) || p < 0) {
      haptic('error')
      toast('Price must be a whole number of Birr')
      return
    }
    setSaving(true)
    try {
      await api.postMenu({
        id: slugify(name, existingIds), // client slug id per contract (server may reassign)
        category: category.id,
        name_en: name.trim(),
        name_am: nameAm.trim(),
        price: p,
        description: desc.trim(),
        image_url: img.trim(),
        available,
      })
      haptic('success')
      toast('Item created ✓')
      onSaved()
      onClose()
    } catch (e) {
      // 503/network already toasted by the api layer; SessionExpired routed by onErr
      onErr(e)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="New item" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">New item</h3>

        <div className="f-label">Category</div>
        <div className="f-section">{category.name_en}</div>

        <div className="f-label">Name</div>
        <input
          className="f-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Doro Wat"
          autoFocus
        />

        <div className="f-label">Name (Amharic)</div>
        <input
          className="f-input"
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          maxLength={60}
          placeholder="ለምሳሌ ዶሮ ወጥ"
        />

        <div className="f-label">Price (Birr)</div>
        <input
          className="f-input"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(digits(e.target.value))}
          placeholder="0"
        />

        <div className="f-label">Description</div>
        <textarea
          className="f-area"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={300}
          placeholder="Optional"
        />

        <div className="f-label">Photo</div>
        <PhotoUploader value={img} onChange={setImg} />

        <div className="f-label">Availability</div>
        <button
          className={`tg ${available ? 'tg-avail on' : 'tg-unavail on'}`}
          aria-pressed={available}
          onClick={() => {
            haptic('select')
            setAvailable((v) => !v)
          }}
        >
          {available ? 'available' : 'unavailable'}
        </button>

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
