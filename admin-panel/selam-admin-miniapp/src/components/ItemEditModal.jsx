// Page 4 edit modal — updates an item's name, Amharic name (name_am), price
// (INTEGER Birr), description, photo and availability state via PATCH
// /api/menu/:id, then the parent refetches the list (RULES: refetch after
// successful PATCH). Save is guarded (no double submit).
// Section 4.3: the manual Photo URL input is REPLACED by a file-picker
// uploader (PhotoUploader) that produces a persistent data URL; unrelated
// fields keep their existing photo unless the admin changes it.
import React, { useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'
import PhotoUploader from './PhotoUploader.jsx'

export default function ItemEditModal({ item, onClose, onSaved, onErr }) {
  const { toast } = useApp()
  const [name, setName] = useState(item.name_en || '')
  const [nameAm, setNameAm] = useState(item.name_am || '')
  const [price, setPrice] = useState(item.price === undefined || item.price === null ? '' : String(item.price))
  const [desc, setDesc] = useState(item.description || '')
  const [img, setImg] = useState(item.image_url || '')
  const [available, setAvailable] = useState(item.available !== false)
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
      await api.patchMenu(item.id, {
        name_en: name.trim(),
        name_am: nameAm.trim(),
        price: p,
        description: desc.trim(),
        image_url: img.trim(),
        available,
      })
      haptic('success')
      toast('Item updated ✓')
      onSaved()
      onClose()
    } catch (e) {
      // 503/network already toasted by the api layer; SessionExpired routed by onErr
      onErr(e)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit item" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit item</h3>

        <div className="f-label">Name</div>
        <input className="f-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />

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
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
