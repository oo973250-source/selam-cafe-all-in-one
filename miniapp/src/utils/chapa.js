/**
 * chapa.js
 * --------
 * Calls our own backend proxy (/api/payment/*) instead of Chapa directly.
 * The proxy holds the secret key server-side.
 *
 * In the all-in-one setup, the proxy is at the SAME origin as the Mini App,
 * so we can use relative URLs ("/api/payment/...").
 *
 * Falls back to mock mode if VITE_API_BASE is not set (for local UI testing).
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * Generate a unique transaction reference.
 * Format: cafe-<timestamp>-<random>
 */
export function generateTxRef() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `cafe-${ts}-${rand}`
}

/**
 * Initialize a Chapa payment session via our backend proxy.
 */
export async function initializePayment({
  amount,
  email,
  firstName,
  lastName = '',
  txRef,
  description = 'Cafe order',
}) {
  const ref = txRef || generateTxRef()

  // ---------- Mock mode (no proxy configured) ----------
  if (!API_BASE) {
    console.info('[chapa] mock initializePayment -> ', { amount, email, firstName, ref })
    await new Promise((r) => setTimeout(r, 1200))
    return {
      status: 'success',
      txRef: ref,
      checkoutUrl: null,
      raw: { mocked: true },
    }
  }

  // ---------- Real call via proxy ----------
  try {
    const res = await fetch(`${API_BASE}/api/payment/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        email,
        firstName,
        lastName,
        txRef: ref,
        description,
      }),
    })
    const data = await res.json()
    return {
      status: data.status,
      txRef: data.txRef || ref,
      checkoutUrl: data.checkoutUrl,
      raw: data,
    }
  } catch (err) {
    return {
      status: 'failed',
      txRef: ref,
      checkoutUrl: null,
      raw: { error: String(err) },
    }
  }
}

/**
 * Verify a Chapa payment via our backend proxy.
 */
export async function verifyPayment(txRef) {
  if (!API_BASE) {
    console.info('[chapa] mock verifyPayment -> ', txRef)
    await new Promise((r) => setTimeout(r, 900))
    return { status: 'success', paid: true, raw: { mocked: true } }
  }

  try {
    const res = await fetch(`${API_BASE}/api/payment/verify/${txRef}`)
    const data = await res.json()
    return {
      status: data.status,
      paid: data.paid,
      raw: data,
    }
  } catch (err) {
    return { status: 'failed', paid: false, raw: { error: String(err) } }
  }
}

/**
 * Open the Chapa checkout page (or simulate success in mock mode).
 * Returns true if the user completed payment, false otherwise.
 */
export async function openCheckout(checkoutUrl) {
  if (!checkoutUrl) {
    // Mock mode — just simulate a successful return.
    await new Promise((r) => setTimeout(r, 600))
    return true
  }
  // In Telegram Mini App, opening an external URL requires tg.openLink.
  // In a browser, fall back to opening in a new tab.
  try {
    const tg = window?.Telegram?.WebApp
    if (tg?.openLink) {
      tg.openLink(checkoutUrl)
    } else {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
    }
    return true
  } catch (_) {
    return false
  }
}
