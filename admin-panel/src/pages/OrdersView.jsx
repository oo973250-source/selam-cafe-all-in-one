// Page 1 — "orders" root view: filter pills, paused/closed banner, live order cards.
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

function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export default function OrdersView() {
  const { orders, filter, setFilter, settings } = useApp()

  const status = settingsStatus(settings)

  const activeOrders = useMemo(() => {
    if (!Array.isArray(orders)) return null
    return orders
      .filter((o) => ACTIVE_STATUSES.includes(o.status))
      .filter((o) => filter === 'all' || o.service_type === filter)
  }, [orders, filter])

  return (
    <div>
      <Header variant="tabs" active="orders" />

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

      {status.kind !== 'open' && (
        <Banner>
          {status.kind === 'emergency' && '⏸ Paused — not accepting orders'}
          {status.kind === 'countdown' && `⏸ Paused — orders resume in ${fmtLeft(status.until - Date.now())}`}
          {status.kind === 'closed' && `⏸ Closed — reopens ${new Date(status.until).toLocaleDateString()}`}
          {status.reason ? <span className="banner-reason">Reason: {status.reason}</span> : null}
        </Banner>
      )}

      {activeOrders === null ? (
        <Spinner label="Loading orders…" />
      ) : activeOrders.length === 0 ? (
        <EmptyState>No active orders</EmptyState>
      ) : (
        activeOrders.map((o) => <OrderCard key={o.id} order={o} />)
      )}
    </div>
  )
}
