// Page 3 — "menu": category rows with Available / Delivery controls, rebuilt
// per reference image 3 (Menu Management):
//   • Foods | Drinks segmented tabs + search + compact gold circular add
//   • thumbnail, name, item count on a dark rounded row card
//   • two status pills with real toggles:
//       Available  → category.hidden    (TRUE = Unavailable, red)
//       Delivery   → category.no_delivery (TRUE = No delivery, gray)
// Tapping the row name still opens the item manager for that category.
// 4.2: availability updates go through the FIXED PATCH endpoint (the old
// self-heal/unmatched-params code path that failed with "Couldn't update
// category" is gone server-side; failures surface as real errors here).
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import CategoryAddModal from '../components/CategoryAddModal.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { SessionExpired } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function MenuCategories() {
  const {
    categories,
    section,
    setSection,
    reloadCategories,
    toggleCategoryHidden,
    toggleNoDelivery,
    push,
    setBoot,
  } = useApp()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)

  const onErr = useCallback(
    (e) => {
      if (e instanceof SessionExpired) setBoot('expired')
    },
    [setBoot],
  )

  useEffect(() => {
    if (!Array.isArray(categories)) reloadCategories()
  }, [categories, reloadCategories])

  const list = useMemo(() => {
    if (!Array.isArray(categories)) return null
    const needle = q.trim().toLowerCase()
    return categories
      .filter((c) => c.section === section)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .filter(
        (c) =>
          !needle ||
          String(c.name_en || '').toLowerCase().includes(needle) ||
          String(c.name_am || '').toLowerCase().includes(needle),
      )
  }, [categories, section, q])

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Menu" badgeIcon={'🍴'}>
        <div className="seg seg-sub" role="tablist" aria-label="Menu section">
          <button role="tab" aria-selected={section === 'food'} className={section === 'food' ? 'active' : ''} onClick={() => { haptic('select'); setSection('food') }}>
            Foods
          </button>
          <button role="tab" aria-selected={section === 'drink'} className={section === 'drink' ? 'active' : ''} onClick={() => { haptic('select'); setSection('drink') }}>
            Drinks
          </button>
        </div>
      </Header>

      <div className="hr" />

      <div className="controls-bar">
        <div className="search-pill">
          <svg className="search-ico" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.75" stroke="#ffc83d" strokeWidth="2.2" />
            <path d="M15.6 15.6L21 21" stroke="#ffc83d" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            placeholder="Search menu items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search menu categories"
            maxLength={40}
          />
        </div>
        <button
          className="add-btn-gold"
          aria-label="Add item"
          onClick={() => {
            haptic('light')
            setAdding(true)
          }}
        >
          +
        </button>
      </div>

      {list === null ? (
        <Spinner label="Loading menu…" />
      ) : list.length === 0 ? (
        q.trim() ? <EmptyState>Nothing matches “{q.trim()}”</EmptyState> : <EmptyState>No categories in this section yet — tap + to add one</EmptyState>
      ) : (
        <VScroll variant="thin">
          {list.map((cat) => {
            const available = !cat.hidden
            const delivery = !cat.no_delivery
            return (
              <div className="card menu-row-card" key={cat.id}>
                <button
                  className="menu-row-thumb"
                  style={{ border: 'none', background: 'var(--cat-thumb-bg)', padding: 0, cursor: 'pointer' }}
                  onClick={() => {
                    haptic('light')
                    push('items', cat.name_en, { category: cat })
                  }}
                  aria-label={`Open ${cat.name_en}`}
                >
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" draggable={false} onError={(e) => { e.currentTarget.parentNode.textContent = cat.icon || '🍽️' }} />
                  ) : (
                    cat.icon || '🍽️'
                  )}
                </button>

                <button
                  className="menu-row-body"
                  style={{ border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', padding: 0, cursor: 'pointer' }}
                  onClick={() => {
                    haptic('light')
                    push('items', cat.name_en, { category: cat })
                  }}
                >
                  <span className="menu-row-name" style={{ display: 'block' }}>{cat.name_en}</span>
                  <span className="menu-row-sub" style={{ display: 'block' }}>
                    {cat.item_count ?? 0} {cat.item_count === 1 ? 'item' : 'items'}
                  </span>
                </button>

                <div className="menu-row-pills">
                  <button
                    className={`mc-pill ${available ? 'mc-pill-avail' : 'mc-pill-unavail'} on`}
                    aria-pressed={!cat.hidden}
                    onClick={() => {
                      haptic('light')
                      toggleCategoryHidden(cat)
                    }}
                  >
                    <span className="mc-pill-dot" aria-hidden="true">{available ? '✓' : '✕'}</span>
                    {available ? 'Available' : 'Unavailable'}
                  </button>
                  <button
                    className={`mc-pill ${delivery ? 'mc-pill-delivery' : 'mc-pill-nodel'} on`}
                    aria-pressed={delivery}
                    onClick={() => {
                      haptic('light')
                      toggleNoDelivery(cat)
                    }}
                  >
                    {delivery ? '🛵 Delivery' : '🛵 No delivery'}
                  </button>
                </div>
              </div>
            )
          })}
        </VScroll>
      )}

      {adding && <CategoryAddModal section={section} onClose={() => setAdding(false)} onErr={onErr} />}
    </div>
  )
}
