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
  loginWithCode: (code) =>
    request('/auth/login-code', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Orders
  listOrders: (params = '') => request(`/orders${params}`),
  getOrder: (id) => request(`/orders/${id}`),
  updateOrder: (id, body) =>
    request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  todayStats: () => request('/orders/stats/today'),

  // Menu items
  listMenu: (params = '') => request(`/menu${params}`),
  createMenuItem: (body) =>
    request('/menu', { method: 'POST', body: JSON.stringify(body) }),
  updateMenuItem: (id, body) =>
    request(`/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMenuItem: (id) =>
    request(`/menu/${id}`, { method: 'DELETE' }),

  // Menu categories (Task 2: independent Food / Drink sections)
  listCategories: () => request('/menu/categories'),
  createCategory: (body) =>
    request('/menu/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) =>
    request(`/menu/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reorderCategories: (section, ids) =>
    request('/menu/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ section, ids }),
    }),
  deleteCategory: (id, force = false) =>
    request(`/menu/categories/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' }),

  // Blocked users (Task 4: scammer protection)
  listBlockedUsers: () => request('/blocked-users'),
  blockUser: (body) =>
    request('/blocked-users', { method: 'POST', body: JSON.stringify(body) }),
  unblockUser: (id) =>
    request(`/blocked-users/${id}`, { method: 'DELETE' }),

  // Customer directory (search past orders by name/username/id)
  listCustomers: (params = '') => request(`/blocked-users/customers/directory${params}`),
}
