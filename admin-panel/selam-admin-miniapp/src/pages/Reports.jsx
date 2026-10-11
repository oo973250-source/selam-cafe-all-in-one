// Reports — opened from the Admin panel bottom-nav "REPORTS" button.
// Per the Page 7 drop: sales metrics + pause history logs. Sales metrics reuse the
// Revenue endpoint (day/week/month, integer Birr); pause history comes from
// ⚠️ INTEGRATION POINT: GET /api/admin-miniapp/pause-history (harness-stubbed,
// the store-settings PATCH appends entries when pause/close/emergency is applied).
import React, { useEffect } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const PERIODS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—')

const KIND_LABEL = {
  emergency: 'Emergency pause',
  countdown: 'Timed pause',
  closed: 'Store closure',
}

function fmtHist(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// Human duration between two ISO stamps ("35 min", "1 d 4 h").
function fmtSpan(from, to) {
  if (!from || !to) return null
  let min = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  const d = Math.floor(min / 1440)
  min -= d * 1440
  const h = Math.floor(min / 60)
  const m = min % 60
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export default function Reports() {
  const { revenue, revenuePeriod, setRevenuePeriod, reloadRevenue, pauseHistory, reloadPauseHistory } = useApp()
  const fresh = revenue && revenue.period === revenuePeriod ? revenue : null

  useEffect(() => {
    reloadRevenue(revenuePeriod)
  }, [revenuePeriod, reloadRevenue])

  useEffect(() => {
    reloadPauseHistory()
  }, [reloadPauseHistory])

  const hist = Array.isArray(pauseHistory) ? pauseHistory : null

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Reports" badgeIcon="📊" />

      <div className="hr" />

      {/* app-standard scroller — .page-scroll alone CLIPS (overflow hidden);
          without this, long pause histories are unreachable (user report) */}
      <VScroll variant="thin">
      <div className="rp-h">SALES METRICS</div>

      {/* Time range toggle — same data source as the Revenue screen */}
      <div className="period-bar">
        <div className="seg seg-days" role="tablist" aria-label="Reports time range">
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
        <div className="rp-cards">
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
        </div>
      ) : (
        <Spinner label="Loading reports…" />
      )}

      <div className="hr" />

      <div className="rp-h">PAUSE HISTORY</div>

      {!hist ? (
        <Spinner label="Loading history…" />
      ) : hist.length === 0 ? (
        <EmptyState>No pause or closure events yet</EmptyState>
      ) : (
        <div className="rp-hist">
          {hist.map((h) => (
            <div key={h.id} className={`rp-hist-card kind-${h.kind}`}>
              <div className="rp-hist-top">
                <span className="rp-hist-kind">{KIND_LABEL[h.kind] || h.kind}</span>
                <span className="rp-hist-dur">{fmtSpan(h.started_at, h.ended_at) || 'ongoing'}</span>
              </div>
              {h.reason ? <div className="rp-hist-reason">Reason: {h.reason}</div> : null}
              <div className="rp-hist-when">
                {fmtHist(h.started_at)}
                {h.ended_at ? ` → ${fmtHist(h.ended_at)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      </VScroll>
    </div>
  )
}
