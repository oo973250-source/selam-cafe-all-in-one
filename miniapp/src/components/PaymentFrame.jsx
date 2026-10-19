import React, { useEffect, useState } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import BrandLogo from './BrandLogo.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { useLang } from '../context/LangContext.jsx'
import {
  initializePayment,
  verifyPayment,
  generateTxRef,
  openCheckout,
} from '../utils/chapa.js'

/**
 * PaymentFrame (Frame 6) — SIMPLIFIED (user request: "remove the payment
 * choose like pay 50 birr or at the counter ... no need for that page")
 * -------------------------------------------------------------------
 * The old trust-ladder options page (Pay 50 Br deposit / Pay at Counter /
 * Pay on Delivery, unlock counters, etc.) is REMOVED. This frame now
 * auto-pays the FULL order total through the same Chapa pipeline (mock
 * mode without live keys) and then submits the order:
 *
 *   'processing' (arrows fly) → 'success' → submitOrder → ticket alert
 *                          ↘ 'error' (Back retries, Cancel aborts)
 */

/**
 * CornerLogo
 * -----------
 * Small brand badge pinned to the top-right corner of every Payment
 * state. Per user request v11g: "just add the logo in the top right
 * corner". Uses the same circular white-badge pattern as ServiceChoice
 * so the brand mark reads consistently across the app.
 */
function CornerLogo() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(60, 40, 10, 0.22), 0 0 0 1px rgba(212, 168, 83, 0.4)',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <BrandLogo size={34} circle />
    </div>
  )
}

function ArrowFlyRight({ delay, color = '#D4A853' }) {
  return (
    <div
      className="arrow-fly"
      style={{
        animation: `arrowFlyRight 1.4s ease-in-out infinite`,
        animationDelay: `${delay}ms`,
        color,
        fontSize: 28,
      }}
    >
      →
    </div>
  )
}

function Checkmark() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 25 L21 36 L40 14"
        stroke="var(--accent-green)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 50,
          strokeDashoffset: 50,
          animation: 'checkmark 600ms ease 200ms forwards',
        }}
      />
    </svg>
  )
}

