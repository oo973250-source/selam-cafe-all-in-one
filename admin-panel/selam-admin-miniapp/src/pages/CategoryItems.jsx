// Page 4 — items inside a selected category (opened from a Page 3 card tap).
// Numbered cards "1,Item name" + "Price : x", pencil ✏️ = edit modal,
// waste-basket 🗑️ = delete (confirm first), custom capsule scrollbar on the
// far left showing scroll position (per mock).
// Revision (user): circular "+" add button (same pattern as the category +
// on Page 5) opens the New item modal → POST /api/menu → list refetches.
import React, { useCallback, useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import ItemEditModal from '../components/ItemEditModal.jsx'
import ItemAddModal from '../components/ItemAddModal.jsx'
import VScroll from '../components/VScroll.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { api, SessionExpired } from '../api.js'
import { useApp } from '../store.jsx'
import { haptic, showConfirm } from '../telegram.js'

export default function CategoryItems({ category }) {
  const { setBoot, toast } = useApp()
  const [items, setItems] = useState(null) // null = loading
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null) // delete-in-flight guard (no double submit)

  const onErr = useCallback(
    (e) => {
      if (e instanceof SessionExpired) setBoot('expired')
    },
    [setBoot],
  )

  const reload = useCallback(async () => {
    if (!category) return
    try {
      const d = await api.getMenu({ category: category.id })
      const list = Array.isArray(d.items) ? d.items : []
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setItems(list)
    } catch (e) {
      onErr(e)
      setItems((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [category, onErr])

  useEffect(() => {
    reload()
  }, [reload])

  if (!category) return null

  async function removeItem(item) {
    if (busyId) return
    const ok = await showConfirm(`Delete "${item.name_en}" from ${category.name_en}?`)
    if (!ok) return
    haptic('warning')
    setBusyId(item.id)
    try {
      await api.deleteMenu(item.id)
      haptic('success')
      toast('Item deleted')
      await reload() // RULES: refetch after successful delete
    } catch (e) {
      onErr(e)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page-items">
      <Header variant="badge" badge={category.name_en} />
      <div className="hr" />

      {items === null ? (
        <Spinner label="Loading items…" />
      ) : (
        <VScroll variant="thin">
          {/* circular + (new item) — always rendered, sits above the list; the
              rail extends up beside it, same placement as the Admins page */}
          <div className="add-row">
            <button
              className="add-btn"
              aria-label="Add item"
              disabled={!!editing || !!adding}
              onClick={() => {
                haptic('light')
                setAdding(true)
              }}
            >
              +
            </button>
          </div>

          {items.length === 0 ? (
            <EmptyState>No items in this category yet — tap + to add one</EmptyState>
          ) : (
            items.map((item, i) => (
              <article className={`card item-card ${item.available === false ? 'item-off' : ''}`} key={item.id}>
                <div className="item-row">
                  <div className="item-name">
                    {i + 1},{item.name_en}
                    {item.name_am ? <span className="am-line">{item.name_am}</span> : null}
                  </div>
                  <div className="item-ico">
                    <button
                      className="ico-btn"
                      aria-label={`Delete ${item.name_en}`}
                      disabled={busyId === item.id || !!editing}
                      onClick={() => removeItem(item)}
                    >
                      🗑️
                    </button>
                    <button
                      className="ico-btn"
                      aria-label={`Edit ${item.name_en}`}
                      disabled={busyId === item.id || !!editing}
                      onClick={() => {
                        haptic('light')
                        setEditing(item)
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
                <div className="item-price">
                  Price :<span className="item-price-val">{item.price}</span>
                </div>
                {item.available === false && <div className="item-unflag">unavailable</div>}
              </article>
            ))
          )}
        </VScroll>
      )}

      {editing && (
        <ItemEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
          onErr={onErr}
        />
      )}

      {adding && (
        <ItemAddModal
          category={category}
          existingIds={Array.isArray(items) ? items.map((it) => it.id) : []}
          onClose={() => setAdding(false)}
          onSaved={reload}
          onErr={onErr}
        />
      )}
    </div>
  )
}
