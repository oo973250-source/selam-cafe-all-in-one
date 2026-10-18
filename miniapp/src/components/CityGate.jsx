import React, { useCallback, useEffect, useState } from 'react'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * CityGate
 * --------
 * Location gate (per user request): on app load, request the user's GPS
 * coordinates and reverse-geocode them with the FREE BigDataCloud
 * client-side API. Only users whose city/locality matches TARGET_CITY
 * can proceed into the mini app; everyone else sees a clean overlay.
 *
 * States:
 *   • idle-protected-action → checked ONCE on load; the result is cached in
 *     sessionStorage so reopening/re-rendering does not re-prompt GPS.
 *   • 'locating'  → waiting for the GPS signal.
 *   • 'geocoding' → waiting for the BigDataCloud response.
 *   • 'denied'    → permission rejected → friendly message + retry button.
 *   • 'wrong-city'  → user is not in Adama → clean restriction overlay.
 *   • 'ok'        → allowed; render children normally.
 */
const TARGET_CITY = 'adama' // compare lowercase
const SESSION_KEY = 'cityGate:rightCity'

const MESSAGES = {
  locating: 'Getting your GPS location…',
  geocoding: 'Checking your city…',
  permission:
    'We need location access to confirm you are ordering from Adama. Turn location on for Telegram (or this browser) and try again.',
  deniedCity: `Sorry, this mini-app is currently only available in ${TARGET_CITY}.`,
}

function cityMatches(data) {
  // BigDataCloud returns several geographic fields; check them all against
  // the target city (case-insensitive, partial match keeps "adama/nooch"
  // and friends working). Falls back to locality when city is missing.
  const names = [
    data?.city,
    data?.locality,
    data?.principalSubdivision,
    data?.localityInfo?.administrative?.[2]?.name,
    data?.localityInfo?.administrative?.[3]?.name,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.toLowerCase())
  return names.some((n) => n.includes(TARGET_CITY))
}

export default function CityGate({ children }) {
  const { hapticFeedback } = useTelegram()

  // Skip the whole gate when a previous check already passed this session —
  // keeps reopening fast and avoids another geolocation prompt.
  const [status, setStatus] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1' ? 'ok' : 'locating'
    } catch {
      return 'locating'
    }
  })

  const check = useCallback(async () => {
    // 1. GPS coords
    if (!navigator?.geolocation) {
      setStatus('denied') // closest behavior: can't locate → ask to enable
      return
    }
    setStatus('locating')
    let coords
    try {
      coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
        )
      })
    } catch {
      hapticFeedback.notificationOccurred('warning')
      setStatus('denied')
      return
    }

    // 2. Reverse geocode with the free client-side BigDataCloud API
    setStatus('geocoding')
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`
      const res = await fetch(url)
      const data = await res.json()
      if (cityMatches(data)) {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
        hapticFeedback.notificationOccurred('success')
        setStatus('ok')
      } else {
        hapticFeedback.notificationOccurred('error')
        setStatus('wrong-city')
      }
    } catch {
      // API failure → fail open rather than lock out paying customers.
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      setStatus('ok')
    }
  }, [hapticFeedback])

  useEffect(() => {
    if (status === 'locating') check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'ok') return children

  const busy = status === 'locating' || status === 'geocoding'
  const title =
    status === 'denied'
      ? 'Location needed'
      : status === 'wrong-city'
        ? '📍 Outside our delivery area'
        : '⌛ One moment'

  const body =
    busy
      ? MESSAGES[status]
      : status === 'denied'
        ? MESSAGES.permission
        : MESSAGES.deniedCity

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'linear-gradient(180deg, rgba(26,15,10,0.97) 0%, rgba(26,15,10,0.99) 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 340,
          width: '100%',
          textAlign: 'center',
          borderRadius: 18,
          border: '1px solid rgba(212,168,83,0.4)',
          background: 'rgba(40,28,16,0.9)',
          padding: '28px 22px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: '#FFF8E7',
            marginBottom: 10,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 14, color: '#C4A882', lineHeight: 1.5 }}>{body}</div>

        {busy ? (
          <div
            aria-hidden
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
        ) : status === 'denied' ? (
          <button
            type="button"
            onClick={check}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #FFD54F 0%, #FFB300 100%)',
              color: '#1a1a1a',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        ) : null}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
