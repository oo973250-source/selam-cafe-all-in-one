// Page 7 — Admin panel (opened from Manager hub → Emergency pause).
// Order management (limit / throttle / delivery toggle), temporary store status
// (pause-for countdown, close-for-days, closure reason broadcast), live countdown
// box, emergency kill-switch, and the bottom quick-nav (Menu / Announcements /
// REPORTS — all functional; Star removed per user). Reports + Announcements pages
// = ⚠️ INTEGRATION POINTS (harness-stubbed).
import React, { useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import { settingsStatus, useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

// ---------- tiny controlled steppers ----------

function StepBtn({ ch, onClick, disabled }) {
  return (
    <button
      type="button"
      className="ap-step-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={ch === '−' ? 'Decrease' : 'Increase'}
    >
      {ch}
    </button>
  )
}

// Plain integer stepper: "0" for limit / throttle / days.
function NumStep({ value, onCommit, min = 0, max = 99, step = 1, ariaLabel }) {
  const [txt, setTxt] = useState(String(value))
  useEffect(() => setTxt(String(value)), [value])
  const clamp = (n) => Math.max(min, Math.min(max, Math.round(Number(n)) || 0))
  const commit = (raw) => {
    const n = clamp(raw)
    setTxt(String(n))
    if (n !== value) onCommit(n)
  }
  const bump = (d) => {
    const n = clamp((Math.round(Number(value)) || 0) + d)
    setTxt(String(n))
    onCommit(n)
  }
  return (
    <div className="ap-step">
      <StepBtn ch="−" onClick={() => bump(-step)} disabled={value <= min} />
      <input
        className="ap-val"
        style={{ width: 56 }}
        inputMode="numeric"
        value={txt}
        aria-label={ariaLabel}
        onChange={(e) => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
        }}
      />
      <StepBtn ch="+" onClick={() => bump(step)} disabled={value >= max} />
    </div>
  )
}

// Duration stepper in minutes, shown "HH:MM" (− / + step 30 min).
function DurStep({ value, onCommit, min = 0, max = 23 * 60 + 59, step = 30 }) {
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const [txt, setTxt] = useState(fmt(value))
  useEffect(() => setTxt(fmt(value)), [value])
  const parse = (raw) => {
    const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(String(raw).trim())
    if (!m) return null
    return Math.min(max, Number(m[1]) * 60 + Number(m[2] || 0))
  }
  const commit = (raw) => {
    const n = parse(raw)
    if (n === null) {
      setTxt(fmt(value))
      return
    }
    setTxt(fmt(n))
    if (n !== value) onCommit(n)
  }
  const bump = (d) => {
    const n = Math.max(min, Math.min(max, value + d))
    setTxt(fmt(n))
    onCommit(n)
  }
  return (
    <div className="ap-step">
      <StepBtn ch="−" onClick={() => bump(-step)} disabled={value <= min} />
      <input
        className="ap-val"
        style={{ width: 68 }}
        inputMode="numeric"
        value={txt}
        aria-label="Pause duration, hours and minutes"
        onChange={(e) => setTxt(e.target.value.replace(/[^\d:]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
        }}
      />
      <StepBtn ch="+" onClick={() => bump(step)} disabled={value >= max} />
    </div>
  )
}

// iOS-style switch — ON = green, OFF = gray (Page 7 mock).
function DeliveryToggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Delivery service" className={`ap-tgl ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="ap-tgl-knob" />
    </button>
  )
}

