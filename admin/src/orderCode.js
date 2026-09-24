/**
 * orderCode.js
 * ------------
 * Shared order-code formatting for the admin dashboard.
 * Global order-code format: #5 → MC-0005 (matches bot + miniapp).
 */
export function orderCode(orderId) {
  return `MC-${String(orderId).padStart(4, '0')}`
}
