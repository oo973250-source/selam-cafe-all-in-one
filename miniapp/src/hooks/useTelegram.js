import { useEffect, useRef, useState } from 'react'

/**
 * useTelegram
 * ------------
 * Wraps window.Telegram.WebApp with graceful fallbacks so the app works
 * both inside Telegram and in a regular browser tab.
 *
 * Exposes:
 *   - tg            raw WebApp object (or null)
 *   - ready         boolean — true once tg.init was attempted
 *   - user          Telegram user object (or null)
 *   - userLanguage  'en' | 'am' | 'ru' | ...
 *   - closeApp()    closes the mini app (no-op in browser)
 *   - sendData(payload)   tg.sendData(JSON.stringify(payload))
 *   - showPopup(opts)     tg.showPopup wrapper (no-op in browser)
 *   - hapticFeedback      tg.HapticFeedback (no-op in browser)
 */
export function useTelegram() {
  const [tg, setTg] = useState(null)
  const [ready, setReady] = useState(false)
  const inited = useRef(false)

  useEffect(() => {
    if (inited.current) return
    inited.current = true

    const webApp = window?.Telegram?.WebApp || null

    if (webApp) {
      try {
        webApp.ready()
        webApp.expand()
        if (typeof webApp.setHeaderColor === 'function') {
          webApp.setHeaderColor('#1a0f0a')
        }
        if (typeof webApp.setBackgroundColor === 'function') {
          webApp.setBackgroundColor('#1a0f0a')
        }
        if (typeof webApp.enableClosingConfirmation === 'function') {
          webApp.enableClosingConfirmation()
        }
      } catch (e) {
        /* SDK may throw if called twice; ignore. */
      }
    }

    setTg(webApp)
    setReady(true)
  }, [])

  const user = tg?.initDataUnsafe?.user || null
  const userLanguage = user?.language_code || tg?.initDataUnsafe?.user?.language_code || 'en'

  const closeApp = () => {
    try {
      tg?.close?.()
    } catch (e) {
      /* no-op */
    }
  }

  const sendData = (payload) => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    try {
      if (tg?.sendData) {
        tg.sendData(data)
      } else {
        // Fallback for browser preview: log + persist locally so devs can verify.
        // eslint-disable-next-line no-console
        console.info('[useTelegram.sendData] (no Telegram SDK) payload:', data)
        try {
          const arr = JSON.parse(localStorage.getItem('cafe-orders') || '[]')
          arr.push({ at: Date.now(), payload: typeof payload === 'string' ? JSON.parse(payload) : payload })
          localStorage.setItem('cafe-orders', JSON.stringify(arr))
        } catch (_) {
          /* ignore */
        }
      }
    } catch (e) {
      /* no-op */
    }
  }

  const showPopup = (opts) => {
    return new Promise((resolve) => {
      try {
        if (tg?.showPopup) {
          tg.showPopup(opts, (id) => resolve(id))
        } else {
          // eslint-disable-next-line no-alert
          const ok = window.confirm(opts?.message || '')
          resolve(ok ? 'ok' : 'cancel')
        }
      } catch (e) {
        resolve(null)
      }
    })
  }

  const hapticFeedback = {
    impactOccurred: (style = 'light') => {
      try {
        tg?.HapticFeedback?.impactOccurred(style)
      } catch (_) { /* no-op */ }
    },
    notificationOccurred: (type = 'success') => {
      try {
        tg?.HapticFeedback?.notificationOccurred(type)
      } catch (_) { /* no-op */ }
    },
    selectionChanged: () => {
      try {
        tg?.HapticFeedback?.selectionChanged()
      } catch (_) { /* no-op */ }
    },
  }

  return {
    tg,
    ready,
    user,
    userLanguage,
    closeApp,
    sendData,
    showPopup,
    hapticFeedback,
  }
}
