// Page 5 — "Categorize": category-management screen, rebuilt per reference
// image 1 (Categories Management):
//   • dark cards with a food thumbnail, name + "N items" count, right chevron
//   • Foods/Drinks segmented tabs, search bar + compact gold circular add
//   • narrow gold scrollbar, gold rail on the first visible card
// Behaviour preserved: tap opens the edit overlay (rename / reorder /
// availability / delete), + opens the new-category modal, search filters.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import CategoryAddModal from '../components/CategoryAddModal.jsx'
import CategoryEditModal from '../components/CategoryEditModal.jsx'
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

// Emoji fallback never blanks out: only render a thumb when the category has
// a real image (icon emojis otherwise go through the .cat-thumb tile).
function CatThumb({ cat }) {
  if (cat.image_url) {
    return (
      <span className="cat-thumb" aria-hidden="true">
        <img src={cat.image_url} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </span>
    )
  }
  return <span className="cat-thumb" aria-hidden="true">{cat.icon || '🍽️'}</span>
}

export default function Categorize() {
  const { categories, section, setSection, reloadCategories, setBoot, push } = useApp()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // category object

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
      <Header variant="badge" badge="Category" badgeIcon={'▦'}>
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
            placeholder="Search categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search categories"
            maxLength={40}
          />
        </div>
        <button className="add-btn-gold" aria-label="Add category" onClick={() => { haptic('light'); setAdding(true) }}>
          +
        </button>
      </div>

      {list === null ? (
        <Spinner label="Loading categories…" />
      ) : list.length === 0 ? (
        q.trim() ? (
          <EmptyState>No categories match “{q.trim()}”</EmptyState>
        ) : (
          <EmptyState>No categories in this section yet — tap + to add one</EmptyState>
        )
      ) : (
        <VScroll variant="thin">
          {list.map((cat, i) => (
            <button
              className={`cat-overview-card ${i === 0 && !q.trim() ? 'cat-rail' : ''} ${cat.hidden ? 'cat-off' : ''}`}
              key={cat.id}
              onClick={() => {
                haptic('light')
                push('items', cat.name_en, { category: cat })
              }}
              aria-label={`${cat.name_en} — ${cat.item_count ?? 0} items${cat.hidden ? ' (unavailable)' : ''}`}
            >
              <CatThumb cat={cat} />
              <span className="cat-overview-body">
                <span className="cat-overview-name">{cat.name_en}</span>
                <span className="cat-overview-sub">
                  {cat.item_count ?? 0} {cat.item_count === 1 ? 'item' : 'items'}
                  {cat.hidden ? ' · Unavailable' : ''}
                </span>
              </span>
              <span className="cat-overview-chevron" aria-hidden="true">
                <Chevron />
              </span>
            </button>
          ))}
        </VScroll>
      )}

      {adding && <CategoryAddModal section={section} onClose={() => setAdding(false)} onErr={onErr} />}
      {editing && <CategoryEditModal cat={editing} onClose={() => setEditing(null)} onErr={onErr} />}
    </div>
  )
}
