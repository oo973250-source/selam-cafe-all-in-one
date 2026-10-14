import React, { useEffect } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { useLang } from '../context/LangContext.jsx'

/**
 * LocationName (Frame 5)
 * -----------------------
 * "Almost There!" — collect the customer's details BEFORE payment:
 *   - Name input (required for every order type)
 *   - If delivery: "Share my location" button (geolocation) + manual address
 *   - "✓ Place Order" button — enabled once the required fields are filled.
 *     It does NOT submit the order; it hands off to the Payment frame,
 *     where payment is taken first and the order is submitted afterwards.
 */
export default function LocationName({ bgProps, onPlaceOrder }) {
  const {
    serviceType,
    items,
    total,
    customerName,
    customerLocation,
    setCustomerName,
    setCustomerLocation,
  } = useCart()
  const { hapticFeedback } = useTelegram()
  const { t, lang } = useLang()

  const [locating, setLocating] = React.useState(false)
  const [manualAddress, setManualAddress] = React.useState(
    customerLocation?.address || ''
  )

  const isDelivery = serviceType === 'delivery'
  const hasName = customerName.trim().length > 0
  const hasLocation =
    !isDelivery ||
    (customerLocation && (customerLocation.lat || customerLocation.address))
  const canProceed = hasName && hasLocation

  const handleShareLocation = () => {
    if (!navigator?.geolocation) {
      // eslint-disable-next-line no-alert
      alert(t('geolocationUnavailable'))
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
      () => {
        setLocating(false)
        hapticFeedback.notificationOccurred('error')
        // eslint-disable-next-line no-alert
        alert(t('geolocationFailed'))
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

  const handlePlaceOrder = () => {
    if (!canProceed) return
    hapticFeedback.impactOccurred('medium')
    onPlaceOrder?.()
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
        forceBg={isDelivery ? 'night-taxi' : 'day-stall'}
        blur={3}
        brightness={0.35}
      />

      <div className="frame-scroll no-bottom-bar" style={{ position: 'relative', zIndex: 2 }}>
        <div className="frame-header" style={{ paddingTop: 12 }}>
          <div className="title-block">
            <h1>{t('almostThere')}</h1>
            <p>
              {isDelivery ? t('deliveryWhere') : t('nameOnly')}
            </p>
          </div>
        </div>

        {/* Name (required) */}
        <div style={{ marginBottom: 20, border: '1px solid ' + (hasName ? 'transparent' : 'rgba(212,168,83,0.55)'), borderRadius: '14px', padding: '14px 16px' }}>
          <label htmlFor="cust-name" style={{ display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, marginBottom: '8px', color: '#FFF8E7', letterSpacing: '.01em' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {t('yourName')}
              <span style={{ color: '#fff8e7aa', fontSize: 13, fontWeight: 500 }}>({t('nameRequiredHint')})</span>
            </span>
          </label>
          <input
            id="cust-name"
            ref={nameRef}
            type="text"
            className="input-field"
            placeholder={t('namePlaceholder')}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
          {hasName && (
            <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginTop: 4 }}>
              ✓ {t('nameSaved')}
            </div>
          )}
        </div>

        {/* Location (delivery only) */}
        {isDelivery && (
          <div style={{ marginBottom: 20 }}>
            <label className="input-label">{t('deliveryLocation')}</label>

            <button
              type="button"
              className="location-share-btn"
              onClick={handleShareLocation}
              disabled={locating}
              style={{ marginBottom: 12 }}
            >
              {locating ? t('locating') : t('shareLocation')}
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
                {t('locationCaptured')} ({customerLocation.lat.toFixed(4)},{' '}
                {customerLocation.lon.toFixed(4)})
              </div>
            )}

            <input
              type="text"
              className="input-field"
              placeholder={t('addressPlaceholder')}
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
              {items.length} {items.length === 1 ? t('item') : t('items')}
            </span>
            <span>
              {serviceType === 'delivery'
                ? t('deliveryShort')
                : serviceType === 'dine_in'
                ? t('dineInShort')
                : t('takeawayShort')}
            </span>
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
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t('total')}</span>
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

        {/* Proceed to payment */}
        <button
          type="button"
          className={`btn btn-block ${canProceed ? 'btn-primary anim-pulseGlow' : 'btn-secondary'}`}
          disabled={!canProceed}
          onClick={handlePlaceOrder}
          style={{ minHeight: 54 }}
        >
          {t('placeOrder')}
        </button>

        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
            marginTop: 12,
          }}
        >
          {t('byConfirming')}
        </p>
      </div>
    </div>
  )
}
