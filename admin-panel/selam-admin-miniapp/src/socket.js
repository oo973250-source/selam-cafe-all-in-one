// Live updates — RULES #4: socket.io-client, same origin, default path,
// listen to `order:new` (payload = the new order object) → prepend instantly.
import { io } from 'socket.io-client'

let socket = null

export function initSocket(onNewOrder) {
  if (socket) return socket
  try {
    socket = io('/', { path: '/socket.io' }) // same origin, default path — no explicit URL/port
    socket.on('order:new', (order) => {
      if (order && onNewOrder) onNewOrder(order)
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
