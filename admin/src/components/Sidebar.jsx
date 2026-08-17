import React from 'react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'orders',    label: 'Orders',    icon: '🧾' },
  { key: 'menu',      label: 'Menu',      icon: '☕' },
]

export default function Sidebar({ user, view, onNavigate, onLogout, newOrderFlash }) {
  return (
    <aside className="sidebar">
      <div className="brand">☕ Selam Cafe</div>

      <div style={{ fontSize: 12, color: '#888', padding: '0 10px 12px' }}>
        <span className="live-dot" />
        Live
      </div>

      {NAV.map((n) => (
        <a
          key={n.key}
          className={view === n.key ? 'active' : ''}
          onClick={() => onNavigate(n.key)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span>{n.icon}</span>
          <span>{n.label}</span>
          {n.key === 'orders' && newOrderFlash && (
            <span style={{ marginLeft: 'auto', background: 'var(--red)', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>!</span>
          )}
        </a>
      ))}

      <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 13, color: '#d4d4d4' }}>
          {user.firstName} {user.lastName || ''}
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          @{user.username || '—'} · {user.role}
        </div>
        <button
          onClick={onLogout}
          style={{ marginTop: 8, background: 'transparent', color: '#888', padding: '4px 0', width: '100%', textAlign: 'left' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
