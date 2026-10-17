import React from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { useLang } from '../context/LangContext.jsx'

/**
 * ConfirmOrder (Frame 4) — v12
 * --------------------------------------
 * Redesigned per the user's new spec:
 *   - Background: day-stall cafe scene (blurred outdoor counter).
 *   - Chef image at top, gold serif "Confirm Your Order" title below her,
 *     gold divider with chef-hat icon.
 *   - Single dark rounded card holds every cart line + total:
 *       [thumb] Title            (-) qty (+)          line total
 *               90 Br each · ...
 *   - Total row separated by a divider, gold total.
 *   - Bottom actions:
 *       Row 1: [＋ Add More (teal)]   [💳 Pay {total} Br → (gold)]
 *       Row 2:             [← Back]
 *   - + / − buttons bump the cart, total, and the Pay button amount live.
 */
export default function ConfirmOrder({ onAddMore, onPay, onBack, bgProps }) {
  const { items, total, addItem, removeItem, deleteItem } = useCart()
  const { hapticFeedback } = useTelegram()
  const { t, lang } = useLang()

  const primaryName = (item) => (lang === 'am' && item.nameAm ? item.nameAm : item.nameEn)
  const secondaryName = (item) => (lang === 'am' ? item.nameEn : item.nameAm)

  const handleMinus = (item) => {
    hapticFeedback.impactOccurred('light')
    if (item.quantity <= 1) {
      deleteItem(item.id)
      hapticFeedback.notificationOccurred('warning')
    } else {
      removeItem(item.id)
    }
  }

  const handlePlus = (item) => {
    hapticFeedback.impactOccurred('light')
    addItem({
      id: item.id,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      price: item.price,
    })
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Outdoor cafe stall photo — the one used across the app, per spec */}
      <SmartCafeBg {...bgProps} forceBg="day-stall" blur={3} brightness={0.42} />        <div className="frame-scroll no-bottom-bar"
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '5px 16px calc(var(--safe-bottom) + 22px)',
        }}
      >
        {/* ── HERO: chef above the gold title, divider with chef-hat ── */}
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 0 }}>
          {/* Big chef, bottom edge tucked slightly behind the title so she
              "leans" on it (reference screenshot). Negative bottom margin
              pulls the title up into her clasped-hands zone; the title's
              zIndex keeps the text readable.
              pose-7's drawing actually ends at canvas row ~307 of 566 (the
              lower half of the file is fully transparent), so the visible
              silhouette bottom lands at ~236px of the 436px box. Margin
              -200px sets the title right at her hands — closes the dead
              gap that previously pushed the order box far down the page. */}
          <img
            src="/owner/pose-7-leaning-transparent.png"
            alt="Chef confirming your order"
            draggable={false}
            style={{
              width: 282,
              height: 362,
              objectFit: 'contain',
              objectPosition: 'top center',
              filter: 'drop-shadow(0 5px 14px rgba(0,0,0,0.5))',
              userSelect: 'none',
              pointerEvents: 'none',
              margin: '0 auto -166px',
              display: 'block',
              position: 'relative',
              zIndex: 1,
            }}
          />
          <h1
            style={{
              position: 'relative',
              zIndex: 2,
              fontFamily: 'var(--font-display)',
              fontSize: 23.5,
              fontWeight: 800,
              margin: '0 0 6px',
              color: '#FFC107',
              letterSpacing: 0.3,
              textShadow: '0 2px 10px rgba(0,0,0,0.75)',
            }}
          >
            {t('confirmTitle')}
          </h1>
          <span aria-hidden>👨‍🍳</span>
          {/* Gold rules flanking a small chef-hat icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              maxWidth: 236,
              margin: '0 auto 10px',
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #FFC107)' }} />
              <span style={{ fontSize: 14.5 }} aria-hidden>👨‍🍳</span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #FFC107, transparent)' }} />

          </div>
        </div>

        {items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {t('confirmCartEmpty')}
            </p>
          </div>        ) : (
          /* ── ORDER SUMMARY CARD (scrollable) ── */          <div
            style={{
              background: 'rgba(15, 23, 30, 0.782)',
              borderRadius: 13,
              border: '1px solid rgba(255, 193, 7, 0.32)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              maxHeight: 285,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {items.map((item, i) => (
              <div
                key={item.id}
                className="anim-slideInUp"
                style={{                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 13px',
                    marginBottom: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    animationDelay: `${i * 45}ms`,

                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 19,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {item.icon || '🍽️'}
                </div>

                {/* Name + unit price */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 13, lineHeight: 1.2 }}>
                    {primaryName(item)}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1 }}>
                    {item.price} Br {t('each')} · {secondaryName(item)}
                  </div>
                </div>                {/* Circular qty stepper — dark minus, gold plus */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    aria-label={`${t('decreaseQty')} ${primaryName(item)}`}
                    onClick={() => handleMinus(item)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.16)',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontSize: 15,
                      lineHeight: 1,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13.5 }}>
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`${t('increaseQty')} ${primaryName(item)}`}
                    onClick={() => handlePlus(item)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#FFC107',
                      color: '#1a1a1a',
                      fontSize: 16,
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div
                  style={{
                    minWidth: 58,
                    textAlign: 'right',
                    color: '#FFC107',
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {item.price * item.quantity} Br
                </div>
              </div>
            ))}

            {/* ── TOTAL ROW (sticky) ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 13px',
                borderTop: '1px solid rgba(255,193,7,0.22)',
                /* Opaque background — the sticky Total used to be nearly
                   transparent (4% gold wash), so cart rows were visibly
                   scrolling behind the amount right as the customer reads
                   it. Solid dark, same tone as the card. */
                background: 'rgb(13, 20, 27)',
                position: 'sticky',
                bottom: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13.5 }} aria-hidden>📜</span>
                <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 13 }}>{t('total')}</span>
              </div>
              <span style={{ color: '#FFC107', fontWeight: 800, fontSize: 18.5 }}>
                {total} Br
              </span>
              <span style={{ fontSize: 16.5 }} aria-hidden>📜</span>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM ACTION BUTTONS (floating) ── */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 'calc(var(--safe-bottom) + 14px)',
          zIndex: 3,        }}
      >


        {/* Row 1: Add More + Pay */}
        <div style={{ display: 'flex', gap: 9 }}>
          <button
            type="button"
            className={items.length === 0 ? 'btn btn-secondary' : 'btn-teal'}
            style={{ flex: 1, minHeight: 44, borderRadius: 999 }}
            onClick={() => {
              hapticFeedback.impactOccurred('light')
              onAddMore?.()
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: '50%',
                  background: 'rgba(52,211,153,0.22)',
                  border: '1px solid rgba(110,231,183,0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#6EE7B7',
                }}
                aria-hidden
              >
                +
              </span>
              {t('addMoreShort')}
            </span>
          </button>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => {
              hapticFeedback.impactOccurred('medium')
              onPay?.()
            }}
            style={{
              flex: 1.15,
              minHeight: 44,
              borderRadius: 999,
              border: 'none',
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
              background: items.length === 0
                ? 'rgba(255,193,7,0.18)'
                : 'linear-gradient(135deg, #FFD54F 0%, #FFB300 100%)',
              color: '#1a1a1a',
              boxShadow: items.length === 0 ? 'none' : '0 4px 12px rgba(255,193,7,0.32)',
              opacity: items.length === 0 ? 0.7 : 1,
            }}
          >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                <span aria-hidden>💳</span>
                {t('payTotal').replace('{n}', total)}
                <span aria-hidden style={{ fontSize: 12.5 }}>→</span>
              </span>
          </button>

        </div>

        {/* Row 2: Back */}
        <button
          type="button"
          className="btn-back-pill"
          style={{ display: 'block', margin: '7px auto 0', minWidth: 140 }}
          onClick={() => {
            hapticFeedback.impactOccurred('light')
            onBack?.()
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
            <span aria-hidden>←</span>
            {t('backShort')}
          </span>
        </button>

      </div>
    </div>
  )
}
