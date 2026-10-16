// Page 1 — "orders" root view: filter pills, paused/closed banner, live order
// cards. Section 3.2: directly below the divider sits a compact three-icon
// status selector — Started (preparing) / Finished (served) / Canceled
// (cancelled) — which filters the ACTUAL stored order status with correct
// counts; the New-Orders list stays the default active queue.
import React, { useMemo } from 'react'
import Header from '../components/Header.jsx'
import OrderCard from '../components/OrderCard.jsx'
import { Banner, EmptyState, Spinner } from '../components/ui.jsx'
import { useApp, ACTIVE_STATUSES, settingsStatus } from '../store.jsx'
import { haptic } from '../telegram.js'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'dine_in', label: 'Dine in' },
  { key: 'takeaway', label: 'Takeaway' },
  { key: 'delivery', label: 'Delivery' },
]

// Section 3.2 — the three navigation statuses map to STORED statuses so no
// list ever duplicates a record:
//   Started  → status = 'preparing'
//   Finished → status = 'served'
//   Canceled → status = 'cancelled'
const STATUS_TABS = [
  { key: 'started', label: 'Started', icon: '▶️', stored: 'preparing' },
  { key: 'finished', label: 'Finished', icon: '✅', stored: 'served' },
  { key: 'canceled', label: 'Canceled', icon: '✖️', stored: 'cancelled' },
]

function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

// local calendar-day check — done (served) orders only stay in the live queue
// for the rest of the current day; older ones live in the history screen only.
function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function OrdersView() {
  const { orders, filter, setFilter, settings, statusTab, setStatusTab, push } = useApp()

  const status = settingsStatus(settings)

  // Active New-Orders queue: started/ready/served-today, blocked users'
  // orders are already excluded SERVER-SIDE (Section 3.1) via /api/orders.
  const activeOrders = useMemo(() => {
    if (!Array.isArray(orders)) return null
    return orders
      .filter(
        (o) =>
          ACTIVE_STATUSES.includes(o.status) ||
          (o.status === 'served' && !o.dismissed_at && isToday(o.served_at || o.updated_at)),
      )
      .filter((o) => filter === 'all' || o.service_type === filter)
  }, [orders, filter])

  // Statuses are read from the same loaded array — one stored status
  // column, no client-side copies, no duplicates across the three lists.
  const statusCounts = useMemo(() => {
    const counts = { started: 0, finished: 0, canceled: 0 }
    if (Array.isArray(orders)) {
      for (const o of orders) {
        if (o.status === 'preparing') counts.started++
        else if (o.status === 'served' && !o.dismissed_at) counts.finished++
        else if (o.status === 'cancelled' && isToday(o.updated_at || o.created_at)) counts.canceled++
      }
    }
    return counts
  }, [orders])

  const selectedTab = STATUS_TABS.find((t) => t.key === statusTab) || null

  const filteredByStatus = useMemo(() => {
    if (!selectedTab || !Array.isArray(orders)) return []
    const stored = selectedTab.stored
    return orders
      .filter((o) => o.status === stored)
      .filter((o) => {
        // Finished: only undelivered dismissals stay relevant for today.
        if (stored === 'served') return !o.dismissed_at && isToday(o.served_at || o.updated_at)
        if (stored === 'cancelled') return isToday(o.updated_at || o.created_at)
        return true
      })
      .filter((o) => filter === 'all' || o.service_type === filter)
  }, [orders, selectedTab, filter])

  return (
    <div>
      {/* list-note icon (top-right corner) → order history, today + yesterday */}
      <Header variant="tabs" active="orders" onHistory={() => push('history')} />

      <div className="filters" role="tablist" aria-label="Order type filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => {
              haptic('select')
              setFilter(f.key)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="hr" />

      {/* Section 3.2 — status selector sits DIRECTLY below the divider */}
      <div className="status-selector" role="tablist" aria-label="Order status view">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={statusTab === t.key}
            className={statusTab === t.key ? 'active' : ''}
            onClick={() => {
              haptic('select')
              setStatusTab(statusTab === t.key ? 'new' : t.key)
            }}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
            <span className="st-count">{statusCounts[t.key]}</span>
          </button>
        ))}
      </div>

      {status.kind !== 'open' && (
        <Banner>
          {status.kind === 'emergency' && '⏸ Paused — not accepting orders'}
          {status.kind === 'countdown' && `⏸ Paused — orders resume in ${fmtLeft(status.until - Date.now())}`}
          {status.kind === 'closed' && `⏸ Closed — reopens ${new Date(status.until).toLocaleDateString()}`}
          {status.reason ? <span className="banner-reason">Reason: {status.reason}</span> : null}
        </Banner>
      )}

      {orders === null ? (
        <Spinner label="Loading orders…" />
      ) : selectedTab ? (
        filteredByStatus.length === 0 ? (
          <EmptyState>
            No {selectedTab.label.toLowerCase()} orders today — active orders live in New Orders above
          </EmptyState>
        ) : (
          filteredByStatus.map((o) => <OrderCard key={o.id} order={o} />)
        )
      ) : activeOrders === null ? (
        <Spinner label="Loading orders…" />
      ) : activeOrders.length === 0 ? (
        <EmptyState>No active orders</EmptyState>
      ) : (
        activeOrders.map((o) => <OrderCard key={o.id} order={o} />)
      )}
    </div>
  )
}
