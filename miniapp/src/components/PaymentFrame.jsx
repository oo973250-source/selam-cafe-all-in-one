import React, { useEffect, useState } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import BrandLogo from './BrandLogo.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import {
  initializePayment,
  verifyPayment,
  generateTxRef,
  openCheckout,
} from '../utils/chapa.js'

/**
 * PaymentFrame (Frame 6)
 * -----------------------
 * Four states: 'options' | 'processing' | 'success' | 'error'
 *
 * Trust ladder:
 *   Dine-in / Takeaway:
 *     - "Pay Full Amount"        always unlocked
 *     - "Pay 50 Br Deposit"      unlocked after 1 successful payment
 *     - "Pay at Counter/Table"   unlocked after 2 successful payments
 *   Delivery:
 *     - "Pay 50 Br Upfront"      always unlocked
 *     - "Pay on Delivery"        unlocked after 3 successful payments
 *       (shows progress like "2/3")
 */

const DEPOSIT_AMOUNT = 50 // Birr

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
      <BrandLogo size={34} />
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
  const { serviceType, items, total, successfulPayments, recordSuccessfulPayment } =
    useCart()
  const { hapticFeedback, user } = useTelegram()

  const [state, setState] = useState('options') // 'options' | 'processing' | 'success' | 'error'
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [pressedKey, setPressedKey] = useState(null)

  // Build the available payment methods based on service type + trust.
  const methods = (() => {
    if (serviceType === 'delivery') {
      return [
        {
          key: 'upfront',
          icon: '🪙',
          label: `Pay ${DEPOSIT_AMOUNT} Br Upfront`,
          desc: 'Pay a small deposit now, the rest on arrival',
          amount: DEPOSIT_AMOUNT,
          unlocked: true,
          progress: null,
        },
        {
          key: 'on-delivery',
          icon: '🚗',
          label: 'Pay on Delivery',
          desc: 'Pay the full amount when your order arrives',
          amount: total,
          unlocked: successfulPayments >= 3,
          progress: `${Math.min(successfulPayments, 3)}/3`,
        },
      ]
    }
    // Dine-in / Takeaway
    return [
      {
        key: 'full',
        icon: '💳',
        label: 'Pay Full Amount',
        desc: `Pay the full ${total} Br now`,
        amount: total,
        unlocked: true,
        progress: null,
      },
      {
        key: 'deposit',
        icon: '🪙',
        label: `Pay ${DEPOSIT_AMOUNT} Br Deposit`,
        desc: 'Reserve your order with a small deposit',
        amount: DEPOSIT_AMOUNT,
        unlocked: successfulPayments >= 1,
        progress: successfulPayments < 1 ? `${Math.min(successfulPayments, 1)}/1` : null,
      },
      {
        key: 'counter',
        icon: '🏪',
        label: serviceType === 'dine_in' ? 'Pay at Table' : 'Pay at Counter',
        desc: 'Pay in person when you arrive',
        amount: 0,
        unlocked: successfulPayments >= 2,
        progress: successfulPayments < 2 ? `${Math.min(successfulPayments, 2)}/2` : null,
      },
    ]
  })()

  // When entering success state, fire success haptic and record successful payment.
  useEffect(() => {
    if (state === 'success') {
      hapticFeedback.notificationOccurred('success')
      recordSuccessfulPayment()
    }
    if (state === 'error') {
      hapticFeedback.notificationOccurred('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const handlePickMethod = async (method) => {
    if (!method.unlocked) {
      hapticFeedback.notificationOccurred('warning')
      return
    }
    setSelectedMethod(method)
    setState('processing')
    setErrorMsg('')

    // For "pay on delivery" / "pay at counter", no online payment is required;
    // simulate a brief processing then succeed.
    if (method.amount === 0 || method.key === 'on-delivery' || method.key === 'counter') {
      // Simulate processing delay for visual continuity.
      await new Promise((r) => setTimeout(r, 1500))
      setState('success')
      return
    }

    // Online payment via Chapa
    const txRef = generateTxRef()
    const email = user?.email || (user?.id ? `user${user.id}@cafe.guest` : 'guest@cafe.guest')
    const firstName = user?.first_name || user?.username || 'Guest'

    const init = await initializePayment({
      amount: method.amount,
      email,
      firstName,
      txRef,
      description: `Cafe order (${items.length} items)`,
    })

    if (init.status !== 'success') {
      setErrorMsg(init.raw?.message || 'Payment initialization failed.')
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
      setErrorMsg(verification.raw?.message || 'Payment was not completed.')
      setState('error')
    }
  }

  // ---------------- OPTIONS ----------------
  if (state === 'options') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} forceBg="customer-served" blur={3} brightness={0.4} />
        <CornerLogo />
        <div className="frame-scroll no-bottom-bar" style={{ position: 'relative', zIndex: 2 }}>
          <div className="frame-header" style={{ paddingTop: 12, paddingRight: 60 }}>
            <div className="title-block">
              <h1>Payment</h1>
              <p>Choose how you'd like to pay</p>
            </div>
          </div>

          {/* Order summary card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Order total
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: 18 }}>
                {total} Br
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 8,
              }}
            >
              {items.length} {items.length === 1 ? 'item' : 'items'} ·{' '}
              {serviceType === 'dine_in'
                ? 'Dine in'
                : serviceType === 'takeaway'
                ? 'Takeaway'
                : 'Delivery'}
            </div>
          </div>

          {/* Method buttons */}
          {methods.map((m) => {
            const isLocked = !m.unlocked
            return (
              <button
                key={m.key}
                type="button"
                disabled={isLocked}
                onTouchStart={() => !isLocked && setPressedKey(m.key)}
                onTouchEnd={() => setPressedKey(null)}
                onMouseDown={() => !isLocked && setPressedKey(m.key)}
                onMouseUp={() => setPressedKey(null)}
                onMouseLeave={() => setPressedKey(null)}
                onClick={() => handlePickMethod(m)}
                className={`method-btn ${isLocked ? 'is-locked' : ''} ${
                  pressedKey === m.key ? 'is-pressed' : ''
                }`}
              >
                <span className="m-icon">{m.icon}</span>
                <span className="m-text">
                  <span className="m-label">
                    {m.label}
                    {isLocked && <span aria-hidden> 🔒</span>}
                    {m.progress && (
                      <span className="m-progress">{m.progress}</span>
                    )}
                  </span>
                  <span className="m-desc">{m.desc}</span>
                </span>
                {!isLocked && <span className="m-arrow">→</span>}
              </button>
            )
          })}

          {/* Trust hint */}
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(212,168,83,0.05)',
              border: '1px dashed var(--border-subtle)',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {successfulPayments === 0
              ? '🔒 Complete your first payment to unlock more options.'
              : `✓ You've made ${successfulPayments} successful payment${successfulPayments === 1 ? '' : 's'}. More options unlock as you order.`}
          </div>
        </div>
      </div>
    )
  }

  // ---------------- PROCESSING ----------------
  if (state === 'processing') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} forceBg="customer-served" blur={4} brightness={0.3} />
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
            Processing your payment…
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {selectedMethod?.label}
          </p>
          <p
            style={{
              color: 'var(--accent-gold)',
              fontSize: 18,
              fontWeight: 700,
              margin: '8px 0 0',
            }}
          >
            {selectedMethod?.amount || 0} Br
          </p>
        </div>
      </div>
    )
  }

  // ---------------- SUCCESS ----------------
  if (state === 'success') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} forceBg="customer-served" blur={4} brightness={0.4} />
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
            Payment Successful!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {selectedMethod?.label}
          </p>
          <p
            style={{
              color: 'var(--accent-gold)',
              fontSize: 22,
              fontWeight: 800,
              margin: '8px 0 28px',
            }}
          >
            {selectedMethod?.amount || 0} Br
          </p>

          <button
            className="btn btn-primary btn-block"
            style={{ maxWidth: 280 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              onSuccess?.()
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    )
  }

  // ---------------- ERROR ----------------
  // state === 'error'
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg {...bgProps} forceBg="customer-served" blur={4} brightness={0.3} />
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
        >
          Payment Failed
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
          {errorMsg || 'Something went wrong. Please try again.'}
        </p>
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              setState('options')
              setErrorMsg('')
            }}
          >
            ← Back
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              onError?.()
            }}
          >
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  )
}
