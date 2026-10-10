// Telegram WebApp SDK wrapper (RULES #5)
// Single place that touches window.Telegram — everything else imports from here.

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp || null : null

export function initData() {
  try {
    return (tg && tg.initData) || ''
  } catch {
    return ''
  }
}

// RULES: call ready() + expand() on mount
export function initTelegram() {
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
  } catch {
    /* non-Telegram environment */
  }
  // Keep the app dark regardless of client theme — this is a dark-first admin panel.
  try {
    if (tg.colorScheme && tg.colorScheme !== 'dark' && tg.setHeaderColor) {
      tg.setHeaderColor('#141414')
    }
  } catch {
    /* older clients */
  }
}

export function haptic(kind = 'light') {
  try {
    if (kind === 'select') tg?.HapticFeedback?.selectionChanged()
    else if (kind === 'success' || kind === 'error' || kind === 'warning')
      tg?.HapticFeedback?.notificationOccurred(kind)
    else tg?.HapticFeedback?.impactOccurred(kind)
  } catch {
    /* noop */
  }
}

export function showAlert(message) {
  return new Promise((resolve) => {
    if (tg && typeof tg.showAlert === 'function') {
      try {
        tg.showAlert(message, () => resolve())
        return
      } catch {
        /* fall through */
      }
    }
    window.alert(message)
    resolve()
  })
}

export function showConfirm(message) {
  return new Promise((resolve) => {
    if (tg && typeof tg.showConfirm === 'function') {
      try {
        tg.showConfirm(message, (ok) => resolve(!!ok))
        return
      } catch {
        /* fall through */
      }
    }
    resolve(window.confirm(message))
  })
}

export function openLink(url) {
  if (tg && typeof tg.openLink === 'function') {
    try {
      tg.openLink(url)
      return
    } catch {
      /* fall through */
    }
  }
  window.open(url, '_blank', 'noopener')
}

export function openMap(lat, lng) {
  openLink(`https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`)
}

export function closeApp() {
  try {
    if (tg && typeof tg.close === 'function') tg.close()
  } catch {
    /* noop */
  }
}

// Optional: keep Telegram's own header back button in sync with our nav stack
export function bindBackButton(onBack) {
  if (!tg || !tg.BackButton) return
  try {
    tg.BackButton.onClick(onBack)
  } catch {
    /* noop */
  }
}

export function showBackButton(show) {
  if (!tg || !tg.BackButton) return
  try {
    show ? tg.BackButton.show() : tg.BackButton.hide()
  } catch {
    /* noop */
  }
}