function fmtRemaining(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = String(m).padStart(2, '0')
  const s2 = String(ss).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${s2}` : `${mm}:${s2}`
}

function fmtClock(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------- icons (bottom quick-nav) ----------

function QueueIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ---------- page ----------

export default function AdminPanel() {
  const {
    settings,
    reloadSettings,
    togglePaused,
    startPauseCountdown,
    stopPauseCountdown,
    closeForDays,
    reopenStore,
    setDeliveryAvailable,
    setOrderLimit,
    setPickupThrottle,
    saveClosureReason,
    push,
    switchTab,
    toast,
  } = useApp()

  const [now, setNow] = useState(Date.now())
  const [pauseMin, setPauseMin] = useState(0)
  const [closeDays, setCloseDays] = useState(0)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const reasonInit = useRef(false)

  const status = settingsStatus(settings, now)

  // the Save button is only enabled when the textarea differs from server truth
  const reasonDirty = reason.trim() !== ((settings && settings.closure_reason) || '').trim()

  // countdown ticker — informational only; the server owns the authoritative auto-resume
  useEffect(() => {
    if (!settings || !settings.pause_until) return undefined
    const until = new Date(settings.pause_until).getTime()
    if (until <= Date.now()) return undefined
    const t = setInterval(() => {
      if (Date.now() >= until) {
        toast('Pause ended — orders resumed')
        reloadSettings()
      } else {
        setNow(Date.now())
      }
    }, 1000)
    return () => clearInterval(t)
  }, [settings, reloadSettings, toast])

  // seed the reason textarea from server truth once
  useEffect(() => {
    if (!reasonInit.current && settings) {
      setReason(settings.closure_reason || '')
      reasonInit.current = true
    }
  }, [settings])

  const saveReason = () => {
    if (!settings) return
    if (reason.trim() !== (settings.closure_reason || '').trim()) saveClosureReason(reason)
  }

  const applyPause = async () => {
    if (busy || pauseMin <= 0) return
    setBusy(true)
    await startPauseCountdown(pauseMin, reason.trim())
    setPauseMin(0)
    setBusy(false)
  }

  const applyClose = async () => {
    if (busy || closeDays <= 0) return
    setBusy(true)
    await closeForDays(closeDays, reason.trim())
    setCloseDays(0)
    setBusy(false)
  }

  const onStop = async () => {
    if (busy) return
    setBusy(true)
    await stopPauseCountdown()
    setBusy(false)
  }

  const onReopen = async () => {
    if (busy) return
    setBusy(true)
    await reopenStore()
    setBusy(false)
  }

  const emergency = status.kind === 'emergency'
  const countdown = status.kind === 'countdown'
  const closed = status.kind === 'closed'
  const deliveryOn = !!(settings && settings.delivery_available)

  return (
    <div>
      <Header variant="badge" badge="">
        <button
          className={`ep-btn ${emergency ? 'ep-btn-on' : ''}`}
          onClick={() => {
            if (busy) return
            togglePaused()
          }}
        >
          {emergency ? 'RESUME ORDERS' : 'EMERGENCY PAUSE'}
        </button>
      </Header>

      <div className="hr" />

      {/* ----- ORDER MANAGEMENT ----- */}
      <div className="ap-wrap">
        <div className="ap-h">ORDER MANAGEMENT</div>
        <div className="ap-panel">
          <div className="ap-row">
            <span className="ap-label">Limit incoming orders to:</span>
            {/* No arbitrary cap (user directive): the ADMIN decides the maximum.
                0 = no cap; 9999 is only a sanity bound against typos. */}
            <NumStep value={(settings && settings.order_limit) || 0} onCommit={setOrderLimit} max={9999} ariaLabel="Order limit" />
          </div>
          <div className="ap-row">
            <span className="ap-label">Throttle pickup times to (+min):</span>
            <NumStep
              value={(settings && settings.pickup_throttle_min) || 0}
              onCommit={setPickupThrottle}
              max={120}
              ariaLabel="Pickup throttle minutes"
            />
          </div>
          <div className="ap-sep" />
          <div className="ap-row">
            <span className="ap-label">Delivery Service:</span>
            <span className="ap-tgl-cell">
              <DeliveryToggle on={deliveryOn} onChange={setDeliveryAvailable} />
              <span className={deliveryOn ? 'ap-avail' : 'ap-unavail'}>{deliveryOn ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
            </span>
          </div>
        </div>

        {/* ----- TEMPORARY STORE STATUS ----- */}
        <div className="ap-h ap-h2">TEMPORARY STORE STATUS</div>
        <div className="ap-panel">
          <div className="ap-row">
            <span className="ap-label">Pause for</span>
            <span className="ap-cell">
              <DurStep value={pauseMin} onCommit={setPauseMin} />
              <span className="ap-unit">Hours</span>
              <button type="button" className="ap-apply" onClick={applyPause} disabled={busy || pauseMin <= 0} aria-label="Start pause countdown">
                ✓
              </button>
            </span>
          </div>
          <div className="ap-row">
            <span className="ap-label">Close for</span>
            <span className="ap-cell">
              <NumStep value={closeDays} onCommit={setCloseDays} max={30} ariaLabel="Closure days" />
              <span className="ap-unit">Days</span>
              <button type="button" className="ap-apply" onClick={applyClose} disabled={busy || closeDays <= 0} aria-label="Close the store">
                ✓
              </button>
            </span>
          </div>
          <textarea
            className="f-area ap-reason"
            placeholder="Type closure reason for all users..."
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            onBlur={saveReason}
          />
          {/* Explicit save button — blur-autosave alone was undiscoverable: admins
              had nothing to click after typing the reason (user report). */}
          <div className="ap-reason-row">
            <button
              type="button"
              className="ap-reason-save"
              onClick={saveReason}
              disabled={busy || !reasonDirty}
              aria-label="Save closure reason"
            >
              ✓ Save reason
            </button>
            {!reasonDirty && <span className="ap-reason-saved">Saved ✓</span>}
          </div>
        </div>
        <p className="ap-hint">This reason will be visible to all users attempting to order during closure.</p>

        {/* ----- ACTIVE COUNTDOWN STATUS ----- */}
        <div className="hr ap-hr" />
        <div className={`ap-count ${countdown ? 'ap-count-on' : ''}`}>
          {countdown && (
            <>
              <div className="ap-count-label">!! Count down started — ends {fmtClock(settings.pause_until)}</div>
              <div className="ap-count-timer">{fmtRemaining(status.until - now)}</div>
              <button type="button" className="ap-count-chip" onClick={onStop} disabled={busy}>
                Stop
              </button>
            </>
          )}
          {closed && (
            <>
              <div className="ap-count-label">Closed until {new Date(status.until).toLocaleDateString()} {fmtClock(status.until)}</div>
              <button type="button" className="ap-count-chip" onClick={onReopen} disabled={busy}>
                Reopen
              </button>
            </>
          )}
          {!countdown && !closed && (
            <>
              <div className="ap-count-label ap-count-idle">No countdown running</div>
              <div className="ap-count-timer ap-count-dim">00:00</div>
            </>
          )}
        </div>

        {/* ----- bottom quick-nav: Menu / Announcements / REPORTS (Star removed
              per user; all remaining buttons open working pages) ----- */}
        <div className="ap-nav">
          <button type="button" className="ico-btn" aria-label="Order queues" onClick={() => { haptic('light'); switchTab('orders') }}>
            <QueueIcon />
          </button>
          <button type="button" className="ico-btn" aria-label="Announcements" onClick={() => { haptic('light'); push('announcements') }}>
            <PlusIcon />
          </button>
          <button type="button" className="ap-reports" onClick={() => { haptic('light'); push('reports') }}>
            REPORTS
          </button>
        </div>
      </div>
    </div>
  )
}
