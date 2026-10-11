import { useEffect, useState } from 'react'
import { syncMenuFromServer } from '../data/menuData.js'

/**
 * useLiveMenu
 * -----------
 * Realtime menu sync for the customer Mini App. Two triggers refetch the
 * DB-backed menu (GET /api/menu + /api/menu/categories) and bump a version
 * counter so MainMenu / CategoryMenu re-render with fresh data:
 *
 *   1. socket.io `menu:update` events (the server emits one after every
 *      admin/in-bot menu write — near-instant),
 *   2. a 20s polling fallback (covers socket disconnects during deploy).
 *
 * `syncMenuFromServer()` merges server truth over the bundled static seed and
 * is what the menus already render, so the screens pick this up without any
 * changes to their render code beyond subscribing here.
 */
const POLL_MS = 20_000

export function useLiveMenu() {
  const [menuVersion, setMenuVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    const apply = async () => {
      try {
        await syncMenuFromServer()
        if (!cancelled) setMenuVersion((v) => v + 1)
      } catch {
        /* keep last known menu on failure */
      }
    }

    // Initial sync when any menu screen first mounts (works even before the
    // socket is connected — the HTTP refetch alone is enough).
    apply()

    // Realtime push — same-origin socket.io served by the all-in-one server.
    let socket = null
    try {
      // Lazy dynamic import keeps the app working even if socket.io-client
      // fails to load (old caches); the polling fallback still covers us.
      import('socket.io-client').then(({ io }) => {
        if (cancelled) return
        socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })
        socket.on('menu:update', apply)
      }).catch(() => { /* socket unavailable — polling only */ })
    } catch {
      /* socket unavailable — polling only */
    }

    // Polling fallback (also re-syncs if a push was missed).
    const poll = setInterval(apply, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(poll)
      try { if (socket) socket.disconnect() } catch { /* noop */ }
    }
  }, [])

  return menuVersion
}
