// App shell: boot flow (splash → auth → content), nav stack renderer, toast.
import React, { useEffect } from 'react'
import { AppProvider, useApp } from './store.jsx'
import { initTelegram, bindBackButton, showBackButton, haptic } from './telegram.js'
import { initSocket, closeSocket } from './socket.js'
import OrdersView from './pages/OrdersView.jsx'
import ManagerHub from './pages/ManagerHub.jsx'
import MenuCategories from './pages/MenuCategories.jsx'
import CategoryItems from './pages/CategoryItems.jsx'
import Categorize from './pages/Categorize.jsx'
import Admins from './pages/Admins.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import { Spinner, Toast } from './components/ui.jsx'

function Screen() {
  const { stack } = useApp()
  const page = stack[stack.length - 1]
  switch (page.name) {
    case 'orders':
      return <OrdersView />
    case 'manager':
      return <ManagerHub />
    case 'menu':
      return <MenuCategories />
    case 'items':
      return <CategoryItems category={page.category} />
    case 'categorize':
      return <Categorize />
    case 'admins':
      return <Admins />
    case 'adminpanel':
      return <AdminPanel />
    default:
      return <ComingSoon label={page.label} />
  }
}

function Boot() {
  const { boot, setBoot, doAuth, reloadOrders, reloadSettings, pushNewOrder, back } = useApp()

  useEffect(() => {
    initTelegram()
    bindBackButton(() => back())

    let mounted = true
    ;(async () => {
      try {
        await doAuth()
        if (!mounted) return
        await reloadOrders()
        if (!mounted) return
        await reloadSettings() // Page 7 store settings (emergency pause / countdown state)
        if (!mounted) return
        setBoot('ok')
        initSocket((order) => pushNewOrder(order))
      } catch {
        /* boot state already set by doAuth (denied | expired) */
      }
    })()

    return () => {
      mounted = false
      closeSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    showBackButton(false)
  }, [])

  if (boot === 'splash') return <Spinner label="Signing in…" />
  if (boot === 'gate')
    return (
      <div className="boot-screen">
        <div className="boot-icon">✈️</div>
        <h2>Open in Telegram</h2>
        <p>This admin panel runs inside Telegram. Open your bot and tap the Menu button.</p>
      </div>
    )
  if (boot === 'denied')
    return (
      <div className="boot-screen">
        <div className="boot-icon">⛔</div>
        <h2>Access denied</h2>
        <p>This account is not on the admin allowlist. Ask the owner to add your Telegram ID.</p>
      </div>
    )
  if (boot === 'expired')
    return (
      <div className="boot-screen">
        <div className="boot-icon">⏳</div>
        <h2>Session expired</h2>
        <p>Your session timed out. Reopen the panel from the bot, or tap retry.</p>
        <button
          className="btn btn-gold"
          onClick={() => {
            haptic('light')
            window.location.reload()
          }}
        >
          Retry
        </button>
      </div>
    )
  return <Screen />
}

function NavDepthTracker() {
  const { stack } = useApp()
  useEffect(() => {
    showBackButton(stack.length > 1)
  }, [stack])
  return null
}

export default function App() {
  return (
    <AppProvider>
      <NavDepthTracker />
      <main className="app">
        <Boot />
        <ToastSlot />
      </main>
    </AppProvider>
  )
}

function ToastSlot() {
  const { toastMsg } = useApp()
  return <Toast toast={toastMsg} />
}
