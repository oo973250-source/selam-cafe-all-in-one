// Page 8 — "Revenue": financial analytics rebuilt per reference image 2.
// Gold Day|Week|Month segmented control with calendar icons; three tall
// rounded stat cards, each with a colored icon disc + big value + label
// (Total orders / Revenue ETB / Delivery done), and the selected first card
// carries the gold accent bar. All numbers come from the real backend
// (GET /api/admin-miniapp/revenue?period=…) — never hardcoded samples.
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

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// INTEGER Birr per contract — thousands separators, no decimals. Null (failed
// fetch) renders an em dash instead of a fake zero.
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—')

const CARDS = [
  { key: 'orders', label: 'Total orders', ico: 'metric-ico-gold', glyph: '📄' },
  { key: 'revenue', label: 'Revenue ETB', ico: 'metric-ico-green', glyph: '💰' },
  { key: 'delivered', label: 'Delivery done', ico: 'metric-ico-purple', glyph: '🛍️' },
]

export default function Revenue() {
  const { revenue, revenuePeriod, setRevenuePeriod, reloadRevenue } = useApp()
  const fresh = revenue && revenue.period === revenuePeriod ? revenue : null

  // Refetch on every entry to the page and on every period switch; cached data
  // for the same period renders instantly while the refresh is in flight.
  useEffect(() => {
    reloadRevenue(revenuePeriod)
  }, [revenuePeriod, reloadRevenue])

  const values = fresh
    ? { orders: fresh.orders, revenue: fresh.revenue, delivered: fresh.delivered }
    : null

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Revenue" />

      <div className="hr" />

      {/* Time range toggle — Day | Week | Month (gold selected per image 2) */}
      <div className="seg-days-gold" role="tablist" aria-label="Revenue time range">
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
            <CalIcon />
            {p.label}
          </button>
        ))}
      </div>

      {fresh ? (
        <VScroll variant="thin">
          {CARDS.map((c, i) => (
            <div className={`metric-card ${i === 0 ? 'metric-selected' : ''}`} key={c.key}>
              <span className={`metric-ico ${c.ico}`} aria-hidden>
                {c.glyph}
              </span>
              <span className="metric-body">
                <span className="metric-value">{fmt(values?.[c.key])}</span>
                <span className="metric-label" style={{ display: 'block' }}>{c.label}</span>
              </span>
              <span className="metric-chevron" aria-hidden="true"><Chevron /></span>
            </div>
          ))}
        </VScroll>
      ) : (
        <Spinner label="Loading revenue…" />
      )}
    </div>
  )
}
