// Order History — opened from the list icon in the Orders root header (top-right).
// Shows the orders from TODAY and YESTERDAY only (user spec), every status —
// served and cancelled included (that's the point of history).
// v2: rows are TAPPABLE → the shared order-details sheet opens with the
// customer's info (name / phone / telegram, service, items, total). And the
// page now scrolls inside the app-standard VScroll — the old version rendered
// straight into a clipped .page-scroll container, so YESTERDAY could never be
// reached on-device (user report). Data = GET /api/orders?limit=100 (same
// contract endpoint the active queue uses; day grouping is client-side).
import React, { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { SERVICE_LABELS, useApp } from '../store.jsx'
import { api } from '../api.js'

const STATUS_LABEL = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

function itemsSummary(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const lines = items.map((it) => `${it.qty ?? 1} x ${it.name}`)
  if (!lines.length) return '—'
  return lines.join(' · ')
}

// Local-calendar-day grouping (not UTC) — a 23:59 order belongs to "today"
// even if UTC says tomorrow.
function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function HistRow({ order, onOpen }) {
  return (
    <div
      className="hist-row"
      role="button"
      tabIndex={0}
      aria-label={`Order ${order.id} details`}
      onClick={() => onOpen(order)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(order)
        }
      }}
    >
      <div className="hist-row-top">
        <span className="hist-id">#{order.id}</span>
        <span className="hist-time">{fmtTime(order.created_at)}</span>
        <span className={`hist-status s-${order.status}`}>{STATUS_LABEL[order.status] || order.status}</span>
      </div>
      <div className="hist-items">{itemsSummary(order)}</div>
      <div className="hist-meta">
        <span>{SERVICE_LABELS[order.service_type] || order.service_type}</span>
        <span className="hist-total">
          {typeof order.total === 'number' ? `${order.total.toLocaleString('en-US')} ETB` : ''}
        </span>
        <span className="hist-chev" aria-hidden="true">›</span>
      </div>
    </div>
  )
}

export default function History() {
  const { showOrderDetails } = useApp()
  const [orders, setOrders] = useState(null) // null = loading
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const d = await api.getOrders({ limit: 100 })
        if (!mounted) return
        setOrders(Array.isArray(d.orders) ? d.orders : [])
      } catch {
        if (!mounted) return
        setFailed(true)
        setOrders([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (orders === null && !failed) {
    return (
      <div>
        <Header variant="badge" badge="History" badgeIcon="🕘" />
        <div className="hr" />
        <Spinner label="Loading history…" />
      </div>
    )
  }

  const all = orders || []
  const todayKey = dayKey(new Date().toISOString())
  const yKey = dayKey(new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  const today = all.filter((o) => dayKey(o.created_at) === todayKey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const yesterday = all.filter((o) => dayKey(o.created_at) === yKey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="History" badgeIcon="🕘" />

      {/* one app-standard scroller for BOTH sections — headers scroll with the
          list so YESTERDAY is always reachable (old container clipped it) */}
      <VScroll variant="thin">
        <div className="rp-h">TODAY</div>
        {today.length === 0 ? (
          <EmptyState>No orders today</EmptyState>
        ) : (
          <div className="hist-list">
            {today.map((o) => (
              <HistRow key={o.id} order={o} onOpen={showOrderDetails} />
            ))}
          </div>
        )}

        <div className="hr" />

        <div className="rp-h">YESTERDAY</div>
        {yesterday.length === 0 ? (
          <EmptyState>No orders yesterday</EmptyState>
        ) : (
          <div className="hist-list">
            {yesterday.map((o) => (
              <HistRow key={o.id} order={o} onOpen={showOrderDetails} />
            ))}
          </div>
        )}
      </VScroll>
    </div>
  )
}
