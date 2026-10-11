// Live updates — socket.io-client, same origin, default path.
// Realtime event catalog (server → admin miniapp). The real backend should emit
// these so every admin device reacts at SUPER SPEED without polling — the
// polling refetches in the store remain the offline fallback.
//
//   order:new         full new order object      → prepended to the live queue
//   order:update      { id, ...partial patch }   → one order patched in place
//                       (status / started_by / dismissed_at changes made by
//                       another admin device or the bot arrive instantly)
//   settings:update   full store-settings object → pause / closure / delivery
//                       state syncs on every admin device immediately
//   profile:update    full cafe profile object   → the Profile page is the
//                       cafe-identity CONTROLLER: when the cafe name (or any
//                       profile field) changes, every device — admin panel AND
//                       customer app AND bot message templates — re-renders
//                       with the new identity instantly.
//   announcement:new  announcement object        → announcements list + toast
import { io } from 'socket.io-client'

let socket = null

export function initSocket(handlers = {}) {
  if (socket) return socket
  try {
    socket = io('/', { path: '/socket.io' }) // same origin, default path — no explicit URL/port
    socket.on('order:new', (order) => {
      if (order && handlers.onNewOrder) handlers.onNewOrder(order)
    })
    socket.on('order:update', (data) => {
      if (data && handlers.onOrderUpdate) handlers.onOrderUpdate(data)
    })
    socket.on('settings:update', (s) => {
      if (s && handlers.onSettingsUpdate) handlers.onSettingsUpdate(s)
    })
    socket.on('profile:update', (p) => {
      if (p && handlers.onProfileUpdate) handlers.onProfileUpdate(p)
    })
    socket.on('announcement:new', (a) => {
      if (a && handlers.onAnnouncement) handlers.onAnnouncement(a)
    })
    socket.on('connect_error', () => {
      /* backend offline (e.g. preview harness) — polling refetch still covers us */
    })
  } catch {
    socket = null
  }
  return socket
}

export function closeSocket() {
  try {
    if (socket) socket.disconnect()
  } catch {
    /* noop */
  }
  socket = null
}
