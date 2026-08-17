import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled']

export default function Orders({ onOpenOrder }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const params = status ? `?status=${status}&limit=100` : '?limit=100'
      const r = await api.listOrders(params)
      setOrders(r.orders || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 20000)
    return () => clearInterval(id)
  }, [status])

  return (
    <div>
      <h1>Orders</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#666' }}>Filter:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={refresh}>Refresh</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Service</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#999' }}>Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#999' }}>No orders.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: 'pointer' }}>
                <td><strong>#{o.id}</strong></td>
                <td>
                  {o.customer_name}
                  <div style={{ fontSize: 11, color: '#888' }}>@{o.tg_username || '—'}</div>
                </td>
                <td>{(o.items || []).reduce((n, i) => n + i.quantity, 0)} items</td>
                <td>{o.service_type}</td>
                <td><strong>{o.total} Br</strong></td>
                <td><span className={`pill ${o.status}`}>{o.status}</span></td>
                <td><span className={`pill ${o.payment_status}`}>{o.payment_status}</span></td>
                <td style={{ color: '#888', fontSize: 12 }}>
                  {new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
