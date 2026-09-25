import React, { createContext, useContext, useMemo } from 'react'
import { getT, normalizeLang, SUPPORTED_LANGS } from '../utils/i18n.js'

/**
 * LangContext — the ONE source of truth for the active locale (Task 3).
 *
 * Resolution happens exactly ONCE, synchronously, before the first paint:
 *   1. URL ?lang=        — the bot appends this to EVERY Mini App URL it
 *                          sends (language buttons, per-chat Menu Button),
 *                          reflecting the language the user picked in the
 *                          bot and persisted in the `user_langs` DB table.
 *   2. Telegram client   — window.Telegram.WebApp.initDataUnsafe.user.
 *                          language_code, read synchronously (no effect /
 *                          no second render), normalised via normalizeLang.
 *   3. English.
 *
 * Every screen MUST read the locale through useLang() — never call getT()
 * with a per-screen default, and never read localStorage/URL itself. That is
 * what caused the old "UI silently reverts to English after picking a
 * category" bug: frames without context fell back to English.
 */

const LangContext = createContext(null)

function urlLang() {
  try {
    const raw = new URLSearchParams(window.location.search).get('lang')
    if (!raw) return null
    const normalized = normalizeLang(raw)
    return SUPPORTED_LANGS.includes(normalized) ? normalized : null
  } catch {
    return null
  }
}

function telegramLang() {
  try {
    const code = window?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
    if (!code) return null
    const normalized = normalizeLang(code)
    return SUPPORTED_LANGS.includes(normalized) ? normalized : null
  } catch {
    return null
  }
}

/** Resolved once at module-eval/provider-mount time — stable for the session. */
function resolveInitialLang() {
  return urlLang() || telegramLang() || 'en'
}

export function LangProvider({ children }) {
  // Initialized from URL/Telegram only — there is no in-app language picker
  // any more (the bot owns language selection), so nothing can change it
  // mid-session and every screen always agrees.
  const lang = useMemo(resolveInitialLang, [])

  const value = useMemo(() => ({
    lang,
    t: getT(lang),
  }), [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}
