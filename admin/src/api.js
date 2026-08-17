/**
 * api.js
 * ------
 * Small fetch wrapper. Uses credentials: 'include' for cookie auth.
 */

const BASE = '/api'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    credentials: 'include',
  })

  if (res.status === 401) {
    // Not authenticated — caller should redirect to /login
    return { _unauthorized: true }
  }

  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* not json */ }

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  return json
}

export const api = {
  // Auth
  me: () => request('/auth/me'),
  telegramCallback: (payload) =>
    request('/auth/telegram-callback', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Orders
  listOrders: (params = '') => request(`/orders${params}`),
  getOrder: (id) => request(`/orders/${id}`),
  updateOrder: (id, body) =>
    request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  todayStats: () => request('/orders/stats/today'),

  // Menu
  listMenu: (params = '') => request(`/menu${params}`),
  createMenuItem: (body) =>
    request('/menu', { method: 'POST', body: JSON.stringify(body) }),
  updateMenuItem: (id, body) =>
    request(`/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMenuItem: (id) =>
    request(`/menu/${id}`, { method: 'DELETE' }),
}
