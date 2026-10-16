// Reports — opened from the Admin panel bottom-nav "REPORTS" button.
// Per the Page 7 drop: sales metrics + pause history logs. Sales metrics reuse the
// Revenue endpoint (day/week/month, integer Birr); pause history comes from
// ⚠️ INTEGRATION POINT: GET /api/admin-miniapp/pause-history (harness-stubbed,
// the store-settings PATCH appends entries when pause/close/emergency is applied).
import React, { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import ReportUserModal from '../components/ReportUserModal.jsx'
import { api, SessionExpired } from '../api.js'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { useApp } from '../store.jsx'
import { haptic, showConfirm } from '../telegram.js'

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

// Section 7 — user-report review workflow: list of allegations with status,
// reviewer actions (Under review / Resolved / Dismissed) + a decision note.
// Reports never auto-block; a block action stays the explicit confirm-guarded
// flow the platform already has.
const REPORT_STATUS_LABEL = {
  pending: 'Pending',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

const REPORT_STATUS_ORDER = ['pending', 'under_review', 'resolved', 'dismissed']

function fmtReportWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function reportTarget(r) {
  return r.tg_first_name || (r.tg_username ? `@${r.tg_username}` : null) || `#${r.tg_user_id}`
}

export default function Reports() {
  const { revenue, revenuePeriod, setRevenuePeriod, reloadRevenue, pauseHistory, reloadPauseHistory, setBoot, toast } = useApp()
  const fresh = revenue && revenue.period === revenuePeriod ? revenue : null

  const [reports, setReports] = useState(null) // null = loading
  const [reportFilter, setReportFilter] = useState('pending')
  const [addingReport, setAddingReport] = useState(false)
  const [noteFor, setNoteFor] = useState(null) // report being resolved
  const [noteText, setNoteText] = useState('')

  const reloadReports = async () => {
    try {
      const d = await api.getReports()
      setReports(Array.isArray(d.reports) ? d.reports : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setReports((prev) => (Array.isArray(prev) ? prev : []))
    }
  }

  useEffect(() => {
    reloadRevenue(revenuePeriod)
  }, [revenuePeriod, reloadRevenue])

  useEffect(() => {
    reloadPauseHistory()
    reloadReports()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function setReportStatus(report, status) {
    if (status === 'resolved') {
      setNoteFor(report)
      setNoteText(report.decision_note || '')
      return
    }
    const ok = await showConfirm(
      status === 'dismissed'
        ? `Dismiss the ${reportTarget(report)} report?`
        : `Move this report to “${REPORT_STATUS_LABEL[status]}”?`,
    )
    if (!ok) return
    haptic('light')
    try {
      const d = await api.patchReport(report.id, { status })
      setReports((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === d.report.id ? d.report : r)) : prev))
      toast(`Report ${REPORT_STATUS_LABEL[status].toLowerCase()} ✓`)
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
    }
  }

  async function saveResolution() {
    if (!noteFor) return
    haptic('light')
    try {
      const d = await api.patchReport(noteFor.id, { status: 'resolved', decision_note: noteText })
      setReports((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === d.report.id ? d.report : r)) : prev))
      toast('Report resolved ✓')
      setNoteFor(null)
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
    }
  }

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

      <div className="rp-h">USER REPORTS</div>

      <div className="filters" role="tablist" aria-label="Report status filter">
        {REPORT_STATUS_ORDER.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={reportFilter === s}
            className={reportFilter === s ? 'active' : ''}
            onClick={() => {
              haptic('select')
              setReportFilter(s)
            }}
          >
            {REPORT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {!reports ? (
        <Spinner label="Loading reports…" />
      ) : (
        <div className="rp-hist" style={{ marginTop: 14 }}>
          {reports.filter((r) => r.status === reportFilter).length === 0 ? (
            <EmptyState>
              No {REPORT_STATUS_LABEL[reportFilter].toLowerCase()} reports
            </EmptyState>
          ) : (
            reports
              .filter((r) => r.status === reportFilter)
              .map((r) => (
                <div key={r.id} className="rp-hist-card">
                  <div className="rp-hist-top">
                    <span className="rp-hist-kind">{reportTarget(r)}</span>
                    <span className="rp-hist-dur">{fmtReportWhen(r.created_at)}</span>
                  </div>
                  <div className="rp-hist-reason">
                    {String(r.category || '').replace(/_/g, ' ')}
                    {r.description ? ` — ${r.description}` : ''}
                  </div>
                  {r.evidence ? <div className="rp-hist-when">Evidence: {r.evidence}</div> : null}
                  {r.decision_note ? <div className="rp-hist-when">Decision: {r.decision_note}</div> : null}
                  <div className="rp-hist-when">
                    by {r.reporter_name || 'admin'}{r.reviewed_at ? ` · reviewed ${fmtReportWhen(r.reviewed_at)}` : ''}
                  </div>
                  {noteFor?.id === r.id ? null : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {r.status === 'pending' && (
                        <button className="btn" onClick={() => setReportStatus(r, 'under_review')}>
                          Start review
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'under_review') && (
                        <button className="btn btn-goldgreen" onClick={() => setReportStatus(r, 'resolved')}>
                          Resolve
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'under_review') && (
                        <button className="btn" onClick={() => setReportStatus(r, 'dismissed')}>
                          Dismiss
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <button className="btn btn-gold" style={{ width: '100%' }} onClick={() => { haptic('light'); setAddingReport(true) }}>
              + Report a user
            </button>
          </div>
        </div>
      )}

      {noteFor && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setNoteFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Resolve report — {reportTarget(noteFor)}</h3>
            <div className="f-label">Decision note</div>
            <textarea
              className="f-area"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder="What was decided and why?"
              autoFocus
            />
            <div className="ap-hint">Bonus action: block or warn the user via ⚙️ Settings → Blocked users — always confirm there.</div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setNoteFor(null)}>Cancel</button>
              <button className="btn btn-goldgreen" onClick={saveResolution}>Save resolution</button>
            </div>
          </div>
        </div>
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

      {addingReport && <ReportUserModal onClose={() => setAddingReport(false)} />}
    </div>
  )
}
