// App state: auth boot flow, nav stack (hash-free mini router), orders, categories, paused flag.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, authenticate, AccessDenied, SessionExpired, bindToast } from './api.js'
import { closeApp, haptic, initData, showConfirm, showAlert } from './telegram.js'

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
  const [adminUser, setAdminUser] = useState(null)
  const [orders, setOrders] = useState(null) // null = loading
  const [filter, setFilter] = useState('all') // all | dine_in | takeaway | delivery
  const [categories, setCategories] = useState(null)
  const [section, setSection] = useState('food') // 'food' | 'drink'
  const [paused, setPaused] = useState(false) // emergency pause (mirrors settings.paused)
  const [settings, setSettings] = useState(null) // Page 7 store settings (null = loading)
  const [noDelivery, setNoDelivery] = useState({}) // catId → bool (INTEGRATION POINT: no field yet)
  const [brandName, setBrandName] = useState('Selam Cafe') // dynamic — wired to Profile page later (remember-list)
  const [doneIds, setDoneIds] = useState([]) // orders showing "Done" for ~0.7s before disappearing
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
      // No initData = the page was opened outside a Mini App context (e.g.
      // in the in-app browser or refresh-from-browser). Auth can never succeed
      // here (server requires Telegram initData), so show the dedicated
      // "Open in Telegram" gate instead of a misleading session-expired screen.
      setBoot('gate')
      throw new Error('no telegram initData')
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

  // ---------- navigation ----------
  const switchTab = useCallback((name) => setStack([{ name }]), [])
  // `extra` carries page payload (e.g. { category } for the items page)
  const push = useCallback((name, label, extra = {}) => setStack((s) => [...s, { name, label, ...extra }]), [])
  const back = useCallback(() => {
    setStack((s) => {
      if (s.length <= 1) {
        closeApp() // root page → close the Mini App (user decision #7)
        return s
      }
      return s.slice(0, -1)
    })
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
      patchOrderLocal(order.id, { status: 'preparing' })
      try {
        await api.patchOrder(order.id, { status: 'preparing' })
        await reloadOrders() // RULES: refetch affected list after successful PATCH
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
        else await reloadOrders()
      }
    },
    [patchOrderLocal, reloadOrders],
  )

  const finishOrder = useCallback(
    async (order) => {
      haptic('light')
      setDoneIds((d) => [...d, order.id]) // button flips to "Done" first…
      try {
        await api.patchOrder(order.id, { status: 'served' })
      } catch (e) {
        if (e instanceof SessionExpired) setBoot('expired')
      }
      setTimeout(async () => {
        setDoneIds((d) => d.filter((x) => x !== order.id))
        removeOrderLocal(order.id) // …then the order disappears
        await reloadOrders()
      }, 700)
    },
    [removeOrderLocal, reloadOrders],
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

  const showOrderDetails = useCallback(async (order) => {
    haptic('select')
    const name = order.customer_name || order.tg_first_name || order.tg_username || '-'
    const phone = order.customer_phone || order.phone || (order.customer_loc && order.customer_loc.phone) || '-'
    await showAlert(`Customer details\n\nName: ${name}\nPhone: ${phone}\nTicket: #${order.id}`)
  }, [])

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
    async (name, sec) => {
      await api.postCategory({ name_en: name.trim(), section: sec })
      await reloadCategories() // RULES: refetch after successful POST
    },
    [reloadCategories],
  )

  const renameCategory = useCallback(
    async (cat, name) => {
      const next = name.trim()
      setCategories((prev) =>
        Array.isArray(prev) ? prev.map((c) => (c.id === cat.id ? { ...c, name_en: next } : c)) : prev,
      )
      try {
        await api.patchCategory(cat.id, { name_en: next })
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
    (n) => updateSettings({ order_limit: Math.max(0, Math.min(99, Math.round(Number(n)) || 0)) }),
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

  const value = useMemo(
    () => ({
      boot, setBoot, stack, switchTab, push, back,
      adminUser, orders, filter, setFilter, paused, setPaused, togglePaused,
      noDelivery, toggleNoDelivery, brandName, setBrandName,
      doAuth, reloadOrders, pushNewOrder, startOrder, finishOrder, cancelOrder, showOrderDetails, doneIds,
      categories, section, setSection, reloadCategories, toggleCategoryHidden,
      addCategory, renameCategory, moveCategory, removeCategory,
      admins, metricsPeriod, setMetricsPeriod, reloadAdmins, verifyAdmin, addAdmin, updateAdmin, revokeAdmin,
      settings, reloadSettings, updateSettings, startPauseCountdown, stopPauseCountdown,
      closeForDays, reopenStore, setDeliveryAvailable, setOrderLimit, setPickupThrottle, saveClosureReason,
      toastMsg, toast,
    }),
    [
      boot, stack, switchTab, push, back, adminUser, orders, filter, paused, togglePaused,
      noDelivery, toggleNoDelivery, brandName, doAuth, reloadOrders, pushNewOrder,
      startOrder, finishOrder, cancelOrder, showOrderDetails, doneIds,
      categories, section, reloadCategories, toggleCategoryHidden,
      addCategory, renameCategory, moveCategory, removeCategory,
      admins, metricsPeriod, reloadAdmins, verifyAdmin, addAdmin, updateAdmin, revokeAdmin,
      settings, reloadSettings, updateSettings, startPauseCountdown, stopPauseCountdown,
      closeForDays, reopenStore, setDeliveryAvailable, setOrderLimit, setPickupThrottle, saveClosureReason,
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
