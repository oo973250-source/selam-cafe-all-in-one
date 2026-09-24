import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getT, SUPPORTED_LANGS } from '../utils/i18n.js'

/**
 * LangContext — app-wide language state for the Mini App.
 *
 * Resolution order (highest first):
 *   1. User's in-app choice (persisted in localStorage)
 *   2. URL ?lang= (set by the bot's language buttons)
 *   3. Telegram user.language_code
 *   4. English
 *
 * getT() already handles 2/3/4 via URL + passed code; we layer the
 * localStorage override on top so the in-app switcher sticks.
 */

const LangContext = createContext(null)

const STORAGE_KEY = 'selam_lang'

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved
  } catch { /* not in a browser */ }
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang')
    if (urlLang) {
      const base = urlLang.toLowerCase().split('-')[0]
      const normalized = base === 'or' ? 'om' : base
      if (SUPPORTED_LANGS.includes(normalized)) return normalized
    }
  } catch { /* not in a browser */ }
  return null // fall through to Telegram language
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang)

  // Persist the user's explicit choice
  const choose = (next) => {
    if (!SUPPORTED_LANGS.includes(next)) return
    setLang(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }

  const value = useMemo(() => {
    return {
      lang,          // may be null if the user hasn't chosen in-app
      choose,
      // effective translation function: saved choice > Telegram default
      t: getT(lang || undefined),
    }
  }, [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}
