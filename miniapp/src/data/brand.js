/**
 * brand.js
 * --------
 * Central brand configuration for Selam Cafe.
 *
 * Admin-editable fields (in the future, these will be editable via the
 * admin section — for now they live here so they're easy to find and
 * swap manually).
 *
 *   logoUrl  →  if set, an <img> with this src is used as the logo
 *               everywhere <BrandLogo> is rendered. Set to null to
 *               fall back to the emoji-based <CafeLogo> (🪶☕🪶).
 *
 *   logoSize →  default size (px) of the longest edge of the logo.
 *
 *   name     →  cafe display name (used in intro title fallback,
 *               page <title>, PWA manifest, etc.)
 *
 * To swap the logo later:
 *   1. Drop the new logo image into /public/brand/logo.png
 *   2. Either keep logoUrl pointing to '/brand/logo.png' (default)
 *      or set it to a different URL.
 *   3. Rebuild (`npm run build`).
 *
 * In the future admin section, this object will be loaded from the
 * backend (e.g., GET /api/brand) and cached in localStorage.
 */

export const brandConfig = {
  // Default: serve the logo from /public/brand/logo.png
  // Admin can replace that file or override this URL.
  logoUrl: '/brand/logo.png',

  // Default logo size (px). Components can override per-use.
  logoSize: 80,

  // Cafe name (used in intro title, page title, etc.)
  name: 'Selam Cafe',

  // Tagline (used in intro subtitle, footer, etc.)
  tagline: 'Fresh. Warm. Made with love.',
}

/**
 * Get the current brand config.
 * Merges admin-edited cafe identity (GET /api/brand — the same cafe_profile row
 * the admin Profile page controls) over the bundled defaults.
 */
export function getBrand() {
  return brandConfig
}

/**
 * Apply a public brand payload ({ name, logo_url, updated_at }) on top of the
 * static config. Called on enableLiveBrand() and on every `brand:update`
 * socket push so a logo/name change made in the Admin Mini App reaches every
 * open customer Mini App within seconds — no redeploy, no app restart.
 */
export function applyPublicBrand(publicBrand) {
  if (!publicBrand || typeof publicBrand !== 'object') return false
  let changed = false
  if (publicBrand.name && String(publicBrand.name).trim()) {
    const n = String(publicBrand.name).trim()
    if (n !== brandConfig.name) {
      brandConfig.name = n
      changed = true
    }
  }
  if (typeof publicBrand.logo_url === 'string') {
    const next = publicBrand.logo_url.trim() || '/brand/logo.png'
    if (next !== brandConfig.logoUrl) {
      brandConfig.logoUrl = next
      changed = true
    }
  }
  return changed
}

// Subscribers — every mounted <BrandLogo> subscribes to a change-broadcast so
// it re-renders the moment applyPublicBrand() updates the config.
const logoSubscribers = new Set()
export function subscribeLogo(fn) {
  logoSubscribers.add(fn)
  return () => logoSubscribers.delete(fn)
}
function notifyLogos() {
  for (const fn of logoSubscribers) {
    try { fn() } catch { /* one bad subscriber must not break the rest */ }
  }
}

/**
 * enableLiveBrand — refetch /api/brand once, then subscribe to `brand:update`
 * socket pushes. Returns a cleanup function. Called ONCE from App.jsx.
 * Socket failures (dev, blocked) just leave the initial GET in place.
 */
export function enableLiveBrand() {
  let cancelled = false
  let socket = null

  fetch('/api/brand')
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => {
      if (cancelled || !b) return
      if (applyPublicBrand(b)) notifyLogos()
    })
    .catch(() => { /* keep static config */ })

  import('socket.io-client')
    .then(({ io }) => {
      if (cancelled) return
      socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })
      socket.on('brand:update', (b) => {
        if (applyPublicBrand(b)) notifyLogos()
      })
    })
    .catch(() => { /* socket unavailable — static config stands */ })

  return () => {
    cancelled = true
    try { if (socket) socket.disconnect() } catch { /* noop */ }
  }
}
