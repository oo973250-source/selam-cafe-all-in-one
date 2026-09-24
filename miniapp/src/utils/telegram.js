/**
 * telegram.js
 * -----------
 * Small navigation helpers for the Telegram Mini App.
 *
 * A Mini App webview cannot navigate to another web app (e.g. the admin
 * dashboard at /admin) in-place — Telegram intercepts/ignores same-webview
 * navigations to different origins and `window.open` is unreliable inside
 * Telegram. The supported way is `window.Telegram.WebApp.openLink()`
 * (or openTelegramLink for telegram.me URLs), which opens the system
 * browser. Outside Telegram we fall back to window.open / location.
 */

function tg() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null
}

/**
 * Open an absolute URL in the system browser (works for /admin etc.).
 */
export function openTelegramLink(url) {
  const app = tg()
  try {
    if (app?.openLink) {
      app.openLink(url)
      return
    }
  } catch { /* fall through */ }
  try {
    window.open(url, '_blank', 'noopener')
  } catch {
    window.location.href = url
  }
}

/**
 * Absolute URL helper for same-origin paths (e.g. /admin).
 */
export function absoluteUrl(path) {
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
}
