import React from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * ConfirmOrder (Frame 5) — v11f
 * --------------------------------------
 * Per user v11f (chef leaning MORE on the title):
 *   - Lower the owner image itself: top:0 → top:20.
 *   - Title stays at top:175 (already lower per v11e).
 *   - Net effect: chef hands now drape across nearly the entire title
 *     (41/42px = 98% overlap) → strong "leaning on the text" feel.
 *   - Title remains fully readable because it is painted on top
 *     (zIndex 3 > image's zIndex 1).
 *
 * Composition (top of the frame, centered):
 *   - Chef image (transparent bg, leaning forward, hands clasped) at
 *     top:20, 360x360, centered. Source content ends at y=308 of 566
 *     (54.4%). Scale = 360/566 = 0.636. Chef content rendered bottom
 *     = 20 + (308 * 0.636) = 20 + 196 ≈ 216. So chef's hands end at
 *     screen y≈216.
 *   - "Confirm Your Order" h1 (gold serif, 28px) at top:175. h1 spans
 *     y=175-217. Chef hands span y=20-216, so the overlap zone is
 *     y=175-216 → 41 of 42px of title height (98%). The chef appears
 *     to be leaning her whole upper body weight onto the gold letters.
 *     Gold text remains fully readable because it's painted on top.
 *   - NO subtitle (kept removed since v11d).
 *   - Cart item rows / qty steppers / total / bottom bar — preserved
 *     from v10.
 */
export default function ConfirmOrder({ onCancel, onPay, bgProps }) {
  const { items, total, addItem, removeItem, deleteItem } = useCart()
  const { hapticFeedback } = useTelegram()

  const handleMinus = (item) => {
    if (item.quantity <= 1) {
      deleteItem(item.id)
      hapticFeedback.notificationOccurred('warning')
    } else {
      removeItem(item.id)
      hapticFeedback.impactOccurred('light')
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg {...bgProps} forceBg="customer-served" blur={3} brightness={0.4} />

      <div
        className="frame-scroll"
        style={{
          position: 'relative',
          zIndex: 2,
          paddingBottom: 'calc(var(--bottom-bar-h) + var(--safe-bottom) + 24px)',
        }}
      >
        {/* ──────────────────────────────────────────────────────────
            HEADER COMPOSITION (v11c — per user's reference image)
            The user provided 2 reference images:
              (1) image-removebg-preview.png — chef leaning forward,
                  hands clasped in front, on transparent background.
              (2) pasted_image_1786051065717.png — target layout:
                  chef image sits in upper-center, DIRECTLY ABOVE the
                  "Confirm Your Order" title text. Her lower torso /
                  hands slightly overlap the top of the title text,
                  creating a layered "leaning over the title" effect.

            Composition:
              - Owner image is at the TOP of the screen, centered.
              - "Confirm Your Order" title sits IMMEDIATELY below her,
                overlapping slightly so she appears to lean over it.
              - Title text is in FRONT (higher z-index) so it remains
                fully readable even where her hands overlap.

            NOTE: This is NOT the same as v11b (which used pose-4 with
            a white board behind her). The user's reference image has
            NO board — just the chef on transparent background. The
            "leaning" illusion comes from her forward pose + the title
            text appearing right under her clasped hands.
        ────────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            // Total header height: with 360x360 image, chef content
            // ends at y≈196; title spans y=175-217. Header needs ~240px
            // to give breathing room below the title before cart items.
            height: 240,
            marginBottom: 16,
          }}
        >
          {/* (1) OWNER IMAGE — leaning forward, transparent background.
              Positioned in upper-center, per the user's reference
              image. Her hands/clasped fingers drape down toward the
              title text below. zIndex 1 = BEHIND the title.

              v11e: image enlarged AGAIN per user "make the owner
              image size bigger" (still felt small after v11d's 280).
              Grew 280 → 360. Re-computed overlap math:
                - Source PNG 441x566, chef content ends at y=308 (54.4%).
                - Scale = 360/566 = 0.636.
                - Chef content rendered bottom (from image top) = 196px.

              v11f: image LOWERED per user "lower the owner image also
              to make it feel it is leaning on the text". Moved
              top:0 → top:20. Now chef content ends at screen y≈216
              (20 + 196), which is 1px above the bottom of the title
              (y=217). The chef's hands drape across nearly the entire
              title text → strong "leaning on the title" feel.
              Title remains fully readable (zIndex 3 paints on top). */}
          <img
            src="/owner/pose-7-leaning-transparent.png"
            alt="Cafe owner leaning over your order"
            draggable={false}
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              // v11e: enlarged from 280 → 360 per user "bigger".
              width: 360,
              height: 360,
              objectFit: 'contain',
              objectPosition: 'top center',
              filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45))',
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* (2) TITLE BLOCK — "Confirm Your Order" sits immediately
              below the owner, with the top edge of the title slightly
              OVERLAPPED by the bottom of the owner image (her hands).
              The title paints on top (zIndex 3) so the text is always
              fully readable, even where her hands cross it.

              v11e: title LOWERED AGAIN per user "lower the confirm
              your order text" (still wanted it lower after v11d's 120).
              Moved from top:120 → top:175. Kept at 175 in v11f.
              Math with the bigger 360x360 image (v11f image top:20):
                - Chef hands end at screen y≈216 (20 + 196).
                - h1 (42px tall) at top:175 spans screen y=175-217.
                - Overlap zone y=175-216 → 41 of 42px (98%) of title
                  height is BEHIND the chef's hands. The chef appears
                  to be leaning her whole upper body weight onto the
                  gold "Confirm Your Order" letters, which remain
                  fully readable because the title paints on top
                  (zIndex 3 > image's zIndex 1).
              Subtitle REMOVED per user feedback ("remove 'Adjust
              quantities or remove items below' text") — kept removed. */}
          <div
            style={{
              position: 'absolute',
              top: 175,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 3,
              padding: '0 16px',
            }}
          >
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                fontWeight: 800,
                margin: 0,
                // Gold serif per user's reference image.
                color: 'var(--accent-gold)',
                letterSpacing: 0.3,
                textShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
              }}
            >
              Confirm Your Order
            </h1>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Your cart is empty.
            </p>
          </div>
        ) : (
          <>
            {items.map((item, i) => (
              <div
                key={item.id}
                className="item-row anim-slideInUp"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="item-info">
                  <div className="item-name-en">{item.nameEn}</div>
                  <div className="item-name-am">
                    {item.price} Br each · {item.nameAm}
                  </div>
                </div>

                <div className="qty-stepper">
                  <button
                    type="button"
                    className="qty-btn qty-minus"
                    aria-label={`Decrease ${item.nameEn}`}
                    onClick={() => handleMinus(item)}
                  >
                    −
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button
                    type="button"
                    className="qty-btn qty-plus"
                    aria-label={`Increase ${item.nameEn}`}
                    onClick={() => {
                      addItem({
                        id: item.id,
                        nameEn: item.nameEn,
                        nameAm: item.nameAm,
                        price: item.price,
                      })
                      hapticFeedback.impactOccurred('light')
                    }}
                  >
                    +
                  </button>
                </div>

                <div className="item-price" style={{ minWidth: 70, textAlign: 'right' }}>
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
          className="btn btn-danger"
          onClick={() => {
            hapticFeedback.impactOccurred('light')
            onCancel?.()
          }}
        >
          ← Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={items.length === 0}
          onClick={() => {
            hapticFeedback.impactOccurred('medium')
            onPay?.()
          }}
        >
          Pay {total} Br
        </button>
      </div>
    </div>
  )
}
