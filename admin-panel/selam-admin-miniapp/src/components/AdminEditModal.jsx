// Page 6 — edit sheet (pencil). Per user spec: RBAC permissions, Active
// ON/OFF toggle (suspend WITHOUT deleting), shift assignment + refund limit.
// Revision (user): role classifiers (Cashier/Kitchen/Delivery) removed —
// the sheet no longer offers role selection; permissions remain editable.
// PATCH → store refetches (optimistic on, revert on failure). No double submit.
import React, { useState } from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const PERMS = [
  { key: 'orders', label: 'Orders' },
  { key: 'menu', label: 'Menu' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'pause', label: 'Pause' },
]

const SHIFTS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'night', label: 'Night' },
]

export default function AdminEditModal({ admin, onClose }) {
  const { toast, updateAdmin } = useApp()
  const [perms, setPerms] = useState(Array.isArray(admin.permissions) ? admin.permissions : ['orders'])
  const [active, setActive] = useState(admin.active !== false)
  const [shift, setShift] = useState(admin.shift || 'morning')
  const [refund, setRefund] = useState(String(admin.refund_limit ?? 0))
  const [saving, setSaving] = useState(false)

  // Money = INTEGER Birr — strip anything non-digit
  const digits = (v) => v.replace(/[^0-9]/g, '').slice(0, 6)

  const togglePerm = (key) => {
    haptic('select')
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))
  }

  async function save() {
    if (saving) return
    const rl = parseInt(refund, 10)
    if (refund === '' || !Number.isInteger(rl) || rl < 0) {
      haptic('error')
      toast('Refund limit must be a whole number of Birr')
      return
    }
    setSaving(true)
    const ok = await updateAdmin(admin, {
      permissions: perms,
      active,
      shift,
      refund_limit: rl,
    })
    if (ok) {
      haptic('success')
      toast(active ? 'Admin updated ✓' : 'Admin suspended')
      onClose()
    } else {
      // failure path already refetched + toasted by the api/store layer
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit admin" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit admin</h3>

        <div className="verify-chip">
          {admin.photo_url ? (
            <img className="verify-avatar" src={admin.photo_url} alt="" />
          ) : (
            <div className="verify-avatar">{String(admin.name || '?').charAt(0).toUpperCase()}</div>
          )}
          <div className="verify-meta">
            <div className="verify-name">{admin.name}</div>
            <div className="verify-sub">
              {admin.username ? `@${admin.username} · ` : ''}ID {admin.tg_user_id}
            </div>
          </div>
        </div>

        <div className="f-label">Permissions</div>
        <div className="chip-row">
          {PERMS.map((p) => (
            <button
              key={p.key}
              className={`chip ${perms.includes(p.key) ? 'on' : ''}`}
              aria-pressed={perms.includes(p.key)}
              onClick={() => togglePerm(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="f-label">Status</div>
        <button
          className={`tg ${active ? 'tg-avail on' : 'tg-unavail on'}`}
          aria-pressed={active}
          onClick={() => {
            haptic('select')
            setActive((v) => !v)
          }}
        >
          {active ? 'active' : 'suspended'}
        </button>

        <div className="f-label">Assigned shift</div>
        <div className="chip-row">
          {SHIFTS.map((s) => (
            <button
              key={s.key}
              className={`chip ${shift === s.key ? 'on' : ''}`}
              aria-pressed={shift === s.key}
              onClick={() => { haptic('select'); setShift(s.key) }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="f-label">Refund limit (Birr)</div>
        <input
          className="f-input"
          inputMode="numeric"
          value={refund}
          onChange={(e) => setRefund(digits(e.target.value))}
          placeholder="0"
        />

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
