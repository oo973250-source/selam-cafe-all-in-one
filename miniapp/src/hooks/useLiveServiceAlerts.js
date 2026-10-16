import { useEffect, useRef } from 'react'
import { useTelegram } from './useTelegram.js'
import { useLang } from '../context/LangContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { menuData, syncMenuFromServer } from '../data/menuData.js'

/**
 * useLiveServiceAlerts
 * --------------------
 * Customer-facing realtime alerts for ADMIN-side availability switches.
 *
 * The admin Mini App can flip two kinds of switches at any moment:
 *   • Delivery toggle (Page 7)  → server emits `service:update`
 *                                 ({ delivery_available: bool }) to the
 *                                 `customers` room (admin-miniapp.js).
 *   • Item availability toggle  → server emits `menu:update` (menu.js).
 *
 * Both used to be silent for customers — delivery only muted on the next
 * service screen load, out-of-stock only shown if she happened to reopen
 * the item list. This hook bridges those pushes into native Telegram
 * popups (tg.showAlert, window.alert fallback):
 *
 *   delivery off (ON→OFF edge only) → t('deliveryUnavailableMsg')
 *   cart item(s) just became unavailable → t('itemUnavailableMsg')
 *
 * The socket also `emit('customers')`-joins the customers room, which the
 * other miniapp sockets never did — brand/menu pushes only worked via the
 * 20s polling fallback until now.
 *
 * Falls back to no-op behavior outside Telegram / when sockets are blocked.
 */
export function useLiveServiceAlerts() {
  const { tg } = useTelegram()
  const { t, lang } = useLang()
  const { items } = useCart() // cart contents (for the out-of-stock alert)

  // Refs so socket handlers read fresh values without re-subscribing.
  const tgRef = useRef(tg)
  tgRef.current = tg
  const tRef = useRef(t)
  tRef.current = t
  const langRef = useRef(lang)
  langRef.current = lang
  const cartRef = useRef(items)
  cartRef.current = items

  useEffect(() => {
    let cancelled = false
    let socket = null

    const alert = (msg) => {
      try {
        const app = tgRef.current
        if (app?.showAlert) app.showAlert(msg)
        else window.alert(msg)
      } catch {
        try {
          window.alert(msg)
        } catch {
          /* nothing left to do */
        }
      }
    }

    // Flat set of ids of every currently-AVAILABLE menu item
    // (any section → categories → items with available !== false).
    const availableIds = () => {
      const ids = new Set()
      try {
        for (const section of Object.values(menuData || {})) {
          for (const cat of section?.categories || []) {
            for (const item of cat?.items || []) {
              if (item?.available !== false) ids.add(item.id)
            }
          }
        }
      } catch {
        /* treat as unknown → empty set */
      }
      return ids
    }

    const displayName = (item) =>
      (langRef.current === 'am' && item.nameAm) || item.nameEn || item.name || item.id

    let deliveryOff = false

    // Initial delivery state (GET /api/miniapp/intake) so we only pop on a
    // genuine ON→OFF edge, never on the socket echo of the current state.
    fetch('/api/miniapp/intake')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) deliveryOff = d.delivery_available === false
      })
      .catch(() => {})

    try {
      import('socket.io-client')
        .then(({ io }) => {
          if (cancelled) return
          socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })
          // Join the customers room (server contract — server/index.js):
          // required to receive service:update / menu:update / brand:update.
          socket.emit('customers')

          // ── Delivery toggle popup ──────────────────────────────────────
          socket.on('service:update', (s) => {
            const off = s?.delivery_available === false
            if (off && !deliveryOff) {
              alert(tRef.current('deliveryUnavailableMsg') ||
                'Delivery is currently unavailable. Please choose another ordering method.')
            }
            deliveryOff = off
          })

          // ── Item-availability popup (cart-aware) ───────────────────────
          // menu:update fires after every admin menu write; only alert for
          // items the customer has in her cart that JUST became unavailable.
          socket.on('menu:update', async () => {
            const before = availableIds()
            try {
              await syncMenuFromServer()
            } catch {
              return // keep last known menu
            }
            const after = availableIds()
            const cart = Array.isArray(cartRef.current) ? cartRef.current : []
            const newlyGone = cart.filter((i) => before.has(i.id) && !after.has(i.id))
            if (!newlyGone.length) return
            const names = newlyGone.map(displayName).join(', ')
            alert(
              (tRef.current('itemUnavailableMsg') || '{n} is currently unavailable').replace(
                '{n}',
                names
              )
            )
          })
        })
        .catch(() => {
          /* socket unavailable — silent fallback */
        })
    } catch {
      /* socket unavailable — silent fallback */
    }

    return () => {
      cancelled = true
      try {
        socket?.disconnect()
      } catch {
        /* noop */
      }
    }
  }, [])
}