export default function PaymentFrame({ onSuccess, onError, bgProps }) {
  const {
    serviceType,
    items,
    total,
    successfulPayments,
    recordSuccessfulPayment,
    customerName,
    customerLocation,
    customerPhone,
  } = useCart()
  const { tg, initData, hapticFeedback, user } = useTelegram()
  const { t } = useLang()

  const [state, setState] = useState('processing') // 'processing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [orderWarning, setOrderWarning] = useState('')
  const orderSubmittedRef = React.useRef(false)
  const paymentStartedRef = React.useRef(false)

  // New flow: payment FIRST, then the order. Once payment succeeds we POST
  // the order to /api/miniapp/orders (HTTP, initData-verified) and the server
  // messages the customer with the ticket. We deliberately do NOT use
  // tg.sendData() — the bot only receives web_app_data for keyboard-launched
  // Mini Apps, so menu-button orders would never arrive.
  const submitOrder = async () => {
    if (orderSubmittedRef.current) return
    orderSubmittedRef.current = true

    const payload = {
      type: 'cafe_order',
      at: new Date().toISOString(),
      serviceType,
      customer: {
        name: customerName.trim(),
        location: customerLocation,
        // Delivery orders with a manually-typed address carry a phone so
        // the driver can reach the described spot (server: orders.customer_phone).
        phone: (customerPhone || '').trim() || null,
      },
      items: items.map((i) => ({
        id: i.id,
        nameEn: i.nameEn,
        nameAm: i.nameAm,
        price: i.price,
        quantity: i.quantity,
      })),
      // Server re-checks availability; items already localized.
      total,
      trustLevel: successfulPayments,
    }

    try {
      const res = await fetch('/api/miniapp/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, order: payload }),
      })
      const data = await res.json().catch(() => ({}))

      // Server-side blocklist gate (Task 4).
      if (res.status === 403 && data.blocked) {
        setOrderWarning(t('blockedTitle') + ' — ' + t('blockedMessage'))
        return
      }

      // Section 5/6 server gates — each carries a friendly backend-written
      // message; fall back to a sensible default per code.
      // 429 = order limit reached (kitchen at capacity)
      if (res.status === 429 && (data.order_limit || data.error === 'order limit reached')) {
        setOrderWarning(data.message || t('orderLimitReachedMsg'))
        return
      }

      // 429 rate_limited = order flood guard: >10 orders in one minute were
      // blocked server-side and every open order that user still had was
      // automatically cancelled (the admin queue sees them flip live to
      // 'cancelled').
      if (res.status === 429 && (data.rate_limited || data.error === 'too many orders')) {
        setOrderWarning(data.message || t('tooManyOrdersMsg'))
        return
      }

      // 409 outside_adama = server Adama-radius gate: the shared GPS in
      // the order is outside the service radius — refuse with the message.
      if (res.status === 409 && (data.outside_adama || data.error === 'delivery outside adama')) {
        setOrderWarning(data.message || t('outsideAdamaRefuse'))
        return
      }

      // 409 = delivery globally unavailable OR a no-delivery category
      if (res.status === 409 && (data.delivery_unavailable || data.no_delivery || data.error === 'delivery unavailable')) {
        setOrderWarning(
          data.message ||
            t('categoryNoDeliveryMsg') ||
            'Delivery is currently unavailable. Please choose another ordering method.',
        )
        return
      }
      // 409 = item or category no longer available/unhidden
      if (res.status === 409 && (data.item_unavailable || data.error === 'item unavailable' || data.error === 'category unavailable')) {
        setOrderWarning(data.message || t('itemUnavailableMsg'))
        return
      }
      if (res.status === 503 && data.closed) {
        setOrderWarning(data.reason || t('storeClosedMsg'))
        return
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Order failed (${res.status})`)
      }

      const code = `MC-${String(data.orderId).padStart(4, '0')}`
      const alertText = `${t('orderReceivedTitle')}\n\n${t('yourTicketIs').replace('{n}', code)}\n${t('checkChat')}`
      if (tg?.showAlert) {
        tg.showAlert(alertText)
      } else {
        window.alert(alertText)
      }

      // If the bot could not message the user (never pressed Start), show a hint.
      if (data.confirmationSent === false) {
        setOrderWarning(data.warning || t('orderSavedWarning'))
      }

      // Done — close the Mini App and return to the chat.
      setTimeout(() => {
        try { tg?.close?.() } catch { /* no-op */ }
      }, 900)
    } catch (e) {
      console.error('[order] submit failed:', e)
      setOrderWarning(e.message || t('submitFailed'))
    }
  }

  // When entering success state: haptic, record trust, then submit the order.
  useEffect(() => {
    if (state === 'success') {
      hapticFeedback.notificationOccurred('success')
      recordSuccessfulPayment()
      submitOrder()
    }
    if (state === 'error') {
      hapticFeedback.notificationOccurred('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // AUTO-PAY the full total (no method picker): the frame mounts inside
  // 'processing' and pays immediately through the same Chapa pipeline.
  const payFull = async () => {
    if (paymentStartedRef.current) return
    paymentStartedRef.current = true
    setErrorMsg('')

    const txRef = generateTxRef()
    const email = user?.email || (user?.id ? `user${user.id}@cafe.guest` : 'guest@cafe.guest')
    const firstName = user?.first_name || user?.username || 'Guest'

    // Small beat so the flying-arrows animation reads before it resolves.
    await new Promise((r) => setTimeout(r, 700))

    const init = await initializePayment({
      amount: total,
      email,
      firstName,
      txRef,
      description: `Cafe order (${items.length} items)`,
    })

    if (init.status !== 'success') {
      setErrorMsg(init.raw?.message || t('paymentInitFailed'))
      setState('error')
      return
    }

    // If we got a checkout URL, open it (Telegram or browser) and verify.
    if (init.checkoutUrl) {
      await openCheckout(init.checkoutUrl)
    }

    // Verify (in mock mode this just simulates success).
    const verification = await verifyPayment(txRef)
    if (verification.paid) {
      setState('success')
    } else {
      setErrorMsg(verification.raw?.message || t('paymentNotCompleted'))
      setState('error')
    }
  }

  useEffect(() => {
    payFull()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- PROCESSING ----------------
  if (state === 'processing') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} blur={2} brightness={0.7} />
        <CornerLogo />
        <div
          className="frame-scroll no-bottom-bar"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            textAlign: 'center',
          }}
        >
          <div className="arrow-track" style={{ maxWidth: 280 }}>
            <ArrowFlyRight delay={0} />
            <ArrowFlyRight delay={200} color="#E8763A" />
            <ArrowFlyRight delay={400} color="#FFF8F0" />
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              margin: '16px 0 8px',
              color: 'var(--text-primary)',
            }}
          >
            {t('paymentProcessing')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {t('payFull')}
          </p>
        </div>
      </div>
    )
  }

  // ---------------- SUCCESS ----------------
  if (state === 'success') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} blur={2} brightness={0.8} />
        <CornerLogo />
        <div
          className="frame-scroll no-bottom-bar"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div className="anim-paymentSuccess">
            <div className="success-circle">
              <Checkmark />
            </div>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 700,
              margin: '20px 0 8px',
              color: 'var(--accent-green)',
            }}
          >
            {t('paymentSuccess')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {t('payFull')}
          </p>

          {orderWarning && (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 12,
                maxWidth: 300,
                margin: '0 0 16px',
                textAlign: 'center',
              }}
            >
              {orderWarning}
            </p>
          )}

          <button
            className="btn btn-primary btn-block"
            style={{ maxWidth: 280 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              try { tg?.close?.() } catch { /* no-op */ }
              onSuccess?.()
            }}
          >
            {t('continue')}
          </button>
        </div>
      </div>
    )
  }

  // ---------------- ERROR ----------------
  // state === 'error'
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg {...bgProps} blur={2} brightness={0.7} />
      <CornerLogo />
      <div
        className="frame-scroll no-bottom-bar"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(196,69,54,0.12)',
            border: '2px solid var(--accent-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            color: 'var(--accent-red)',
          }}
        >
          ✕
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            margin: '16px 0 8px',
            color: 'var(--accent-red)',
          }}
        >            {t('paymentFailed')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
          {errorMsg || t('paymentErrorDefault')}
        </p>
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              // The options page no longer exists — Back RETRIES the payment.
              paymentStartedRef.current = false
              setState('processing')
              setErrorMsg('')
              setTimeout(() => payFull(), 200)
            }}
          >
            {t('back')}
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              onError?.()
            }}
          >
            {t('cancelOrder')}
          </button>
        </div>
      </div>
    </div>
  )
}
