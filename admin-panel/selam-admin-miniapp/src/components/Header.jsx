// App header — two variants per mocks:
//  - "tabs": root pages (Orders / Manager) → segmented switcher top-right
//  - "badge": deeper pages → large section badge pill top-right (+ optional sub-toggle below)
// `onHistory` (Orders root only) renders a list-note icon button in the TOP-RIGHT
// corner → opens the Order History screen (today + yesterday).
import React from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

function BackBtn() {
  const { back } = useApp()
  return (
    <button className="back-btn" aria-label="Back" onClick={() => { haptic('light'); back() }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5l-6 7 6 7M3 12h12a6 6 0 0 1 0 12h-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-6)" />
      </svg>
    </button>
  )
}

// list-note glyph: page with ruled lines (history entry point)
function HistoryIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export default function Header({ variant = 'tabs', active = 'orders', badge = '', badgeIcon = '', onHistory, children }) {
  const { switchTab, brandName } = useApp()

  const onSwitch = (tab) => {
    if (tab === active) return
    haptic('select')
    switchTab(tab)
  }

  return (
    <header className="header">
      <div className="header-top">
        <BackBtn />
        <span className="header-title">admin</span>
        {onHistory ? (
          <button
            type="button"
            className="hist-btn"
            aria-label="Order history"
            onClick={() => {
              haptic('light')
              onHistory()
            }}
          >
            <HistoryIcon />
          </button>
        ) : null}
      </div>

      <div className="brand-row">
        <div className="brand-block">
          <div className="brand">{brandName}</div>
          <div className="brand-sub">admin panel</div>
        </div>

        {variant === 'tabs' ? (
          <div className="seg" role="tablist" aria-label="View switcher">
            <button role="tab" aria-selected={active === 'orders'} className={active === 'orders' ? 'active' : ''} onClick={() => onSwitch('orders')}>
              orders
            </button>
            <button role="tab" aria-selected={active === 'manager'} className={active === 'manager' ? 'active' : ''} onClick={() => onSwitch('manager')}>
              manager
            </button>
          </div>
        ) : (
          <div className="header-side">
            {badge ? (
              <div className={`badge-menu ${String(badge).length > 12 ? 'badge-menu-sm' : ''}`}>
                {badgeIcon ? (
                  <span className="badge-ico" aria-hidden="true">
                    {badgeIcon}
                  </span>
                ) : null}
                {badge}
              </div>
            ) : null}
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
