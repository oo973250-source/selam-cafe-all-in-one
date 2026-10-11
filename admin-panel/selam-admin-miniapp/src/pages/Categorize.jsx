// Page 5 — "Categorize": category management, opened from the Manager hub.
// 🔍 search bar (client-side filter) + circular "+" (new category modal),
// full-width category pills — tap opens the edit overlay (rename / reorder /
// delete). Slim THIN scrollbar far left per mock. Badge: "Category".
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import CategoryAddModal from '../components/CategoryAddModal.jsx'
import CategoryEditModal from '../components/CategoryEditModal.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { SessionExpired } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

export default function Categorize() {
  const { categories, section, setSection, reloadCategories, setBoot } = useApp()
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
      <Header variant="badge" badge="Category">
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
            <circle cx="10.5" cy="10.5" r="6.75" stroke="#9fc3d8" strokeWidth="2.2" />
            <path d="M15.6 15.6L21 21" stroke="#9fc3d8" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            placeholder="search.."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search categories"
            maxLength={40}
          />
        </div>
        <button className="add-btn" aria-label="Add category" onClick={() => { haptic('light'); setAdding(true) }}>
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
          {list.map((cat) => (
            <button
              className="cat-pill"
              key={cat.id}
              onClick={() => {
                haptic('light')
                setEditing(cat)
              }}
            >
              {cat.name_en}
              {cat.name_am ? <span className="am-line am-pill">{cat.name_am}</span> : null}
            </button>
          ))}
        </VScroll>
      )}

      {adding && <CategoryAddModal section={section} onClose={() => setAdding(false)} onErr={onErr} />}
      {editing && <CategoryEditModal cat={editing} onClose={() => setEditing(null)} onErr={onErr} />}
    </div>
  )
}
