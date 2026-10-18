import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLang } from '../context/LangContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * CityGate (v2 — SILENT verification, delivery-only lockout)
 * ----------------------------------------------------------
 * The cafe serves Adama, Ethiopia ONLY. Instead of blocking entry into the
 * mini app (v1 behavior, reverted), verification now runs SILENTLY in the
 * background during the intro screen and only gates the delivery option:
 *
 *   1. Silent IP check (step 1)  → GET /api/miniapp/geo (server proxies the
 *      free ip-api.com service). If the IP resolves inside Adama the user
 *      passes without ever seeing a prompt. Ethio Telecom is known for
 *      routing regional mobile traffic through Addis Ababa, so this is only
 *      a fast-path — it must never lock someone out.
 *   2. GPS fallback (step 2)     → if the IP check says "outside", a polite,
 *      DISMISSIBLE modal appears during the intro:
 *        "We currently only serve customers in Adama! If you are in Adama,
 *         tap below to confirm your location."
 *      Tapping "Verify My Location" calls navigator.geolocation and measures
 *      the Haversine distance to Adama center (8.5414, 39.2689). Within
 *      ~15 km → verified. Denied / timed out / too far → the modal explains
 *      and can still be dismissed (browsing stays free).
 *   3. Caching                   → a PASS is cached in localStorage for
 *      24 hours (`selamLocOkUntil`), so returning users never re-verify.
 *
 * The gate does NOT block app entry in either outcome. It exposes a context:
 *      useCityGate() → { geoStatus, deliveryAllowed, showLocationModal }
 * ServiceChoice consults it: tapping Delivery while `deliveryAllowed` is
 * false does nothing except pop up the "Adama only" message (with the same
 * Verify button inside as a recovery path).
 *
 * NOTE: the popup is intentionally app-driven (not tg.showAlert) so it can
 * carry the verify button and localized body text.
 */

// Haversine great-circle distance in km between two {lat, lon} points.
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ADAMA_CENTER = { lat: 8.5414, lon: 39.2689 }
const ADAMA_RADIUS_KM = 15 // ~15km service radius per the product spec
const CACHE_KEY = 'selamLocOkUntil'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // positive result cached 24h
const GEO_FETCH_TIMEOUT_MS = 8000

function readCachedPass() {
  try {
    const until = Number(localStorage.getItem(CACHE_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

function cachePass() {
  try { localStorage.setItem(CACHE_KEY, String(Date.now() + CACHE_TTL_MS)) } catch {}
}

function clearPass() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

const CityGateContext = createContext(null)

export function useCityGate() {
  const ctx = useContext(CityGateContext)
  if (!ctx) throw new Error('useCityGate must be used inside <CityGate>')
  return ctx
}

/**
 * Try NOT to use navigator.geolocation first: Telegram's in-app WebView
 * (iOS especially) has no geolocation support and Android may silently
 * deny it. Telegram's own WebApp.requestLocation() shows the native
 * "share location" popup and works on both platforms. Returns
 * {lat, lon} or null (nothing answered / user declined).
 */
function coordsViaTelegram(timeoutMs = 10000) {
  const tg = window?.Telegram?.WebApp
  if (!tg || typeof tg.requestLocation !== 'function') return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    try {
      tg.requestLocation((ok, loc) => {
        finish(ok && loc ? { lat: loc.latitude, lon: loc.longitude } : null)
      })
    } catch {
      finish(null)
    }
  })
}

/**
 * Browser geolocation as fallback (works in the Telegram desktop app's
 * browser and in a normal browser tab). Mirrors the old result shape.
 */
function coordsViaNavigator(timeoutMs = 12000) {
  if (!navigator?.geolocation) return Promise.resolve({ error: 'unsupported' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      }),
      (err) => resolve({
        error: err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'failed',
      }),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    )
  })
}

