// App state: auth boot flow, nav stack (hash-free mini router), orders, categories, paused flag.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, authenticate, AccessDenied, SessionExpired, bindToast } from './api.js'
import { closeApp, haptic, initData, showConfirm } from './telegram.js'

const Ctx = createContext(null)

export const ACTIVE_STATUSES = ['new', 'preparing', 'ready']
export const SERVICE_LABELS = { dine_in: 'Dine in', takeaway: 'Takeaway', delivery: 'Delivery' }

// Page 7 store settings — ⚠️ INTEGRATION POINT: no contract endpoints yet.
// The server must own real intake blocking, closure_reason broadcast, and
// auto-resume when pause_until / close_until expire.
export const DEFAULT_SETTINGS = {
  order_limit: 0, // 0 = no cap
  pickup_throttle_min: 0, // 0 = no extra minutes
  delivery_available: true,
  paused: false, // emergency kill-switch (indefinite)
  pause_until: null, // ISO — duration pause w/ countdown
  close_until: null, // ISO — multi-day closure
  closure_reason: '',
}

// Single active restriction at a time: emergency > countdown > closed.
export function settingsStatus(s, now = Date.now()) {
  if (!s) return { kind: 'open', reason: '' }
  const pu = s.pause_until ? new Date(s.pause_until).getTime() : 0
  const cu = s.close_until ? new Date(s.close_until).getTime() : 0
  const reason = (s.closure_reason || '').trim()
  if (s.paused) return { kind: 'emergency', reason }
  if (pu > now) return { kind: 'countdown', until: pu, reason }
  if (cu > now) return { kind: 'closed', until: cu, reason }
  return { kind: 'open', reason }
}

