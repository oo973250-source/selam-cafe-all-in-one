import React, { useEffect, useRef } from 'react'
import { api } from '../api.js'

/**
 * Login
 * -----
 * Renders the Telegram Login Widget. On successful Telegram auth,
 * the widget redirects back to this page with the auth fields in the URL
 * hash. We pick those up and POST them to /api/auth/telegram-callback.
 */
export default function Login({ onLoggedIn, botName }) {
  const containerRef = useRef(null)

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

    // 2. Otherwise, render the Telegram Login Widget
    if (containerRef.current && window.TelegramLoginWidget) {
      window.TelegramLoginWidget({
        bot_id: undefined, // populated from bot_name
        size: 'large',
        onauth: (user) => {
          // Direct callback (only works for the redirectless variant)
          api.telegramCallback(user).then((r) => onLoggedIn(r.user))
        },
        // bot_name is required for the redirectless variant on a configured domain
      })
    }

    // 3. Inject the official Telegram widget script
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

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>☕ Selam Cafe</h1>
        <p>Admin dashboard — sign in with Telegram</p>

        <div ref={containerRef} style={{ minHeight: 56, display: 'flex', justifyContent: 'center' }} />

        <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>
          Only Telegram accounts on the admin allowlist can sign in.
        </p>
      </div>
    </div>
  )
}
