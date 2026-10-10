// Placeholder for pages whose specs haven't arrived yet (UI-first build).
import React from 'react'
import Header from '../components/Header.jsx'

export default function ComingSoon({ label }) {
  return (
    <div>
      <Header variant="badge" badge={label || 'soon'} />
      <div className="hr" />
      <div className="empty">This screen is coming with the next pages</div>
    </div>
  )
}
