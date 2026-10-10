// Order card — Page 1 spec: badge, "qty, name" item lines, note, delivery-only location
// (GPS → map button, typed text → plain text), 4-pill action bar.
import React from 'react'
import { useApp, SERVICE_LABELS } from '../store.jsx'
import { openMap } from '../telegram.js'

function locInfo(order) {
  const loc = order.customer_loc
  if (!loc) return { text: '', gps: null }
  if (typeof loc === 'string') return { text: loc, gps: null }
  const lat = loc.lat ?? loc.latitude
  const lng = loc.lng ?? loc.lon ?? loc.longitude
  if (lat != null && lng != null) {
    return { text: loc.address || loc.description || 'Shared location', gps: { lat, lng } }
  }
  return { text: loc.address || loc.description || loc.text || '', gps: null }
}

export default function OrderCard({ order }) {
  const { startOrder, finishOrder, cancelOrder, showOrderDetails, doneIds } = useApp()

  const isDone = order.status === 'served' || doneIds.includes(order.id)
  const isStarted = order.status === 'preparing' || order.status === 'ready'
  const items = Array.isArray(order.items) ? order.items : []
  const note = order.note || (order.items || []).map((i) => i.note).filter(Boolean).join(' · ') || '-'
  const loc = order.service_type === 'delivery' ? locInfo(order) : null

  return (
    <article className="card" aria-label={`Order ${order.id}`}>
      <span className="badge">{SERVICE_LABELS[order.service_type] || order.service_type}</span>

      <div className="card-title">
        {items.length
          ? items.map((it, i) => (
              <div key={it.id ?? i}>{`${it.qty ?? 1}, ${it.name}`}</div>
            ))
          : '—'}
      </div>

      <div className="meta-row">
        <span className="meta-emoji">📝</span>
        <span className="meta-text">Note : {note}</span>
      </div>

      {loc && (
        <div className="meta-row">
          <span className="meta-emoji">📍</span>
          <span className="meta-text">Location : {loc.text || '---'}</span>
          {loc.gps && (
            <button className="loc-btn" onClick={() => openMap(loc.gps.lat, loc.gps.lng)}>
              Location 📍
            </button>
          )}
        </div>
      )}

      <div className="actions">
        <button
          className={`btn ${isStarted ? 'btn-goldgreen' : 'btn-gold'}`}
          disabled={isStarted}
          onClick={() => startOrder(order)}
        >
          {isStarted ? 'started' : 'start'}
        </button>

        <button className="btn" disabled={isDone} onClick={() => finishOrder(order)}>
          {isDone ? 'Done' : 'Finished ✅'}
        </button>

        <button className="btn btn-cancel" onClick={() => cancelOrder(order)}>
          Cancel ❌
        </button>

        <button className="btn btn-details" onClick={() => showOrderDetails(order)}>
          Details
        </button>
      </div>
    </article>
  )
}
