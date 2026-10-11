// Page 5 — "Edit category" overlay (bottom sheet), opened from a category pill.
// Rename (PATCH { name_en, name_am }), reorder (position stepper → POST /reorder
// with the full ordered id list for the section) and delete (confirm → 409
// { itemCount } → confirm → DELETE ?force=true) — all flows live in store.jsx.
import React, { useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

export default function CategoryEditModal({ cat, onClose, onErr }) {
  const { toast, categories, renameCategory, moveCategory, removeCategory } = useApp()
  const [name, setName] = useState(cat.name_en || '')
  const [nameAm, setNameAm] = useState(cat.name_am || '')
  const [saving, setSaving] = useState(false) // rename in flight
  const [busy, setBusy] = useState(false) // reorder/delete in flight

  // live position within the section (recomputes after each optimistic move)
  const sec = useMemo(
    () =>
      Array.isArray(categories)
        ? categories
            .filter((c) => c.section === cat.section)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        : [],
    [categories, cat.section],
  )
  const pos = sec.findIndex((c) => c.id === cat.id) + 1
  const total = sec.length

  async function save() {
    if (saving || busy) return
    if (!name.trim()) {
      haptic('error')
      toast('Category name is required')
      return
    }
    setSaving(true)
    try {
      const ok = await renameCategory(cat, name, nameAm)
      if (ok) {
        haptic('success')
        toast('Category renamed ✓')
        onClose()
        return
      }
      setSaving(false)
    } catch (e) {
      onErr(e)
      setSaving(false)
    }
  }

  async function move(dir) {
    if (busy || saving) return
    setBusy(true)
    try {
      await moveCategory(cat, dir)
    } catch (e) {
      onErr(e)
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (busy || saving) return
    setBusy(true)
    try {
      const done = await removeCategory(cat)
      if (done) onClose()
    } catch (e) {
      onErr(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit category" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit category</h3>

        <div className="f-label">Name</div>
        <input className="f-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />

        <div className="f-label">Name (Amharic)</div>
        <input
          className="f-input"
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          maxLength={40}
          placeholder="ለምሳሌ አትክልት"
        />

        <div className="f-label">Position</div>
        <div className="pos-row">
          <button
            className="pos-btn"
            aria-label="Move up"
            disabled={busy || saving || pos <= 1}
            onClick={() => {
              haptic('light')
              move(-1)
            }}
          >
            ▲
          </button>
          <span className="pos-val">
            {pos > 0 ? pos : '–'} / {total}
          </span>
          <button
            className="pos-btn"
            aria-label="Move down"
            disabled={busy || saving || pos >= total}
            onClick={() => {
              haptic('light')
              move(1)
            }}
          >
            ▼
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn btn-gold" onClick={save} disabled={saving || busy}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
          <button className="btn btn-danger" onClick={del} disabled={saving || busy}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
