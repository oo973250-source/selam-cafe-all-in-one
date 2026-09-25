import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

/**
 * Users (Task 4 — scammer protection)
 * -----------------------------------
 * Blocklist management for the web admin panel:
 *   • search customers from past orders (name / @username / Telegram ID)
 *   • block by ID, username, or straight from a search result
 *   • view + unblock the current blocklist
 *
 * Blocked users are rejected SERVER-SIDE in both order entry points
 * (POST /api/miniapp/orders and the bot's web_app_data handler), so past
 * orders remain visible to admin while new ones are impossible.
 */
export default function Users() {
  const [blocked, setBlocked] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null = directory not loaded
  const [blockInput, setBlockInput] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const r = await api.listBlockedUsers()
      setBlocked(r.users || [])
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { refresh() }, [])

  async function search(e) {
    e?.preventDefault()
    setBusy(true)
    try {
      const r = await api.listCustomers(`?q=${encodeURIComponent(query.trim())}`)
      setResults(r.users || [])
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function block(idOrUsername, presetReason) {
    if (!idOrUsername?.trim()) return
    if (!confirm(`Block ${idOrUsername}? They will not be able to place orders from the bot or the Mini App.`)) return
    setBusy(true)
    try {
      await api.blockUser({ idOrUsername: idOrUsername.trim(), reason: presetReason || reason || null })
      setBlockInput('')
      setReason('')
      await refresh()
    } catch (e) {
      alert('Block failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function unblock(tgUserId) {
    if (!confirm(`Unblock ${tgUserId}? They can place orders again.`)) return
    setBusy(true)
    try {
      await api.unblockUser(tgUserId)
      await refresh()
    } catch (e) {
      alert('Unblock failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const display = (u) =>
    [u.tg_username ? `@${u.tg_username}` : null, u.display_name || u.tg_first_name]
      .filter(Boolean)
      .join(' · ') || '—'

  return (
    <div>
      <h1>Users & Blocklist</h1>
      {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

      {/* Block by ID / username */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>⛔ Block a user</h2>
        <p style={{ color: '#888', fontSize: 13 }}>
          By numeric Telegram ID or exact @username (usernames are resolved via
          past orders). Blocked users are rejected server-side in BOTH entry
          points — bot chat and Mini App — and past orders stay visible to admin.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 220 }}
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            placeholder="123456789 or @username"
          />
          <input
            style={{ flex: 1, minWidth: 220 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, e.g. fake order scam)"
          />
          <button className="danger" disabled={busy || !blockInput.trim()} onClick={() => block(blockInput, reason)}>
            Block user
          </button>
        </div>
      </div>

      {/* Search directory */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🔍 Search customers</h2>
        <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, @username or Telegram ID"
          />
          <button type="submit" disabled={busy}>Search</button>
        </form>
        {results !== null && (
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Telegram ID</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Last order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                  No customers match "{query}".
                </td></tr>
              )}
              {results.map((u) => {
                const isBlocked = blocked.some((b) => b.tg_user_id === u.tg_user_id)
                return (
                  <tr key={u.tg_user_id}>
                    <td>{display(u)}</td>
                    <td><code>{u.tg_user_id}</code></td>
                    <td>{u.order_count}</td>
                    <td>{u.total_spent ?? 0} Br</td>
                    <td style={{ color: '#888', fontSize: 12 }}>
                      {u.last_order_at ? new Date(u.last_order_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td>
                      {isBlocked ? (
                        <span className="pill cancelled">⛔ blocked</span>
                      ) : (
                        <button className="danger" disabled={busy} onClick={() => block(String(u.tg_user_id))}>
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Current blocklist */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🚫 Current blocklist ({blocked.length})</h2>
        {blocked.length === 0 ? (
          <p style={{ color: '#888' }}>Nobody is blocked.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Telegram ID</th>
                <th>Reason</th>
                <th>Past orders</th>
                <th>Blocked at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((b) => (
                <tr key={b.tg_user_id}>
                  <td>{display(b)}</td>
                  <td><code>{b.tg_user_id}</code></td>
                  <td style={{ color: '#888' }}>{b.reason || '—'}</td>
                  <td>{b.order_count ?? '—'}</td>
                  <td style={{ color: '#888', fontSize: 12 }}>
                    {new Date(b.blocked_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>
                    <button disabled={busy} onClick={() => unblock(b.tg_user_id)}>Unblock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
