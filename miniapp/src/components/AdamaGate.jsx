/**
 * CityGate → adama-gate helpers (v3)
 * ----------------------------------
 * The Adama-only enforcement moved to the END of the order flow (user
 * request): the intro never asks for location, and nobody is blocked from
 * even choosing Delivery. The real check happens on the "Almost There!"
 * screen after the customer shares their name + location:
 *
 *     GPS inside ~15 km of Adama center → order proceeds to payment/admin
 *     GPS outside                      → order refused with a clear message
 *
 * This module therefore only exports pure helpers (no UI, no prompts):
 *   distanceKmToAdama(lat, lon) → { inAdama, km }
 *   coordsViaTelegram() / coordsViaNavigator() → {lat, lon} | {error}
 *   verifyLocationForDelivery(coords)          → { inAdama, km } | null
 *
 * The default export is a transparent passthrough so the <CityGate> wrapper
 * in App.jsx stays valid without any behavior.
 */

export const ADAMA_CENTER = { lat: 8.5414, lon: 39.2689 }
export const ADAMA_RADIUS_KM = 15 // service radius per the product spec

// Haversine great-circle distance in km between two {lat, lon} points.
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Distance + verdict for a captured GPS coordinate pair. */
export function distanceKmToAdama(lat, lon) {
  const km = distanceKm(Number(lat), Number(lon), ADAMA_CENTER.lat, ADAMA_CENTER.lon)
  return { inAdama: km <= ADAMA_RADIUS_KM, km }
}

/**
 * Telegram-native location request — the most reliable path inside the
 * Telegram app (iOS WebView has no navigator.geolocation; Android may
 * silently deny it). Shows Telegram's own "share location" popup.
 * Returns {lat, lon} or null (declined / not answered / unsupported).
 */
export function coordsViaTelegram(timeoutMs = 10000) {
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
 * Browser geolocation as fallback (Telegram desktop / normal browser).
 * Resolves {lat, lon} on success or {error} ('denied' | 'timeout' | …).
 */
export function coordsViaNavigator(timeoutMs = 12000) {
  if (!navigator?.geolocation) return Promise.resolve({ error: 'unsupported' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        resolve({ error: err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'failed' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

/** Combined "get my location" used by the delivery flow's share button. */
export async function getCurrentCoords() {
  const viaTg = await coordsViaTelegram()
  if (viaTg) return viaTg
  const viaNav = await coordsViaNavigator()
  if (viaNav?.lat) return { lat: viaNav.lat, lon: viaNav.lon }
  return null
}

/**
 * Transparent passthrough kept so App.jsx's existing <CityGate> wrapper
 * still renders children unchanged.
 */
export default function CityGate({ children }) {
  return children
}
