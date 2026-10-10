// Page 8 — "Revenue": financial analytics, opened from the Manager hub.
// Time-range toggle (Day active white | Week | Month) filters three white-outlined
// metric cards: Total orders / Revenue ETB / Delivery done. Numbers are per-period
// server values (⚠️ INTEGRATION POINT: /api/admin-miniapp/revenue, harness-stubbed).
import React, { useEffect } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import { Spinner } from '../components/ui.jsx'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const PERIODS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

// INTEGER Birr per contract — thousands separators, no decimals. Null (failed
// fetch) renders an em dash instead of a fake zero.
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—')

export default function Revenue() {
  const { revenue, revenuePeriod, setRevenuePeriod, reloadRevenue } = useApp()
  const fresh = revenue && revenue.period === revenuePeriod ? revenue : null

  // Refetch on every entry to the page and on every period switch; cached data
  // for the same period renders instantly while the refresh is in flight.
  useEffect(() => {
    reloadRevenue(revenuePeriod)
  }, [revenuePeriod, reloadRevenue])

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Revenue" />

      <div className="hr" />

      {/* Time range toggle — Day | Week | Month (mock's lowercase "week" normalized) */}
      <div className="period-bar">
        <div className="seg seg-days" role="tablist" aria-label="Revenue time range">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={revenuePeriod === p.key}
              className={revenuePeriod === p.key ? 'active' : ''}
              onClick={() => {
                if (revenuePeriod === p.key) return
                haptic('select')
                setRevenuePeriod(p.key)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {fresh ? (
        <VScroll variant="thin">
          <div className="metric-card">
            <div className="metric-value">{fmt(fresh.orders)}</div>
            <div className="metric-label">Total orders</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{fmt(fresh.revenue)}</div>
            <div className="metric-label">Revenue ETB</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{fmt(fresh.delivered)}</div>
            <div className="metric-label">Delivery done</div>
          </div>
        </VScroll>
      ) : (
        <Spinner label="Loading revenue…" />
      )}
    </div>
  )
}
