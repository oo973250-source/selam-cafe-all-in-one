// Page 6 — "Admins": staff admin management rebuilt per reference image 4.
// Gold left-rail cards, avatar tile with the initial, name + Telegram ID,
// "#total order done — N" for the selected period (Day | Week | Month),
// compact round edit ✏️ and delete ✖️ buttons, and a compact gold circular
// add button. All values come from the real staff_admins table.
import React, { useCallback, useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import AdminAddModal from '../components/AdminAddModal.jsx'
import AdminEditModal from '../components/AdminEditModal.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { SessionExpired } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const PERIODS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

function CalIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 2.8v3.4M16 2.8v3.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 13h2.5M13.5 13H16M8 16.5h2.5M13.5 16.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Avatar({ name, url }) {
  if (url) {
    return (
      <span className="avatar-initial" aria-hidden="true">
        <img src={url} alt="" draggable={false} onError={(e) => { e.currentTarget.parentNode.textContent = String(name || '?').trim().charAt(0).toUpperCase() || '?' }} />
      </span>
    )
  }
  const initial = String(name || '?').trim().charAt(0).toUpperCase()
  return <span className="avatar-initial" aria-hidden="true">{initial}</span>
}

export default function Admins() {
  const { admins, metricsPeriod, setMetricsPeriod, reloadAdmins, revokeAdmin, setBoot } = useApp()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // admin object

  const onErr = useCallback(
    (e) => {
      if (e instanceof SessionExpired) setBoot('expired')
    },
    [setBoot],
  )

  useEffect(() => {
    if (!Array.isArray(admins)) reloadAdmins()
  }, [admins, reloadAdmins])

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Admins" />

      <div className="hr" />

      {/* Day | Week | Month — metrics period (recalcs every card), gold-style */}
      <div className="seg-days-gold" role="tablist" aria-label="Metrics period">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={metricsPeriod === p.key}
            className={metricsPeriod === p.key ? 'active' : ''}
            onClick={() => {
              if (metricsPeriod === p.key) return
              haptic('select')
              setMetricsPeriod(p.key)
            }}
          >
            <CalIcon />
            {p.label}
          </button>
        ))}
      </div>

      {admins === null ? (
        <Spinner label="Loading admins…" />
      ) : (
        <VScroll variant="thin">
          <div className="add-row">
            <button className="add-btn-gold" aria-label="Add admin" onClick={() => { haptic('light'); setAdding(true) }}>
              +
            </button>
          </div>

          {admins.length === 0 ? (
            <EmptyState>No staff admins yet — tap + to add one</EmptyState>
          ) : (
            admins.map((a) => {
              const suspended = a.active === false
              const stats = a.stats || {}
              const count = stats[metricsPeriod] ?? 0
              return (
                <div className={`admin-card-gold ${suspended ? 'admin-suspended' : ''}`} key={a.tg_user_id}>
                  <Avatar name={a.name} url={a.photo_url} />

                  <div className="admin-body">
                    <div className="admin-name">{a.name || a.username || 'Admin'}</div>
                    <div className="admin-id">ID {a.tg_user_id}</div>
                    <div className="admin-metric-label">#total order done</div>
                    <div className="admin-metric-val">— {count}</div>
                  </div>

                  <div className="admin-actions-ico">
                    <button
                      className="round-ico-btn"
                      aria-label={`Edit ${a.name}`}
                      onClick={() => { haptic('light'); setEditing(a) }}
                    >
                      ✏️
                    </button>
                    <button
                      className="round-ico-btn round-ico-btn-danger"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => { haptic('warning'); revokeAdmin(a) }}
                    >
                      ✖️
                    </button>
                  </div>

                  {suspended && <div className="item-unflag admin-unflag">suspended</div>}
                </div>
              )
            })
          )}
        </VScroll>
      )}

      {adding && <AdminAddModal onClose={() => setAdding(false)} onErr={onErr} />}
      {editing && <AdminEditModal admin={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
