import React, { useMemo } from 'react'
import SmartCafeBg from './SmartCafeBg.jsx'
import CafeLogo from './CafeLogo.jsx'
import { useCart } from '../context/CartContext.jsx'
import { menuData } from '../data/menuData.js'
import { useTelegram } from '../hooks/useTelegram.js'

/**
 * CategoryMenu (Frame 3)
 * ----------------------
 * Lists items for the currently-selected category.
 *
 * - Cafe logo on the LEFT side, levitating (per user v11: replace the
 *   owner image with the cafe logo, keep the float animation).
 * - Header shows: category icon + nameEn + nameAm + item count.
 * - Each row: nameEn, nameAm, price (gold), +/- quantity stepper.
 *   - The minus button only appears when qty > 0.
 *   - Plus button is a gold circle.
 * - Items stagger in with 80ms delay.
 * - Bottom bar: [<- Back]  [Next ->]
 */
export default function CategoryMenu({ onBack, onNext, bgProps }) {
  const { currentCategory, items, addItem, removeItem } = useCart()
  const { hapticFeedback } = useTelegram()

  // Resolve items for the active category.
  const categoryItems = useMemo(() => {
    if (!currentCategory) return []
    const section = menuData[currentCategory.sectionKey]
    if (!section) return []
    const cat = section.categories.find((c) => c.id === currentCategory.id)
    return cat?.items || []
  }, [currentCategory])

  if (!currentCategory) {
    // Defensive: if no category was selected (e.g. user refreshed here),
    // bounce back to main menu.
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <SmartCafeBg {...bgProps} />
        <div className="frame-scroll" style={{ position: 'relative', zIndex: 2 }}>
          <p>Please pick a category first.</p>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    )
  }

  const getQty = (id) => items.find((i) => i.id === id)?.quantity || 0

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg {...bgProps} blur={3} brightness={0.35} />

      <div
        className="frame-scroll"
        style={{ position: 'relative', zIndex: 2, paddingBottom: 'calc(var(--bottom-bar-h) + var(--safe-bottom) + 24px)' }}
      >
        {/* Header — cafe logo on the LEFT, levitating.
            Replaces the owner character (per user v11). The logo sits
            in a circular white badge with a gold ring (matches Frame 1
            and Frame 2 logo treatment), and the badge carries the
            `anim-floatSlow` class so it gently levitates at the same
            cadence the owner used to (3s ease-in-out infinite).
            v11b: shrunk from 80x80 badge / 64 logo → 56x56 badge / 42
            logo. The user said "made the logo a bit bigger then i
            expected" — smaller is the "perfect size". */}
        <div className="frame-header">
          <div className="owner-chip left" style={{ width: 56, height: 56 }}>
            <div
              className="anim-floatSlow"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.96)',
                boxShadow:
                  '0 3px 10px rgba(60, 40, 10, 0.26), 0 0 0 1.2px rgba(212, 168, 83, 0.5)',
              }}
            >
              <CafeLogo size={42} />
            </div>
          </div>
          <div className="title-block">
            <h1>
              <span style={{ fontSize: 26, marginRight: 8 }}>
                {currentCategory.icon}
              </span>
              {currentCategory.nameEn}
            </h1>
            <p>
              {currentCategory.nameAm} · {categoryItems.length} items
            </p>
          </div>
        </div>

        {/* Item rows */}
        <div>
          {categoryItems.map((item, i) => {
            const qty = getQty(item.id)
            const has = qty > 0
            return (
              <div
                key={item.id}
                className={`item-row anim-slideInUp ${has ? 'has-qty' : ''}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="item-info">
                  <div className="item-name-en">{item.nameEn}</div>
                  <div className="item-name-am">{item.nameAm}</div>
                </div>

                <div className="item-price">{item.price} Br</div>

                <div className="qty-stepper">
                  {has && (
                    <button
                      type="button"
                      className="qty-btn qty-minus"
                      aria-label={`Remove one ${item.nameEn}`}
                      onClick={() => {
                        removeItem(item.id)
                        hapticFeedback.impactOccurred('light')
                      }}
                    >
                      −
                    </button>
                  )}
                  {has && <span className="qty-value">{qty}</span>}
                  <button
                    type="button"
                    className="qty-btn qty-plus"
                    aria-label={`Add one ${item.nameEn}`}
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
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bottom-bar">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={items.length === 0}
        >
          Next ✓
        </button>
      </div>
    </div>
  )
}
