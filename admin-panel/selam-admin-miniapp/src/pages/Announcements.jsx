// Announcements — opened from the Admin panel bottom-nav "+" button.
// Compose a broadcast message for customers (with live counter) and see every
// announcement already sent, newest first. Persistence + customer delivery =
// ⚠️ INTEGRATION POINT: GET|POST /api/admin-miniapp/announcements (harness-stubbed;
// the server must fan the message out to the customer app / bot channel).
import React, { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import { EmptyState, Spinner } from '../components/ui.jsx'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const MAX_LEN = 300

function fmtWhen(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function Announcements() {
  const { announcements, reloadAnnouncements, sendAnnouncement } = useApp()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // Refetch on entry — but never clobber what the admin is currently typing.
  useEffect(() => {
    reloadAnnouncements()
  }, [reloadAnnouncements])

  const list = Array.isArray(announcements) ? announcements : null

  const onSend = async () => {
    const text = msg.trim()
    if (!text || busy) return
    haptic('light')
    setBusy(true)
    const ok = await sendAnnouncement(text)
    setBusy(false)
    if (ok) setMsg('') // clear the composer only after a successful send
  }

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Announcements" badgeIcon="📢" />

      <div className="hr" />

      {/* app-standard scroller — .page-scroll alone CLIPS (overflow hidden);
          a growing SENT list would become unreachable without it */}
      <VScroll variant="thin">
      {/* ----- compose panel ----- */}
      <div className="an-compose">
        <textarea
          className="f-area an-input"
          placeholder="Write an announcement for your customers…"
          value={msg}
          maxLength={MAX_LEN}
          aria-label="Announcement message"
          onChange={(e) => setMsg(e.target.value)}
        />
        <div className="an-counter">
          {msg.length}/{MAX_LEN}
        </div>
        <button type="button" className="an-send" onClick={onSend} disabled={busy || !msg.trim()}>
          📢 Send announcement
        </button>
      </div>

      <div className="hr" />

      <div className="rp-h">SENT</div>

      {!list ? (
        <Spinner label="Loading announcements…" />
      ) : list.length === 0 ? (
        <EmptyState>No announcements sent yet</EmptyState>
      ) : (
        <div className="an-list">
          {list.map((a) => (
            <div key={a.id} className="an-card">
              <div className="an-msg">{a.message}</div>
              <div className="an-when">
                {fmtWhen(a.created_at)}
                {a.author ? ` · ${a.author}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      </VScroll>
    </div>
  )
}
