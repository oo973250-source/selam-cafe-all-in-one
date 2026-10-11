// Page 3 — "menu" → category list per section (Foods | Drinks) with
// `unavailable` (→ category.hidden via PATCH) and `No delivery` toggles.
// User addendum: same capsule scroll controls as Page 4 wrap the list.
// User addendum v2: circular "+" ABOVE the list (same disc as Page 4/5) →
// "New category" modal for the ACTIVE section → refetch. User flow:
// add category here → tap it → add items on Page 4.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import CategoryAddModal from '../components/CategoryAddModal.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { SessionExpired } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

export default function MenuCategories() {
  const {
    categories,
    section,
    setSection,
    reloadCategories,
    toggleCategoryHidden,
    toggleNoDelivery,
    noDelivery,
    push,
    setBoot,
  } = useApp()
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
    return categories
      .filter((c) => c.section === section)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [categories, section])

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="menu">
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

      {list === null ? (
        <Spinner label="Loading categories…" />
      ) : (
        <VScroll variant="thin">
          {/* circular + (new category) — always rendered above the list, same
              disc/placement as the item + on Page 4 (user: "at that page I need
              an add button to add category") */}
          <div className="add-row">
            <button
              className="add-btn"
              aria-label="Add category"
              disabled={adding}
              onClick={() => {
                haptic('light')
                setAdding(true)
              }}
            >
              +
            </button>
          </div>

          {list.length === 0 ? (
            <EmptyState>No categories in this section yet — tap + to add one</EmptyState>
          ) : (
            list.map((cat, i) => (
            <article className="card cat-card" key={cat.id}>
              <button
                className="cat-title"
                onClick={() => {
                  haptic('light')
                  push('items', cat.name_en, { category: cat }) // Page 4: items in this category
                }}
              >
                {i + 1},{cat.name_en}
                {cat.name_am ? <span className="am-line">{cat.name_am}</span> : null}
              </button>
              <div className="ipanel">
                <button
                  className={`tg ${cat.hidden ? 'tg-unavail on' : ''}`}
                  aria-pressed={!!cat.hidden}
                  onClick={() => toggleCategoryHidden(cat)}
                >
                  unavailable
                </button>
                <button
                  className={`tg ${noDelivery[cat.id] ? 'tg-nodel on' : ''}`}
                  aria-pressed={!!noDelivery[cat.id]}
                  onClick={() => toggleNoDelivery(cat)}
                >
                  No delivery
                </button>
              </div>
            </article>
            ))
          )}
        </VScroll>
      )}

      {adding && <CategoryAddModal section={section} onClose={() => setAdding(false)} onErr={onErr} />}
    </div>
  )
}