export function AppProvider({ children }) {
  const [boot, setBoot] = useState('splash') // splash | gate | ok | denied | expired
  const [stack, setStack] = useState([{ name: 'orders' }]) // root tabs replace; deeper pages push
  // Browser-history mirror of the nav stack (Page 8 BackButton directive): the
  // baseline entry carries state { selam: 0 }, every pushed page adds one entry
  // { selam: depth }. popstate (hardware back / swipe / history.back) truncates
  // the stack to the entry's depth — history state is the single depth source.
  const histDepth = useRef(0) // pushed entries currently in browser history
  const stackRef = useRef(stack) // synchronous read for event handlers
  stackRef.current = stack
  const [adminUser, setAdminUser] = useState(null)
  const [orders, setOrders] = useState(null) // null = loading
  const [filter, setFilter] = useState('all') // all | dine_in | takeaway | delivery
  const [categories, setCategories] = useState(null)
  const [section, setSection] = useState('food') // 'food' | 'drink'
  const [paused, setPaused] = useState(false) // emergency pause (mirrors settings.paused)
  const [settings, setSettings] = useState(null) // Page 7 store settings (null = loading)
  const [noDelivery, setNoDelivery] = useState({}) // catId → bool (INTEGRATION POINT: no field yet)
  // Brand block text — LIVE from Page 9 on: profile.cafe_name (Page 1 decision #2).
  // Fallback keeps the pre-profile default until the profile loads / on failure.
  const [brandName, setBrandName] = useState('Medi Cafe')
  const [toastMsg, setToastMsg] = useState(null) // { msg, key }

  const toast = useCallback((msg) => {
    const key = Date.now() + Math.random()
    setToastMsg({ msg, key })
    // auto-dismiss; a newer toast (different key) is never cleared by an older timer
    setTimeout(() => {
      setToastMsg((cur) => (cur && cur.key === key ? null : cur))
    }, 2600)
  }, [])

  bindToast(toast)

  // ---------- auth boot ----------
  const doAuth = useCallback(async () => {
    const idt = initData()
    if (!idt) {
      // SDK present but no initData (opened outside Telegram) → still try; server decides
      try {
        const user = await authenticate('')
        setAdminUser(user)
        return user
      } catch (e) {
        if (e instanceof AccessDenied) setBoot('denied')
        else setBoot('expired')
        throw e
      }
    }
    try {
      const user = await authenticate(idt)
      setAdminUser(user)
      return user
    } catch (e) {
      if (e instanceof AccessDenied) setBoot('denied')
      else setBoot('expired')
      throw e
    }
  }, [])

  // ---------- navigation (history-synced, Page 8 directive) ----------
  // Root resets unwind EVERY pushed history entry (switchTab from a deep page,
  // e.g. Page 7 bottom-nav → Menu). go(-n) fires one popstate, which lands on
  // the baseline state and keeps the stack truncation idempotent.
  const switchTab = useCallback((name) => {
    setStack([{ name }])
    const n = histDepth.current
    if (n > 0) {
      histDepth.current = 0
      try {
        window.history.go(-n)
      } catch {
        /* no history API */
      }
    }
  }, [])

  // `extra` carries page payload (e.g. { category } for the items page)
  const push = useCallback((name, label, extra = {}) => {
    setStack((s) => [...s, { name, label, ...extra }])
    histDepth.current += 1
    try {
      window.history.pushState({ selam: histDepth.current }, '')
    } catch {
      /* no history API */
    }
  }, [])

  const back = useCallback(() => {
    if (stackRef.current.length <= 1) {
      closeApp() // root page → close the Mini App (user decision #7)
      return
    }
    if (histDepth.current > 0) {
      window.history.back() // popstate pops the stack — history stays in lockstep
    } else {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)) // fallback: no entries pushed
    }
  }, [])

  // Hardware/BackButton behavior (Page 8): Telegram fires onClick INSTEAD of
  // navigating webview history, so this handler owns the pop. A visible modal
  // eats the back action first (closes exactly like an outside tap).
  const telegramBack = useCallback(() => {
    const overlay = document.querySelector('.modal-overlay')
    if (overlay) {
      overlay.click()
      return
    }
    back()
  }, [back])

  // History ⇄ stack sync — registered once; baseline entry stamped immediately.
  useEffect(() => {
    try {
      window.history.replaceState({ selam: histDepth.current }, '')
    } catch {
      /* no history API */
    }
    const onPop = (e) => {
      const d = e.state && typeof e.state.selam === 'number' ? e.state.selam : 0
      histDepth.current = d
      setStack((s) => (s.length > d + 1 ? s.slice(0, d + 1) : s)) // shrink only (no stale forward jumps)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ---------- orders ----------
  const reloadOrders = useCallback(async () => {
    try {
      const d = await api.getOrders({ limit: 50 })
      setOrders(Array.isArray(d.orders) ? d.orders : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setOrders((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [])

  const pushNewOrder = useCallback((order) => {
    setOrders((prev) => (Array.isArray(prev) ? [order, ...prev.filter((o) => o.id !== order.id)] : [order]))
    haptic('success')
  }, [])

  const patchOrderLocal = useCallback((id, patch) => {
    setOrders((prev) => (Array.isArray(prev) ? prev.map((o) => (o.id === id ? { ...o, ...patch } : o)) : prev))
  }, [])

  const removeOrderLocal = useCallback((id) => {
    setOrders((prev) => (Array.isArray(prev) ? prev.filter((o) => o.id !== id) : prev))
  }, [])

  const startOrder = useCallback(
    async (order) => {
      if (order.status !== 'new') return
      haptic('light')
      // Page 1 v3: stamp WHO started cooking. The display name comes from the
      // authenticated admin (Telegram first name), is stored on the order via the
      // PATCH body, and is rendered as a top-left badge on every admin device —
      // so the team sees who is taking which order without asking around.
      // ⚠️ INTEGRATION NOTE: the real backend should derive the identity from its
      // own auth (Bearer token), treating the client-sent name as advisory only.
      const startedBy = String((adminUser && (adminUser.firstName || adminUser.name)) || 'Staff').trim()
      patchOrderLocal(order.id, { status: 'preparing', started_by: startedBy })
      try {
        await api.patchOrder(order.id, { status: 'preparing', started_by: startedBy })
        await reloadOrders() // RULES: refetch affected list after successful PATCH
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        else await reloadOrders()
      }
    },
    [adminUser, patchOrderLocal, reloadOrders],
  )

  // Page 1 v5 — TWO-STEP completion (user directive): tapping "Finished ✅" flips
  // the order to the done state (the bot notifies the customer) but the card STAYS
  // in the queue so the team can see it was just completed. The card only leaves
  // the queue when an admin explicitly taps the green "Done" button (dismissOrder).
  const finishOrder = useCallback(
    async (order) => {
      if (order.status === 'served' || order.status === 'cancelled') return
      haptic('light')
      patchOrderLocal(order.id, { status: 'served' }) // flip to done, keep visible
      try {
        await api.patchOrder(order.id, { status: 'served' })
        await reloadOrders() // server keeps served-until-dismissed orders in the list
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        else await reloadOrders()
      }
    },
    [patchOrderLocal, reloadOrders, setBoot],
  )

  // Step 2: "Done" removes the finished order from the live queue for every admin
  // device (dismissed orders remain visible in the order-history screen).
  // ⚠️ INTEGRATION POINT: persist a `dismissed_at` timestamp on the order row and
  // keep serving orders with status 'served' until they are dismissed.
  const dismissOrder = useCallback(
    async (order) => {
      haptic('light')
      patchOrderLocal(order.id, { dismissed_at: new Date().toISOString() }) // queue filter hides it instantly
      try {
        await api.patchOrder(order.id, { dismissed: true })
        await reloadOrders()
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        else await reloadOrders() // failure → server truth puts the card back
      }
    },
    [patchOrderLocal, reloadOrders, setBoot],
  )

  const cancelOrder = useCallback(
    async (order) => {
      const ok = await showConfirm(`Cancel order #${order.id}? This cannot be undone.`)
      if (!ok) return
      haptic('warning')
      removeOrderLocal(order.id)
      try {
        await api.patchOrder(order.id, { status: 'cancelled' })
        await reloadOrders()
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
      }
    },
    [removeOrderLocal, reloadOrders],
  )

  // Order details — an in-app bottom sheet (replaces the old native alert).
  // Both entry points open the SAME sheet: the live queue's "Details" button
  // (OrderCard) and the History screen (tap any row — customer details request).
  // The sheet itself is rendered once in App.jsx; hardware back closes it
  // (telegramBack clicks any open .modal-overlay first).
  const [detailsOrder, setDetailsOrder] = useState(null)
  const showOrderDetails = useCallback((order) => {
    haptic('select')
    setDetailsOrder(order)
  }, [])
  const closeOrderDetails = useCallback(() => setDetailsOrder(null), [])

  // ---------- categories ----------
  const reloadCategories = useCallback(async () => {
    try {
      const d = await api.getCategories()
      setCategories(Array.isArray(d.categories) ? d.categories : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setCategories((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [])

  const toggleCategoryHidden = useCallback(
    async (cat) => {
      haptic('light')
      const next = !cat.hidden
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, hidden: next } : c)))
      try {
        await api.patchCategory(cat.id, { hidden: next })
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadCategories() // revert to server truth on failure
      }
    },
    [reloadCategories],
  )

  // INTEGRATION POINT: no backend field for "No delivery" yet (RULES API has no such column).
  // Toggle is UI-local until the main AI adds e.g. category.no_delivery.
  const toggleNoDelivery = useCallback(async (cat) => {
    haptic('light')
    setNoDelivery((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
  }, [])

  // ---------- Categorize page (category CRUD, Page 5) ----------
  const addCategory = useCallback(
    async (name, sec, nameAm) => {
      await api.postCategory({ name_en: name.trim(), name_am: (nameAm || '').trim(), section: sec })
      await reloadCategories() // RULES: refetch after successful POST
    },
    [reloadCategories],
  )

  const renameCategory = useCallback(
    async (cat, name, nameAm) => {
      const next = name.trim()
      const nextAm = (nameAm || '').trim()
      setCategories((prev) =>
        Array.isArray(prev)
          ? prev.map((c) => (c.id === cat.id ? { ...c, name_en: next, name_am: nextAm } : c))
          : prev,
      )
      try {
        await api.patchCategory(cat.id, { name_en: next, name_am: nextAm })
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadCategories() // revert to server truth on failure
        return false
      }
    },
    [reloadCategories, setBoot],
  )

  // Optimistic move within the section, then POST the FULL ordered id list
  // (contract: reorder = complete list for ONE section). Revert via refetch on failure.
  const moveCategory = useCallback(
    async (cat, dir) => {
      if (!Array.isArray(categories)) return false
      const sec = categories
        .filter((c) => c.section === cat.section)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const idx = sec.findIndex((c) => c.id === cat.id)
      const to = idx + dir
      if (idx < 0 || to < 0 || to >= sec.length) return false
      const reordered = sec.slice()
      const [moved] = reordered.splice(idx, 1)
      reordered.splice(to, 0, moved)
      const ids = reordered.map((c) => c.id)
      setCategories((prev) =>
        prev.map((c) =>
          c.section === cat.section && ids.includes(c.id) ? { ...c, sort_order: ids.indexOf(c.id) } : c,
        ),
      )
      try {
        await api.reorderCategories(ids)
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadCategories()
        return false
      }
    },
    [categories, reloadCategories, setBoot],
  )

  // Delete with the contract's 409 → ?force=true chain:
  // DELETE → 409 { itemCount } → confirm "delete category AND its items" → DELETE ?force=true
  const removeCategory = useCallback(
    async (cat) => {
      const ok = await showConfirm(`Delete "${cat.name_en}"?`)
      if (!ok) return false
      haptic('warning')
      try {
        await api.deleteCategory(cat.id)
      } catch (e) {
        if (e instanceof SessionExpired) {
          setBoot('expired')
          return false
        }
        if (e && e.kind === 'http' && e.status === 409) {
          const n = e.data && typeof e.data.itemCount === 'number' ? e.data.itemCount : null
          const ok2 = await showConfirm(
            `"${cat.name_en}" still has ${n === null ? 'some' : n} item${n === 1 ? '' : 's'} inside. Delete the category AND those items?`,
          )
          if (!ok2) return false
          haptic('warning')
          try {
            await api.deleteCategory(cat.id, true)
          } catch (e2) {
            if (e2 instanceof SessionExpired) setBoot('expired')
            await reloadCategories()
            return false
          }
        } else {
          await reloadCategories() // error already toasted by the api layer
          return false
        }
      }
      haptic('success')
      toast('Category deleted')
      setNoDelivery((prev) => {
        const next = { ...prev }
        delete next[cat.id]
        return next
      })
      await reloadCategories()
      return true
    },
    [reloadCategories, setBoot, toast],
  )

  // ---------- staff admins (Page 6) — ⚠️ INTEGRATION POINT: no contract endpoints yet ----------
  const [admins, setAdmins] = useState(null) // null = loading
  const [metricsPeriod, setMetricsPeriod] = useState('day') // day | week | month

  const reloadAdmins = useCallback(async () => {
    try {
      const d = await api.getAdmins()
      setAdmins(Array.isArray(d.admins) ? d.admins : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setAdmins((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [])

  // Instant verification (user: "The system checks the ID via Telegram Bot API") —
  // real Bot-API lookup = server-side endpoint pending; harness resolves a demo profile.
  const verifyAdmin = useCallback(async (idOrName) => {
    const d = await api.adminVerify(idOrName)
    return d.profile || d
  }, [])

  const addAdmin = useCallback(
    async (payload) => {
      await api.postAdmin(payload)
      await reloadAdmins() // RULES: refetch after successful POST
    },
    [reloadAdmins],
  )

  // Optimistic patch (instant toggle feel) → revert to server truth on failure.
  const updateAdmin = useCallback(
    async (admin, patch) => {
      setAdmins((prev) =>
        Array.isArray(prev) ? prev.map((a) => (a.tg_user_id === admin.tg_user_id ? { ...a, ...patch } : a)) : prev,
      )
      try {
        await api.patchAdmin(admin.tg_user_id, patch)
        await reloadAdmins()
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadAdmins()
        return false
      }
    },
    [reloadAdmins, setBoot],
  )

  // Revoke = destructive → showConfirm first (RULES), then DELETE + archive note.
  const revokeAdmin = useCallback(
    async (admin) => {
      const ok = await showConfirm(
        `Revoke admin access for "${admin.name}"? Their shift history will be archived.`,
      )
      if (!ok) return false
      haptic('warning')
      try {
        await api.deleteAdmin(admin.tg_user_id)
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadAdmins()
        return false
      }
      haptic('success')
      toast('Admin access revoked')
      await reloadAdmins()
      return true
    },
    [reloadAdmins, setBoot, toast],
  )

  // ---------- store settings (Page 7 admin panel) — ⚠️ INTEGRATION POINT ----------
  // Harness serves contract-shaped stubs so every control is clickable.
  const reloadSettings = useCallback(async () => {
    try {
      const d = await api.getSettings()
      const s = { ...DEFAULT_SETTINGS, ...(d.settings || d) }
      setSettings(s)
      setPaused(!!s.paused)
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setSettings((prev) => prev || DEFAULT_SETTINGS)
    }
  }, [])

  // Generic optimistic patch → revert to server truth on failure.
  const updateSettings = useCallback(
    async (patch) => {
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...(prev || {}), ...patch }))
      try {
        const d = await api.patchSettings(patch)
        const s = { ...DEFAULT_SETTINGS, ...(d.settings || d) }
        setSettings(s)
        setPaused(!!s.paused)
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        await reloadSettings()
        return false
      }
    },
    [reloadSettings, setBoot],
  )

  // Emergency kill-switch — instant halt, no countdown involved (Page 7).
  // Resuming reopens the store regardless of any running countdown/closure.
  const togglePaused = useCallback(async () => {
    const ok = await showConfirm(
      paused
        ? 'Resume accepting customer orders?'
        : 'EMERGENCY PAUSE — halt ALL incoming customer orders immediately?',
    )
    if (!ok) return
    haptic('warning')
    const done = await updateSettings({ paused: !paused, pause_until: null, close_until: null })
    if (done) toast(paused ? 'Orders resumed' : 'Orders paused — emergency kill-switch ON')
    return done
  }, [paused, updateSettings, toast])

  // Duration pause → countdown with auto-resume (server owns the authoritative timer).
  const startPauseCountdown = useCallback(
    async (minutes, reason) => {
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      const ok = await showConfirm(
        `Pause orders for ${h}h ${String(m).padStart(2, '0')}m? Customers can't order until it ends.`,
      )
      if (!ok) return false
      haptic('warning')
      const until = new Date(Date.now() + minutes * 60_000).toISOString()
      const done = await updateSettings({
        pause_until: until,
        paused: false,
        close_until: null,
        closure_reason: reason,
      })
      if (done) toast('Countdown started — orders paused')
      return done
    },
    [updateSettings, toast],
  )

  const stopPauseCountdown = useCallback(async () => {
    const ok = await showConfirm('Stop the countdown and start accepting orders again?')
    if (!ok) return false
    haptic('warning')
    const done = await updateSettings({ pause_until: null })
    if (done) toast('Pause ended — orders resumed')
    return done
  }, [updateSettings, toast])

  const closeForDays = useCallback(
    async (days, reason) => {
      const ok = await showConfirm(`Close the store for ${days} day${days === 1 ? '' : 's'}?`)
      if (!ok) return false
      haptic('warning')
      const until = new Date(Date.now() + days * 24 * 3_600_000).toISOString()
      const done = await updateSettings({
        close_until: until,
        paused: false,
        pause_until: null,
        closure_reason: reason,
      })
      if (done) toast(`Store closed until ${new Date(until).toLocaleDateString()}`)
      return done
    },
    [updateSettings, toast],
  )

  const reopenStore = useCallback(async () => {
    const ok = await showConfirm('Reopen the store and start accepting orders again?')
    if (!ok) return false
    haptic('warning')
    const done = await updateSettings({ close_until: null })
    if (done) toast('Store reopened')
    return done
  }, [updateSettings, toast])

  const setDeliveryAvailable = useCallback(
    (v) => {
      haptic('light')
      return updateSettings({ delivery_available: !!v })
    },
    [updateSettings],
  )

  const setOrderLimit = useCallback(
    // No business cap (user directive): the admin decides the maximum — 0 = no
    // cap, 9999 is only a sanity bound against typos.
    (n) => updateSettings({ order_limit: Math.max(0, Math.min(9999, Math.round(Number(n)) || 0)) }),
    [updateSettings],
  )

  const setPickupThrottle = useCallback(
    (n) => updateSettings({ pickup_throttle_min: Math.max(0, Math.min(120, Math.round(Number(n)) || 0)) }),
    [updateSettings],
  )

  const saveClosureReason = useCallback(
    async (text) => {
      const done = await updateSettings({ closure_reason: String(text || '').slice(0, 500) })
      if (done) toast('Closure note saved')
      return done
    },
    [updateSettings, toast],
  )

  // Realtime push handlers (socket.io) — the server can broadcast changes so every
  // admin device reacts instantly without waiting for a refetch. The Profile page
  // is the cafe-identity CONTROLLER: a profile:update push (e.g. someone changed
  // the cafe name on another device) refreshes the header brand everywhere.
  const applyServerSettings = useCallback((s) => {
    const next = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) }
    setSettings(next)
    setPaused(!!next.paused)
  }, [])

  const applyServerAnnouncement = useCallback(
    (a) => {
      if (!a || !a.id) return
      setAnnouncements((prev) => {
        const base = Array.isArray(prev) ? prev : []
        if (base.some((x) => x.id === a.id)) return base
        return [a, ...base]
      })
      toast('New announcement')
    },
    [toast],
  )

  // ---------- revenue analytics (Page 8) — ⚠️ INTEGRATION POINT ----------
  // No contract endpoints (only stats/today exists). Harness serves per-period
  // stubs; suggested shape: { orders, revenue (ETB int), delivered }.
  const [revenuePeriod, setRevenuePeriodState] = useState('day') // day | week | month
  const [revenue, setRevenue] = useState(null) // { period, orders, revenue, delivered } | null = loading
  const revPeriodRef = useRef('day') // discards out-of-order responses on quick toggles

  const reloadRevenue = useCallback(
    async (p) => {
      const period = p || 'day'
      revPeriodRef.current = period
      try {
        const d = await api.getRevenueStats(period)
        if (revPeriodRef.current !== period) return // a newer period took over
        setRevenue({ period, orders: d.orders ?? 0, revenue: d.revenue ?? 0, delivered: d.delivered ?? 0 })
      } catch (e) {
        if (revPeriodRef.current !== period) return
        if (e instanceof SessionExpired) setBoot('expired')
        setRevenue({ period, orders: null, revenue: null, delivered: null }) // api layer already toasted
      }
    },
    [setBoot],
  )

  const setRevenuePeriod = useCallback(
    (p) => {
      setRevenuePeriodState(p)
      setRevenue(null) // loading while the new period fetches
      reloadRevenue(p)
    },
    [reloadRevenue],
  )

  // ---------- reports: pause history (Page 7 bottom-nav) — ⚠️ INTEGRATION POINT ----------
  // GET /api/admin-miniapp/pause-history → { history: [{ id, kind: 'emergency'|
  // 'countdown'|'closed', reason, started_at, ended_at }] }. The server should
  // append an entry whenever intake is paused/closed and stamp ended_at on resume.
  const [pauseHistory, setPauseHistory] = useState(null) // null = loading

  const reloadPauseHistory = useCallback(async () => {
    try {
      const d = await api.getPauseHistory()
      setPauseHistory(Array.isArray(d.history) ? d.history : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setPauseHistory((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [setBoot])

  // ---------- announcements (Page 7 bottom-nav) — ⚠️ INTEGRATION POINT ----------
  // GET|POST /api/admin-miniapp/announcements — list (newest first) + send.
  // The server must fan each announcement out to the customer app / bot channel.
  const [announcements, setAnnouncements] = useState(null) // null = loading

  const reloadAnnouncements = useCallback(async () => {
    try {
      const d = await api.getAnnouncements()
      setAnnouncements(Array.isArray(d.announcements) ? d.announcements : [])
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setAnnouncements((prev) => (Array.isArray(prev) ? prev : []))
    }
  }, [setBoot])

  const sendAnnouncement = useCallback(
    async (message) => {
      const text = String(message || '').trim()
      if (!text) return false
      try {
        const d = await api.postAnnouncement({ message: text })
        if (d && d.announcement) {
          setAnnouncements((prev) => {
            const base = Array.isArray(prev) ? prev : []
            return [d.announcement, ...base.filter((a) => a.id !== d.announcement.id)]
          })
        } else {
          await reloadAnnouncements()
        }
        toast('Announcement sent ✓')
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        return false // api layer already toasted the failure
      }
    },
    [reloadAnnouncements, setBoot, toast],
  )

  // ---------- cafe profile (Page 9) — ⚠️ INTEGRATION POINT ----------
  // No contract endpoints. Harness serves contract-shaped stubs. cafe_name
  // feeds the header brand block (Page 1 decision #2 wiring).
  const [profile, setProfile] = useState(null) // null = loading

  const applyProfile = useCallback((p) => {
    const next = p && typeof p === 'object' ? p : {}
    setProfile(next)
    if (next.cafe_name && String(next.cafe_name).trim()) setBrandName(String(next.cafe_name).trim())
  }, [])

  // Refetch on boot and on every Profile-page entry; the page seeds its form
  // from the store state change (falls back to previous data on failure).
  const reloadProfile = useCallback(async () => {
    try {
      const d = await api.getProfile()
      applyProfile(d.profile || d)
    } catch (e) {
      if (e instanceof SessionExpired) setBoot('expired')
      setProfile((prev) => prev || {}) // api layer already toasted
    }
  }, [applyProfile, setBoot])

  // PATCH + server-truth merge; brand refreshes via applyProfile. Returns success.
  const saveProfile = useCallback(
    async (patch) => {
      try {
        const d = await api.patchProfile(patch)
        applyProfile(d.profile || d)
        return true
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        return false
      }
    },
    [applyProfile, setBoot],
  )

  const value = useMemo(
    () => ({
      boot, setBoot, stack, switchTab, push, back, telegramBack,
      revenuePeriod, revenue, reloadRevenue, setRevenuePeriod,
      profile, reloadProfile, saveProfile,
      adminUser, orders, filter, setFilter, paused, setPaused, togglePaused,
      noDelivery, toggleNoDelivery, brandName, setBrandName,
      doAuth, reloadOrders, pushNewOrder, startOrder, finishOrder, dismissOrder, cancelOrder, showOrderDetails,
      detailsOrder, closeOrderDetails,
      patchOrderLocal, applyProfile, applyServerSettings, applyServerAnnouncement,
      categories, section, setSection, reloadCategories, toggleCategoryHidden,
      addCategory, renameCategory, moveCategory, removeCategory,
      admins, metricsPeriod, setMetricsPeriod, reloadAdmins, verifyAdmin, addAdmin, updateAdmin, revokeAdmin,
      settings, reloadSettings, updateSettings, startPauseCountdown, stopPauseCountdown,
      closeForDays, reopenStore, setDeliveryAvailable, setOrderLimit, setPickupThrottle, saveClosureReason,
      pauseHistory, reloadPauseHistory,
      announcements, reloadAnnouncements, sendAnnouncement,
      toastMsg, toast,
    }),
    [
      boot, stack, switchTab, push, back, telegramBack,
      revenuePeriod, revenue, reloadRevenue, setRevenuePeriod,
      profile, reloadProfile, saveProfile,
      adminUser, orders, filter, paused, togglePaused,
      noDelivery, toggleNoDelivery, brandName, doAuth, reloadOrders, pushNewOrder,
      startOrder, finishOrder, dismissOrder, cancelOrder, showOrderDetails,
      detailsOrder, closeOrderDetails,
      patchOrderLocal, applyProfile, applyServerSettings, applyServerAnnouncement,
      categories, section, reloadCategories, toggleCategoryHidden,
      addCategory, renameCategory, moveCategory, removeCategory,
      admins, metricsPeriod, reloadAdmins, verifyAdmin, addAdmin, updateAdmin, revokeAdmin,
      settings, reloadSettings, updateSettings, startPauseCountdown, stopPauseCountdown,
      closeForDays, reopenStore, setDeliveryAvailable, setOrderLimit, setPickupThrottle, saveClosureReason,
      pauseHistory, reloadPauseHistory,
      announcements, reloadAnnouncements, sendAnnouncement,
      toastMsg, toast,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
