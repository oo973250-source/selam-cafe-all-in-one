// Page 2 — "manager" hub: vertical stack of 6 full-width pills.
// Emergency pause navigates to the Admin panel page (Page 7) — the kill-switch
// lives there; this pill keeps its red styling + active tint while paused.
// Profile navigates to the Cafe Profile settings page (Page 9).
import React from 'react'
import Header from '../components/Header.jsx'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

export default function ManagerHub() {
  const { push, paused } = useApp()

  const go = (name, label) => {
    haptic('light')
    push(name, label)
  }

  return (
    <div>
      <Header variant="tabs" active="manager" />

      <div className="hr" />

      <button className="mpill" onClick={() => go('menu', 'menu')}>
        menu
      </button>
      <button className="mpill" onClick={() => go('categorize', 'Categorize')}>
        Categorize
      </button>
      <button className="mpill" onClick={() => go('admins', 'Admins')}>
        Admins
      </button>
      <button className="mpill" onClick={() => go('revenue', 'Revenue')}>
        Revenue
      </button>
      <button className="mpill" onClick={() => go('profile', 'Profile')}>
        Profile
      </button>
      <button className={`mpill mpill-danger ${paused ? 'mpill-active' : ''}`} onClick={() => go('adminpanel', 'Emergency pause')}>
        Emergency pause
      </button>
    </div>
  )
}
