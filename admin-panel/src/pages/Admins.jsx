// Page 6 — "Admins": staff admin management, opened from the Manager hub.
// Day|Week|Month metrics toggle (instant per-card recalc), circular "+" (add-admin
// modal), CAPSULE scrollbar per mock, numbered admin cards "1,Name" with
// ✏️ pencil (edit sheet) + ❌ red X (revoke, confirm-guarded).
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

const ROLE_LABELS = { cashier: 'Cashier', kitchen: 'Kitchen', delivery: 'Delivery' }

function Avatar({ name, url }) {
  if (url) return <img className="admin-avatar" src={url} alt="" />
  const initial = String(name || '?').trim().charAt(0).toUpperCase()
  return <div className="admin-avatar admin-avatar-fb">{initial}</div>
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

      {/* Day | Week | Month — metrics period (recalcs every card) */}
      <div className="period-bar">
        <div className="seg seg-days" role="tablist" aria-label="Metrics period">
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
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {admins === null ? (
        <Spinner label="Loading admins…" />
      ) : (
        <VScroll variant="thin">
          <div className="add-row">
            <button className="add-btn" aria-label="Add admin" onClick={() => { haptic('light'); setAdding(true) }}>
              +
            </button>
          </div>

          {admins.length === 0 ? (
            <EmptyState>No staff admins yet — tap + to add one</EmptyState>
          ) : (
            admins.map((a, i) => {
              const suspended = a.active === false
              const stats = a.stats || {}
              const count = stats[metricsPeriod] ?? 0
              return (
                <div className={`card admin-card ${suspended ? 'admin-suspended' : ''}`} key={a.tg_user_id}>
                  <div className="admin-flex">
                    <Avatar name={a.name} url={a.photo_url} />

                    <div className="admin-body">
                      <div className="admin-name">{i + 1},{a.name}</div>
                      <div className="admin-id">
                        ID {a.tg_user_id} · {ROLE_LABELS[a.role] || 'Staff'}
                      </div>
                      <div className="admin-metric-label">#total order done</div>
                      <div className="admin-metric-val">--- {count}</div>
                    </div>

                    <div className="item-ico admin-actions">
                      <button
                        className="ico-btn"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => { haptic('light'); setEditing(a) }}
                      >
                        ✏️
                      </button>
                      <button
                        className="ico-btn"
                        aria-label={`Revoke ${a.name}`}
                        onClick={() => { haptic('warning'); revokeAdmin(a) }}
                      >
                        ❌
                      </button>
                    </div>
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
