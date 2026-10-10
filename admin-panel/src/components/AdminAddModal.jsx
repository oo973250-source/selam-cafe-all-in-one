// Page 6 — "Add admin" modal (the circular + button). Per user spec:
// 1. Telegram User ID (or @username)  2. Role chips (Cashier/Kitchen/Delivery)
// 3. Assigned shift / branch. Instant verification shows the Telegram photo +
// name before granting (Bot-API lookup = INTEGRATION POINT; the sandbox harness
// resolves a demo profile). POST → parent refetches.
import React, { useState } from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const ROLES = [
  { key: 'cashier', label: 'Cashier' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'delivery', label: 'Delivery' },
]

const SHIFTS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'night', label: 'Night' },
]

// Sensible RBAC defaults per role (editable later in the edit sheet)
const DEFAULT_PERMS = {
  cashier: ['orders', 'refunds'],
  kitchen: ['orders'],
  delivery: ['orders'],
}

export default function AdminAddModal({ onClose, onErr }) {
  const { toast, verifyAdmin, addAdmin } = useApp()
  const [idInput, setIdInput] = useState('')
  const [profile, setProfile] = useState(null) // verified Telegram profile
  const [verifying, setVerifying] = useState(false)
  const [role, setRole] = useState('cashier')
  const [shift, setShift] = useState('morning')
  const [branch, setBranch] = useState('Main')
  const [saving, setSaving] = useState(false)

  async function verify() {
    if (verifying) return
    const v = idInput.trim()
    if (!v) {
      haptic('error')
      toast('Enter a Telegram User ID or @username first')
      return
    }
    setVerifying(true)
    setProfile(null)
    try {
      const p = await verifyAdmin(v)
      setProfile(p)
      haptic('success')
    } catch (e) {
      // not-found / network already toasted by the api layer
      onErr(e)
    } finally {
      setVerifying(false)
    }
  }

  async function grant() {
    if (saving) return
    if (!profile) {
      haptic('error')
      toast('Verify the Telegram ID first')
      return
    }
    setSaving(true)
    try {
      await addAdmin({
        tg_user_id: profile.tg_user_id,
        username: profile.username || null,
        name: profile.name,
        photo_url: profile.photo_url || null,
        role,
        permissions: DEFAULT_PERMS[role] || ['orders'],
        shift,
        branch: branch.trim() || 'Main',
      })
      haptic('success')
      toast('Admin access granted ✓')
      onClose()
    } catch (e) {
      onErr(e)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add admin" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add admin</h3>

        <div className="f-label">Telegram User ID or @username</div>
        <div className="verify-row">
          <input
            className="f-input"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="e.g. 556677 or @abebe_b"
            autoCapitalize="none"
            maxLength={40}
          />
          <button className="btn btn-verify" onClick={verify} disabled={verifying}>
            {verifying ? '…' : 'Verify'}
          </button>
        </div>

        {profile && (
          <div className="verify-chip">
            {profile.photo_url ? (
              <img className="verify-avatar" src={profile.photo_url} alt="" />
            ) : (
              <div className="verify-avatar">{String(profile.name || '?').charAt(0).toUpperCase()}</div>
            )}
            <div className="verify-meta">
              <div className="verify-name">{profile.name}</div>
              <div className="verify-sub">{profile.username ? `@${profile.username}` : `ID ${profile.tg_user_id}`}</div>
            </div>
            <div className="verify-ok">Verified ✓</div>
          </div>
        )}

        <div className="f-label">Role</div>
        <div className="chip-row">
          {ROLES.map((r) => (
            <button
              key={r.key}
              className={`chip ${role === r.key ? 'on' : ''}`}
              aria-pressed={role === r.key}
              onClick={() => { haptic('select'); setRole(r.key) }}
            >
              {r.label}
            </button>
          ))}
        </div>

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

        <div className="f-label">Branch</div>
        <input className="f-input" value={branch} onChange={(e) => setBranch(e.target.value)} maxLength={40} />

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-gold" onClick={grant} disabled={saving || !profile}>
            {saving ? 'Granting…' : 'Grant access'}
          </button>
        </div>
      </div>
    </div>
  )
}
