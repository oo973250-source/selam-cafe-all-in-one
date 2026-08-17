import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const STATUS_FLOW = ['new', 'preparing', 'ready', 'served', 'cancelled']

export default function OrderDetail({ orderId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const r = await api.getOrder(orderId)
      setData(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [orderId])

  async function changeStatus(newStatus) {
    try {
      await api.updateOrder(orderId, { status: newStatus })
      refresh()
    } catch (e) {
      alert('Failed: ' + e.message)
    }
  }

  async function changePayment(newPay) {
    try {
      await api.updateOrder(orderId, { payment_status: newPay })
      refresh()
    } catch (e) {
      alert('Failed: ' + e.message)
    }
  }

  if (loading) return <div>Loading…</div>
  if (error) return <div className="card" style={{ color: 'var(--red)' }}>{error}</div>
  if (!data) return null

  const { order, events } = data
  const loc = order.customer_loc

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 16 }}>← Back to orders</button>
      <h1>Order #{order.id}</h1>

      <div className="stats-grid">
        <div className="stat">
          <div className="label">Total</div>
          <div className="value gold">{order.total} Br</div>
        </div>
        <div className="stat">
          <div className="label">Items</div>
          <div className="value">{(order.items || []).reduce((n, i) => n + i.quantity, 0)}</div>
        </div>
        <div className="stat">
          <div className="label">Service</div>
          <div className="value" style={{ fontSize: 18, textTransform: 'capitalize' }}>{order.service_type}</div>
        </div>
        <div className="stat">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: 18 }}>
            <span className={`pill ${order.status}`}>{order.status}</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Payment</div>
          <div className="value" style={{ fontSize: 18 }}>
            <span className={`pill ${order.payment_status}`}>{order.payment_status}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Customer</h2>
          <p><strong>Name:</strong> {order.customer_name}</p>
          {order.tg_username && <p><strong>Telegram:</strong> @{order.tg_username}</p>}
          {order.tg_first_name && <p><strong>First name:</strong> {order.tg_first_name}</p>}
          {loc && (
            <div>
              <strong>Location:</strong>
              {loc.address && <div>{loc.address}</div>}
              {loc.lat && (
                <div style={{ fontSize: 12, color: '#666' }}>
                  {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}{' '}
                  <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lon}`} target="_blank" rel="noreferrer">
                    View on map →
                  </a>
                </div>
              )}
            </div>
          )}
          <p><strong>Trust level:</strong> {order.trust_level} past payments</p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Items</h2>
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              {(order.items || []).map((i, idx) => (
                <tr key={idx}>
                  <td>{i.nameEn} {i.nameAm && <span style={{ color: '#888' }}>({i.nameAm})</span>}</td>
                  <td>{i.quantity}</td>
                  <td>{i.price} Br</td>
                  <td>{i.price * i.quantity} Br</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Update status</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              className={order.status === s ? 'primary' : (s === 'cancelled' ? 'danger' : '')}
              disabled={order.status === s}
              onClick={() => changeStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <h2>Update payment</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['pending', 'paid', 'failed', 'cod'].map((p) => (
            <button
              key={p}
              className={order.payment_status === p ? 'success' : ''}
              disabled={order.payment_status === p}
              onClick={() => changePayment(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {events && events.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Event log</h2>
          <table className="table">
            <thead>
              <tr><th>When</th><th>Event</th><th>Payload</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: '#666' }}>
                    {new Date(e.created_at).toLocaleString('en-GB')}
                  </td>
                  <td><code>{e.event}</code></td>
                  <td style={{ fontSize: 12, color: '#666' }}>
                    {e.payload ? JSON.stringify(e.payload) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
