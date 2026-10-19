import React, { useEffect } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { useLang } from '../context/LangContext.jsx'
import { getCurrentCoords, distanceKmToAdama } from './AdamaGate.jsx'

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
    customerPhone,
    setCustomerName,
    setCustomerLocation,
    setCustomerPhone,
  } = useCart()
  const { hapticFeedback } = useTelegram()
  const { t, lang } = useLang()

  const [locating, setLocating] = React.useState(false)
  const [manualAddress, setManualAddress] = React.useState(
    customerLocation?.address || ''
  )
  // Adama-only enforcement (user request): the check happens HERE, at the
  // very end, after the customer shares name + location. When the captured
  // GPS places them outside the service radius the order is refused: a red
  // refusal notice replaces the success line and "Place Order" disables.
  const [outsideAdamaKm, setOutsideAdamaKm] = React.useState(null)

  const isDelivery = serviceType === 'delivery'
  const hasName = customerName.trim().length > 0
  const hasLocation =
    !isDelivery ||
    (customerLocation && (customerLocation.lat || customerLocation.address))

  // PHONE (user request): customers who type their address MANUALLY — no
  // GPS captured — must also leave a phone number so the driver can reach
  // them at the described spot. The field appears for delivery orders
  // without GPS coordinates and hides again once location is shared.
  const manualAddressRequired = isDelivery && !customerLocation?.lat
  const digitsPhone = (customerPhone || '').replace(/\D/g, '')
  const phoneValid = digitsPhone.length >= 9 && digitsPhone.length <= 13
  const phoneNeeded = manualAddressRequired && !phoneValid
  const canProceed =
    hasName &&
    hasLocation &&
    outsideAdamaKm === null &&
    !(manualAddressRequired && !phoneValid)

  const handleShareLocation = async () => {
    setLocating(true)
    hapticFeedback.impactOccurred('light')

    // GPS capture: Telegram-native requestLocation first (works on iOS
    // where navigator.geolocation is unavailable), browser API fallback.
    const coords = await getCurrentCoords()

    if (!coords) {
      setLocating(false)
      hapticFeedback.notificationOccurred('error')
      // eslint-disable-next-line no-alert
      alert(t('geolocationFailed'))
      return
    }

    // Adama verdict on the captured coordinates.
    const { inAdama, km } = distanceKmToAdama(coords.lat, coords.lon)
    setOutsideAdamaKm(inAdama ? null : Math.round(km))
    setCustomerLocation({
      lat: coords.lat,
      lon: coords.lon,
      address: manualAddress,
    })
    setLocating(false)
    hapticFeedback.notificationOccurred(inAdama ? 'success' : 'error')
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
      {/* DIM + lower brightness (user request: "make the background darker
          so it will be easy to type and see the buttons") — SmartCafeBg
          adds an extra solid dark layer when `dim` is set, and night mode
          stacks on top automatically. */}
      <SmartCafeBg blur={3} brightness={0.55} dim />

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
                  color: outsideAdamaKm !== null
                    ? 'var(--accent-red, #ff6b6b)'
                    : 'var(--accent-green)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {outsideAdamaKm !== null
                  ? `${t('outsideAdamaRefuse')} (${outsideAdamaKm} km)`
                  : t('locationCaptured')}
                {outsideAdamaKm === null && (
                  <span>
                    {' '}({customerLocation.lat.toFixed(4)},{' '}
                    {customerLocation.lon.toFixed(4)})
                  </span>
                )}
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

        {/* Phone number — REQUIRED only for delivery with a manual address */}
        {manualAddressRequired && (
          <div style={{ marginBottom: 20, border: '1px solid ' + (phoneValid ? 'transparent' : 'rgba(212,168,83,0.55)'), borderRadius: '14px', padding: '14px 16px' }}>
            <label htmlFor="cust-phone" style={{ display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, marginBottom: '8px', color: '#FFF8E7', letterSpacing: '.01em' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                📱 {t('yourPhone')}
                <span style={{ color: '#fff8e7aa', fontSize: 13, fontWeight: 500 }}>({t('phoneRequiredHint')})</span>
              </span>
            </label>
            <input
              id="cust-phone"
              type="tel"
              className="input-field"
              placeholder={t('phonePlaceholder')}
              value={customerPhone || ''}
              onChange={(e) => setCustomerPhone(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              inputMode="tel"
            />
            {(customerPhone || '').trim().length > 0 && phoneValid && (
              <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginTop: 4 }}>
                ✓ {t('phoneSaved')}
              </div>
            )}
            {(customerPhone || '').trim().length > 0 && !phoneValid && (
              <div style={{ fontSize: 11, color: 'var(--accent-red, #ff6b6b)', marginTop: 4 }}>
                {t('phoneInvalidHint')}
              </div>
            )}
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
          style={{
            minHeight: 54,
            // Pop off the dimmed backdrop: brighter gold surface + ring.
            boxShadow: canProceed
              ? '0 8px 22px rgba(255,170,0,0.4), 0 0 0 2px rgba(255,213,77,0.35)'
              : undefined,
          }}
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
