// Section 7 — Report-a-user modal. Select/identify user (preset from an order
// or by Telegram ID / @username lookup), choose a category, describe +
// attach evidence, submit. Reports are ALLEGATIONS stored for review — never
// automatic guilt; blocking stays a separate, confirmed admin action.
import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic, showConfirm } from '../telegram.js'

const CATEGORIES = [
  { key: 'spam', label: 'Spam / junk orders' },
  { key: 'duplicate_orders', label: 'Duplicate orders' },
  { key: 'order_flooding', label: 'Order flooding' },
  { key: 'payment_fraud', label: 'Payment fraud / fake screenshot' },
  { key: 'fake_orders', label: 'Fake or malicious orders' },
  { key: 'restriction_bypass', label: 'Trying to bypass restrictions' },
  { key: 'exploitation', label: 'Exploiting the app' },
  { key: 'harassment', label: 'Harassment / abuse' },
  { key: 'other', label: 'Other (describe below)' },
]

export default function ReportUserModal({ preset = null, onClose }) {
  const { toast, setBoot, admins } = useApp()
  const [q, setQ] = useState(preset?.tg_user_id ? String(preset.tg_user_id) : '')
  const [looking, setLooking] = useState(false)
  const [user, setUser] = useState(
    preset?.tg_user_id
      ? { tg_user_id: preset.tg_user_id, tg_username: preset.tg_username, tg_first_name: preset.tg_first_name }
      : null,
  )
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState('')
  const [saving, setSaving] = useState(false)
  const [lookupErr, setLookupErr] = useState(null)

  async function lookup() {
    const needle = q.trim()
    if (!needle) return
    setLooking(true)
    setLookupErr(null)
    setUser(null)
    try {
      const d = await api.lookupReportUser(needle)
      setUser(d.user)
      haptic('success')
    } catch (e) {
      setLookupErr(e?.data?.error || e?.message || 'Lookup failed')
    } finally {
      setLooking(false)
    }
  }

  async function submit() {
    if (saving) return
    if (!user?.tg_user_id) {
      toast('Find the user first')
      haptic('error')
      return
    }
    if (!category) {
      toast('Choose a report category')
      haptic('error')
      return
    }
    // The ending action — block — is a separate confirmed step, done via the
    // existing permission path, only if the admin explicitly chooses it here.
    const ok = await showConfirm(`Submit report against ${user.tg_first_name || user.tg_username || `#${user.tg_user_id}`}?`)
    if (!ok) return
    setSaving(true)
    try {
      await api.postReport({
        tg_user_id: user.tg_user_id,
        tg_username: user.tg_username,
        tg_first_name: user.tg_first_name,
        category,
        description,
        evidence,
      })
      haptic('success')
      toast('User report submitted ✓')
      onClose()
    } catch (e) {
      if (e && e.kind === 'http' && e.response?.status === 403) setBoot('denied')
      onClose()
    }
  }

  // Keyboard submit for admins
  useEffect(() => {}, [])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Report user" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Report a user</h3>

        <div className="f-label">Telegram ID or @username</div>
        <div className="verify-row">
          <input
            className="f-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="123456 or @username"
            disabled={!!preset?.tg_user_id}
            maxLength={40}
          />
          {!preset?.tg_user_id && (
            <button className="btn btn-gold btn-verify" onClick={lookup} disabled={looking || !q.trim()}>
              {looking ? '…' : 'Find'}
            </button>
          )}
        </div>

        {lookupErr ? <div className="upload-state upload-state-err">{lookupErr}</div> : null}

        {user ? (
          <div className="verify-chip">
            <span className="verify-avatar" aria-hidden="true">
              {String(user.tg_first_name || user.tg_username || '?').charAt(0).toUpperCase()}
            </span>
            <div className="verify-meta">
              <div className="verify-name">{user.tg_first_name || user.tg_username || `#${user.tg_user_id}`}</div>
              <div className="verify-sub">
                ID {user.tg_user_id}
                {user.tg_username ? ` · @${user.tg_username}` : ''}
                {user.is_blocked ? ' · ⛔ already blocked' : ''}
              </div>
              {user.stats ? (
                <div className="verify-sub">
                  {user.stats.total ?? 0} orders · {user.stats.cancelled ?? 0} cancelled
                  {typeof user.stats.active === 'number' ? ` · ${user.stats.active} active now` : ''}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="f-label">Category</div>
        <select className="f-input" value={category} onChange={(e) => { haptic('select'); setCategory(e.target.value) }}>
          <option value="">Choose a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <div className="f-label">Description</div>
        <textarea
          className="f-area"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
          maxLength={1000}
          placeholder="What happened? Include order numbers or times if you have them."
        />

        <div className="f-label">Evidence (optional)</div>
        <textarea
          className="f-area"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value.slice(0, 2000))}
          maxLength={2000}
          placeholder="Links, screenshots references, or anything the reviewer needs."
        />

        <div className="ap-hint">
          Reports are allegations — they never auto-label or block anyone.
          An admin reviews each report and decides separately.
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={saving || !user || !category}>
            {saving ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  )
}
