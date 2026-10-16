// Order details sheet — ONE shared overlay for both entry points:
//   · the live queue's "Details" button (OrderCard)
//   · the History screen (tapping any order row — customer-details request)
// Shows the customer behind the order (name / phone / telegram handle) plus
// service & location, items in the "qty x name" format, note, payment and
// total. Overlay tap or ✕ closes it; Telegram hardware back also closes it
// (store.telegramBack clicks any open .modal-overlay first).
import React from 'react'
import { useApp, SERVICE_LABELS } from '../store.jsx'
import ReportUserModal from './ReportUserModal.jsx'

const STATUS_LABEL = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

const PAY_LABEL = {
  pending: 'Pending',
  paid: 'Paid online',
  cod: 'Cash on delivery',
  failed: 'Failed',
}

function locText(order) {
  const loc = order.customer_loc
  if (!loc) return ''
  if (typeof loc === 'string') return loc
  return loc.address || loc.description || ''
}

function fmtWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function OrderDetailsModal() {
  const { detailsOrder, closeOrderDetails } = useApp()
  const [reporting, setReporting] = React.useState(false)
  if (!detailsOrder) return null
  const o = detailsOrder

  const name = o.customer_name || o.tg_first_name || o.tg_username || '-'
  const phone = o.customer_phone || o.phone || (o.customer_loc && o.customer_loc.phone) || '-'
  const username = o.tg_username || null
  const items = Array.isArray(o.items) ? o.items : []
  const note = o.note || (o.items || []).map((i) => i.note).filter(Boolean).join(' · ')
  const loc = o.service_type === 'delivery' ? locText(o) : ''

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${o.id} details`}
      onClick={closeOrderDetails}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="od-top">
          <h3 className="modal-title">Order #{o.id}</h3>
          <span className={`hist-status s-${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span>
          <button type="button" className="od-close" aria-label="Close details" onClick={closeOrderDetails}>
            ✕
          </button>
        </div>
        {o.created_at ? <div className="od-when">Placed {fmtWhen(o.created_at)}</div> : null}

        <div className="f-label">Customer</div>
        <div className="od-card">
          <div className="od-row">
            <span className="od-ico" aria-hidden="true">👤</span>
            <span className="od-wrap">{name}</span>
          </div>
          <div className="od-row">
            <span className="od-ico" aria-hidden="true">📞</span>
            <span className="od-wrap">{phone}</span>
          </div>
          {username && (
            <div className="od-row">
              <span className="od-ico" aria-hidden="true">💬</span>
              <span className="od-wrap">@{username}</span>
            </div>
          )}
        </div>

        <div className="f-label">Service</div>
        <div className="od-card">
          <div className="od-row">
            <span className="od-ico" aria-hidden="true">🧾</span>
            <span>{SERVICE_LABELS[o.service_type] || o.service_type}</span>
          </div>
          {loc ? (
            <div className="od-row">
              <span className="od-ico" aria-hidden="true">📍</span>
              <span className="od-wrap">{loc}</span>
            </div>
          ) : null}
          {o.payment_status ? (
            <div className="od-row">
              <span className="od-ico" aria-hidden="true">💳</span>
              <span>{PAY_LABEL[o.payment_status] || o.payment_status}</span>
            </div>
          ) : null}
        </div>

        <div className="f-label">Items</div>
        <div className="od-card">
          {items.length ? (
            items.map((it, i) => (
              <div key={it.id ?? i} className="od-line">
                <span>{`${it.qty ?? 1} x ${it.name}`}</span>
                <span className="od-price">
                  {typeof it.price === 'number' ? `${(it.price * (it.qty ?? 1)).toLocaleString('en-US')} ETB` : ''}
                </span>
              </div>
            ))
          ) : (
            <div className="od-row">
              <span>—</span>
            </div>
          )}
          {note && note !== '-' ? <div className="od-note">📝 {note}</div> : null}
        </div>

        {typeof o.total === 'number' && (
          <div className="od-total">
            <span>Total</span>
            <b>{o.total.toLocaleString('en-US')} ETB</b>
          </div>
        )}

        {o.tg_user_id ? (
          <button
            type="button"
            className="btn od-report-btn"
            onClick={() => setReporting(true)}
          >
            🚩 Report this user
          </button>
        ) : null}
      </div>

      {reporting && (
        <ReportUserModal
          preset={{ tg_user_id: o.tg_user_id, tg_username: o.tg_username, tg_first_name: o.tg_first_name }}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  )
}