export default function CityGate({ children }) {
  const { hapticFeedback } = useTelegram()

  // geoStatus drives the delivery option:
  //   'checking'  → IP ask in flight (start as ok=false, fail-safe)
  //   'ok'        → IP or GPS confirmed Adama (or 24h cache hit)
  //   'outside'   → a check positively placed us outside Adama
  //   'unknown'   → the check could not run (network error / no API)
  // In 'outside'/'unknown' the app remains fully usable, but delivery is
  // locked until a GPS verification (or cache) turns it into 'ok'.
  const [geoStatus, setGeoStatus] = useState(() =>
    readCachedPass() ? 'ok' : 'checking'
  )
  const [modal, setModal] = useState(null) // null | { origin: 'intro'|'delivery' }

  const showLocationModal = useCallback((origin = 'delivery') => {
    setModal({ origin })
  }, [])

  const closeLocationModal = useCallback(() => setModal(null), [])

  const verifyByGps = useCallback(async () => {
    setModal((m) => ({ ...m, busy: true, note: null }))

    // 1. Telegram-native location (most reliable inside the Telegram app,
    //    including iOS where navigator.geolocation doesn't exist).
    let coords = await coordsViaTelegram()
    let errCode = 'telegram'

    // 2. Browser geolocation fallback (Telegram desktop / normal browser).
    if (!coords) {
      const nav = await coordsViaNavigator()
      if (nav?.lat) {
        coords = { lat: nav.lat, lon: nav.lon }
      } else {
        errCode = nav?.error || 'failed'
      }
    }

    if (!coords) {
      hapticFeedback.notificationOccurred('warning')
      setModal((m) => ({
        ...m,
        busy: false,
        note: errCode === 'denied' ? 'denied' : errCode === 'timeout' ? 'timeout' : 'failed',
      }))
      return
    }

    const km = distanceKm(coords.lat, coords.lon, ADAMA_CENTER.lat, ADAMA_CENTER.lon)
    if (km <= ADAMA_RADIUS_KM) {
      // Inside Adama → cache 24h, unlock delivery, celebrate briefly.
      cachePass()
      hapticFeedback.notificationOccurred('success')
      setGeoStatus('ok')
      setModal({ origin: modal?.origin, busy: false, verified: true })
      // Auto-dismiss the success banner shortly so the intro keeps flowing.
      setTimeout(() => setModal(null), 1800)
    } else {
      clearPass()
      hapticFeedback.notificationOccurred('error')
      setGeoStatus('outside')
      setModal((m) => ({ ...m, busy: false, note: 'outside', km: Math.round(km) }))
    }
  }, [hapticFeedback, modal?.origin])

  // Step 1 — silent IP check on first load (skipped when a pass is cached).
  useEffect(() => {
    if (geoStatus !== 'checking') return
    let cancelled = false

    const timer = new Promise((resolve) =>
      setTimeout(() => resolve(null), GEO_FETCH_TIMEOUT_MS)
    )
    Promise.race([
      fetch('/api/miniapp/geo')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      timer,
    ]).then((data) => {
      if (cancelled) return
      if (!data || typeof data === 'string') {
        // Network/API failure → fail SAFE for entry (fail-safe = keep
        // browsing usable) but leave delivery locked ('unknown') so the
        // delivery tap still offers the GPS verification path.
        setGeoStatus('unknown')
        return
      }
      if (data.inAdama === true) {
        cachePass()
        setGeoStatus('ok')
      } else if (data.inAdama === false) {
        // A positive answer from the server: outside Adama. Polite auto-modal
        // ONCE during the intro — dismissible, never a hard block.
        setGeoStatus('outside')
        if (data.promptable !== false) setModal({ origin: 'intro' })
      } else {
        // inAdama null/undefined (server lookup failed) → inconclusive:
        // browsing stays free, delivery stays locked until GPS verifies.
        setGeoStatus('unknown')
      }
    })

    return () => { cancelled = true }
  }, [geoStatus])

  const deliveryAllowed = geoStatus === 'ok'

  return (
    <CityGateContext.Provider
      value={{ geoStatus, deliveryAllowed, showLocationModal, closeLocationModal, verifyByGps }}
    >
      {children}
      <CityGateModal
        modal={modal}
        onClose={closeLocationModal}
        onVerify={verifyByGps}
      />
    </CityGateContext.Provider>
  )
}

/**
 * The popup surfaces (all localized via the modal's own dictionary):
 *   origin 'intro'    → appears during the welcome splash when the IP says
 *                       outside Adama. Dismissible ("Continue").
 *   origin 'delivery' → appears when a locked delivery button is tapped.
 *
 *  states within the modal:
 *   verified  → green success flash before auto-dismiss
 *   note:
 *     'denied'  → location permission refused
 *     'timeout' → GPS took too long
 *     'failed'  → GPS unavailable / errored
 *     'outside' → GPS confirmed OUTSIDE Adama → "Service Unavailable
 *                 Outside Adama" blocked state with retry option
 */
function CityGateModal({ modal, onClose, onVerify }) {
  if (!modal) return null

  const { t } = useLang()
  const busy = !!modal.busy
  const verified = !!modal.verified

  let title = modal.origin === 'intro' ? t('adamaOnlyTitle') : t('adamaDeliveryTitle')
  let body = t('adamaOnlyMsg')
  let noteText = null

  if (verified) {
    title = t('adamaVerifiedTitle')
    body = t('adamaVerifiedMsg')
  } else if (modal.note === 'outside') {
    title = t('adamaBlockedTitle')
    body = t('adamaBlockedMsg')
    noteText = t('adamaOutsideNote')
  } else if (modal.note === 'denied') {
    noteText = t('adamaLocationDenied')
  } else if (modal.note === 'timeout') {
    noteText = t('adamaLocationTimeout')
  } else if (modal.note === 'failed') {
    noteText = t('adamaLocationFailed')
  } else if (modal.note === 'geolocationUnavailable') {
    noteText = t('geolocationUnavailable')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22,
        background: 'rgba(10, 6, 2, 0.72)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          maxWidth: 330,
          width: '100%',
          textAlign: 'center',
          borderRadius: 18,
          border: '1px solid rgba(212,168,83,0.45)',
          background: 'linear-gradient(180deg, rgba(40,28,16,0.97) 0%, rgba(26,15,10,0.98) 100%)',
          padding: '24px 20px',
          boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 10 }} aria-hidden>
          {verified ? '✅' : modal.note === 'outside' ? '📍' : '🛵'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            fontWeight: 800,
            color: verified ? 'var(--accent-green, #6EE7B7)' : '#FFF8E7',
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: '#C4A882', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
          {body}
        </div>

        {noteText && (
          <div style={{ fontSize: 12.5, color: verified ? '#6EE7B7' : '#E8763A', marginTop: 10, lineHeight: 1.45 }}>
            {noteText}
          </div>
        )}

        {busy ? (
          <div
            aria-label={t('adamaChecking')}
            style={{
              margin: '18px auto 0',
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '3px solid rgba(212,168,83,0.25)',
              borderTopColor: '#D4A853',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : verified ? null : (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={onVerify}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 999,
                border: 'none',
                background: 'linear-gradient(135deg, #FFD54F 0%, #FFB300 100%)',
                color: '#1a1a1a',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              📍 {t('adamaVerifyBtn')}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: 999,
                border: '1px solid rgba(212,168,83,0.35)',
                background: 'transparent',
                color: '#C4A882',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              {modal.origin === 'intro' ? t('adamaContinue') : t('contactSupport')}
            </button>
          </div>
        )}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
