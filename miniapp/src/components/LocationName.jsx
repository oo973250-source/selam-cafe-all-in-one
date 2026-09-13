import React, { useEffect, useState } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * LocationName (Frame 7)
 * -----------------------
 * Final frame before the order is submitted to the bot.
 *
 * - "Almost There!" header
 * - Name input (autoFocus)
 * - If delivery: location section
 *     - "Share my location" button (dashed border) -> navigator.geolocation
 *     - Manual address input below *   - Submit button: "🚗 Place Delivery Order" or "✓ Place Order"
 *   - Disabled until name (and location if delivery) are filled
 *   - When enabled: gold gradient
 *   - On submit: POST the order to /api/miniapp/orders (HTTP) with Telegram
 *     initData for server-side verification. The server saves the order,
 *     sends the confirmation message through the bot, and notifies staff.
 *
 *     IMPORTANT: We deliberately do NOT use tg.sendData() here. Telegram only
 *     delivers web_app_data for Mini Apps opened from a keyboard button —
 *     menu-button/link launches silently drop it, so the bot would never
 *     receive the order and no confirmation would ever be sent.
 */
export default function LocationName({ bgProps }) {
  const {
    serviceType,
    items,
    total,
    customerName,
    customerLocation,
    setCustomerName,
    setCustomerLocation,
    successfulPayments,
  } = useCart()
  const { tg, initData, hapticFeedback } = useTelegram()

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [locating, setLocating] = useState(false)
  const [manualAddress, setManualAddress] = useState(
    customerLocation?.address || ''
  )

  const isDelivery = serviceType === 'delivery'
  const hasName = customerName.trim().length > 0
  const hasLocation =
    !isDelivery ||
    (customerLocation && (customerLocation.lat || customerLocation.address))
  const canSubmit = hasName && hasLocation && !submitting

  const handleShareLocation = () => {
    if (!navigator?.geolocation) {
      // eslint-disable-next-line no-alert
      alert('Geolocation is not available on this device.')
      return
    }
    setLocating(true)
    hapticFeedback.impactOccurred('light')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          address: manualAddress,
        })
        setLocating(false)
        hapticFeedback.notificationOccurred('success')
      },
      (err) => {
        setLocating(false)
        hapticFeedback.notificationOccurred('error')
        // eslint-disable-next-line no-alert
        alert('Could not get your location. Please enter your address manually.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleAddressChange = (e) => {
    const v = e.target.value
    setManualAddress(v)
    setCustomerLocation({
      ...(customerLocation || {}),
      lat: customerLocation?.lat || null,
      lon: customerLocation?.lon || null,
      address: v,
    })
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError('')
    hapticFeedback.impactOccurred('medium')

    const payload = {
      type: 'cafe_order',
      at: new Date().toISOString(),
      serviceType,
      customer: {
        name: customerName.trim(),
        location: customerLocation,
      },
      items: items.map((i) => ({
        id: i.id,
        nameEn: i.nameEn,
        nameAm: i.nameAm,
        price: i.price,
        quantity: i.quantity,
      })),
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

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Order failed (${res.status})`)
      }

      hapticFeedback.notificationOccurred('success')

      // Show the in-app confirmation with the real ticket number.
      if (tg?.showAlert) {
        tg.showAlert(`Order received! Your ticket is #${data.orderId}. Check the chat for your confirmation message.`)
      } else {
        window.alert(`Order received! Your ticket is #${data.orderId}.`)
      }

      // If the bot could not message the user (never pressed Start), show a hint.
      if (data.confirmationSent === false) {
        if (tg?.showAlert) {
          tg.showAlert(data.warning || 'Order saved. Message the bot, then reopen to see confirmations.')
        } else {
          window.alert(data.warning || 'Order saved.')
        }
      }

      // Done — close the Mini App and return to the chat.
      setTimeout(() => {
        try { tg?.close?.() } catch { /* no-op */ }
      }, 800)
    } catch (e) {
      console.error('[order] submit failed:', e)
      setSubmitError(e.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
      hapticFeedback.notificationOccurred('error')
    }
  }

  // Auto-focus name input on mount
  const nameRef = React.useRef(null)
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg
        {...bgProps}
        forceBg={isDelivery ? 'night-taxi' : undefined}
        blur={3}
        brightness={0.35}
      />

      <div className="frame-scroll no-bottom-bar" style={{ position: 'relative', zIndex: 2 }}>
        <div className="frame-header" style={{ paddingTop: 12 }}>
          <div className="title-block">
            <h1>Almost There!</h1>
            <p>
              {isDelivery
                ? 'Where should we bring your order?'
                : 'Just need your name to finish up'}
            </p>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label className="input-label" htmlFor="cust-name">
            Your name
          </label>
          <input
            id="cust-name"
            ref={nameRef}
            type="text"
            className="input-field"
            placeholder="e.g. Selam or Abebe"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
        </div>

        {/* Location (delivery only) */}
        {isDelivery && (
          <div style={{ marginBottom: 20 }}>
            <label className="input-label">Delivery location</label>

            <button
              type="button"
              className="location-share-btn"
              onClick={handleShareLocation}
              disabled={locating}
              style={{ marginBottom: 12 }}
            >
              {locating ? '📍 Locating…' : '📍 Share my location'}
            </button>

            {customerLocation?.lat && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-green)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ✓ Location captured ({customerLocation.lat.toFixed(4)},{' '}
                {customerLocation.lon.toFixed(4)})
              </div>
            )}

            <input
              type="text"
              className="input-field"
              placeholder="Or enter your address manually (e.g. Bole Rd, Friendship Bldg)"
              value={manualAddress}
              onChange={handleAddressChange}
              maxLength={200}
              autoComplete="street-address"
            />
          </div>
        )}

        {/* Order summary mini-card */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}
          >
            <span>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
            <span>{serviceType === 'delivery' ? 'Delivery' : serviceType === 'dine_in' ? 'Dine in' : 'Takeaway'}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
            <span
              style={{
                color: 'var(--accent-gold)',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {total} Br
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          className={`btn btn-block ${canSubmit ? 'btn-primary anim-pulseGlow' : 'btn-secondary'}`}
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          style={{ minHeight: 54 }}
        >
          {submitting
            ? 'Placing order…'
            : isDelivery
            ? '🚗 Place Delivery Order'
            : '✓ Place Order'}
        </button>

        {submitError && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(196,69,54,0.12)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {submitError}
          </div>
        )}

        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
            marginTop: 12,
          }}
        >
          By placing this order you confirm the details above.
        </p>
      </div>
    </div>
  )
}
