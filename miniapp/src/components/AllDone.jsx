import React from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * AllDone (Frame 4)
 * ------------------
 * "Your Order" summary. NO owner character on this frame.
 *
 * - Header: "Your Order" + item count
 * - Summary list: name, ×qty, line total (gold)
 * - Total line with gold border-top
 * - Bottom buttons: [← Add More]  [All Done ✓]
 */
export default function AllDone({ onAddMore, onDone, bgProps }) {
  const { items, total, itemCount } = useCart()
  const { hapticFeedback } = useTelegram()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg {...bgProps} blur={3} brightness={0.35} />

      <div
        className="frame-scroll"
        style={{
          position: 'relative',
          zIndex: 2,
          paddingBottom: 'calc(var(--bottom-bar-h) + var(--safe-bottom) + 24px)',
        }}
      >
        <div className="frame-header" style={{ paddingTop: 12 }}>
          <div className="title-block">
            <h1>Your Order</h1>
            <p>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · review before
              confirming
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: 28,
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
            <p style={{ margin: 0, fontSize: 14 }}>
              Your cart is empty. Add some items first!
            </p>
          </div>
        ) : (
          <>
            {items.map((item, i) => (
              <div
                key={item.id}
                className="summary-row anim-slideInUp"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="sum-name">
                  {item.nameEn}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    {item.nameAm}
                  </div>
                </div>
                <div className="sum-qty">×{item.quantity}</div>
                <div className="sum-total">
                  {item.price * item.quantity} Br
                </div>
              </div>
            ))}

            <div className="total-line">
              <div className="total-label">Total</div>
              <div className="total-value">{total} Br</div>
            </div>
          </>
        )}
      </div>

      <div className="bottom-bar">
        <button
          className="btn btn-secondary"
          onClick={() => {
            hapticFeedback.impactOccurred('light')
            onAddMore?.()
          }}
        >
          ← Add More
        </button>
        <button
          className="btn btn-primary"
          disabled={items.length === 0}
          onClick={() => {
            hapticFeedback.impactOccurred('medium')
            onDone?.()
          }}
        >
          All Done ✓
        </button>
      </div>
    </div>
  )
}
