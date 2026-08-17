import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Dashboard({ onOpenOrder }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [s, o] = await Promise.all([api.todayStats(), api.listOrders('?limit=8')])
      setStats(s)
      setRecent(o.orders || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000) // poll every 15s as a socket.io fallback
    return () => clearInterval(id)
  }, [])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <h1>Dashboard</h1>
      {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

      <div className="stats-grid">
        <div className="stat">
          <div className="label">Revenue today</div>
          <div className="value gold">{stats?.revenue_today ?? 0} Br</div>
        </div>
        <div className="stat">
          <div className="label">Orders today</div>
          <div className="value">{stats?.total_orders ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">New</div>
          <div className="value amber">{stats?.new_orders ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Preparing</div>
          <div className="value amber">{stats?.preparing ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Ready</div>
          <div className="value green">{stats?.ready ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Served</div>
          <div className="value green">{stats?.served ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Cancelled</div>
          <div className="value red">{stats?.cancelled ?? 0}</div>
        </div>
      </div>

      <h2>Recent orders</h2>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999', padding: 30 }}>
                No orders yet today. Open the bot in Telegram and place a test order.
              </td></tr>
            )}
            {recent.map((o) => (
              <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: 'pointer' }}>
                <td><strong>#{o.id}</strong></td>
                <td>{o.customer_name}</td>
                <td>{o.service_type}</td>
                <td>{o.total} Br</td>
                <td><span className={`pill ${o.status}`}>{o.status}</span></td>
                <td><span className={`pill ${o.payment_status}`}>{o.payment_status}</span></td>
                <td style={{ color: '#888', fontSize: 12 }}>
                  {new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
