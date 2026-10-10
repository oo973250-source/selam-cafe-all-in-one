// Small shared UI primitives
import React from 'react'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      <div className="spinner-label">{label}</div>
    </div>
  )
}

export function Banner({ children, tone = 'red' }) {
  return <div className={`banner banner-${tone}`}>{children}</div>
}

export function EmptyState({ children }) {
  return <div className="empty">{children}</div>
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast" key={toast.key} role="status">
      {toast.msg}
    </div>
  )
}
