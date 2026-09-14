import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

/**
 * Login
 * -----
 * Two sign-in methods:
 *
 * 1. Telegram Login Widget (requires the bot's domain to be allowlisted via
 *    BotFather /setdomain — easy to miss, which is why this often "just
 *    doesn't log in").
 *
 * 2. Bot-issued login code (recommended): send /login to the bot in Telegram,
 *    receive a one-time 6-digit code, type it below. No BotFather setup at all.
 */
export default function Login({ onLoggedIn, botName }) {
  const containerRef = useRef(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)

  useEffect(() => {
    // 1. Check URL hash for a returning Telegram Login Widget payload
    const hash = window.location.hash.replace(/^#/, '')
    if (hash.includes('hash=') && hash.includes('auth_date=')) {
      const params = new URLSearchParams(hash)
      const payload = {
        id: params.get('id'),
        first_name: params.get('first_name'),
        last_name: params.get('last_name'),
        username: params.get('username'),
        photo_url: params.get('photo_url'),
        auth_date: params.get('auth_date'),
        hash: params.get('hash'),
      }
      api.telegramCallback(payload)
        .then((r) => {
          if (r.user) onLoggedIn(r.user)
          else alert(r.error || 'Login failed')
        })
        .catch((e) => alert('Login failed: ' + e.message))
      return
    }

    // 2. Otherwise, render the Telegram Login Widget (best-effort — needs
    //    /setdomain in BotFather; the code form below always works).
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName || 'SelamCafeBot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    window.onTelegramAuth = (user) => {
      api.telegramCallback(user)
        .then((r) => {
          if (r.user) onLoggedIn(r.user)
          else alert(r.error || 'Login failed')
        })
        .catch((e) => alert('Login failed: ' + e.message))
    }

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(script)
  }, [botName, onLoggedIn])

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    setCodeError('')
    setCodeBusy(true)
    try {
      const r = await api.loginWithCode(code.trim())
      if (r.user) onLoggedIn(r.user)
      else setCodeError(r.error || 'Login failed')
    } catch (err) {
      setCodeError(err.message || 'Login failed')
    } finally {
      setCodeBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>☕ Selam Cafe</h1>
        <p>Admin dashboard — sign in with Telegram</p>

        {/* Method 1: bot-issued code (always works, no BotFather setup) */}
        <form onSubmit={handleCodeSubmit} style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', textAlign: 'left', marginBottom: 4 }}>
            Sign in with a code from the bot
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', letterSpacing: 4, fontSize: 18 }}
              autoFocus
            />
            <button type="submit" className="primary" disabled={codeBusy || code.length !== 6}>
              {codeBusy ? '…' : 'Sign in'}
            </button>
          </div>
          {codeError && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6, textAlign: 'left' }}>
              {codeError}
            </div>
          )}
          <p style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'left' }}>
            In Telegram, open the bot and send <code>/login</code> — it replies with a
            6-digit code. Codes last 10 minutes.
          </p>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e6e3dc' }} />
          <span style={{ fontSize: 11, color: '#999' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#e6e3dc' }} />
        </div>

        {/* Method 2: Telegram Login Widget (needs /setdomain in BotFather) */}
        <div ref={containerRef} style={{ minHeight: 56, display: 'flex', justifyContent: 'center' }} />

        <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>
          Only Telegram accounts on the admin allowlist (ADMIN_TELEGRAM_IDS) can sign in.
        </p>
      </div>
    </div>
  )
}
