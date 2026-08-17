import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { api } from './api.js'

import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Orders from './components/Orders.jsx'
import OrderDetail from './components/OrderDetail.jsx'
import Menu from './components/Menu.jsx'

const socket = io({ transports: ['websocket', 'polling'] })

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard') // dashboard | orders | order | menu
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [newOrderFlash, setNewOrderFlash] = useState(false)

  // Check existing session
  useEffect(() => {
    api.me()
      .then((r) => {
        if (r._unauthorized) setUser(null)
        else setUser(r.user)
      })
      .finally(() => setLoading(false))
  }, [])

  // Socket.io: flash on new order
  useEffect(() => {
    if (!user) return
    socket.on('order:new', () => {
      setNewOrderFlash(true)
      setTimeout(() => setNewOrderFlash(false), 2000)
    })
    return () => socket.off('order:new')
  }, [user])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading…</div>
  }

  if (!user) {
    return (
      <Login
        onLoggedIn={(u) => setUser(u)}
        botName={import.meta.env.VITE_TELEGRAM_BOT_NAME}
      />
    )
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onOpenOrder={(id) => { setSelectedOrderId(id); setView('order') }} />
      case 'orders':
        return (
          <Orders
            onOpenOrder={(id) => { setSelectedOrderId(id); setView('order') }}
          />
        )
      case 'order':
        return (
          <OrderDetail
            orderId={selectedOrderId}
            onBack={() => setView('orders')}
          />
        )
      case 'menu':
        return <Menu />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        view={view}
        onNavigate={setView}
        onLogout={async () => {
          await api.logout()
          setUser(null)
        }}
        newOrderFlash={newOrderFlash}
      />
      <main className="main">
        {newOrderFlash && (
          <div
            style={{
              background: '#2d8a4e', color: 'white', padding: '10px 16px',
              borderRadius: 8, marginBottom: 14, fontWeight: 600,
            }}
          >
            🔔 New order received!
          </div>
        )}
        {renderView()}
      </main>
    </div>
  )
}
