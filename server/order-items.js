/**
 * server/order-items.js
 * ---------------------
 * ONE canonical item normalizer used by bot.js, routes/miniapp.js and
 * routes/orders.js so ordered items always carry BOTH naming shapes
 * (name/nameEn/nameAm) and BOTH quantity shapes (qty/quantity).
 *
 * Fixes: "2x undefined" on the admin card and missing/undefined item
 * lines in the customer confirmation — every writer/pusher now uses the
 * same fallback chain (name → nameEn → nameAm → id → '?').
 */
export function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((i) => i && typeof i === 'object')
    .map((i) => {
      const name = i.name || i.nameEn || i.nameAm || i.name_en || i.name_am || i.id || '?'
      const quantity = Number.isFinite(i.quantity)
        ? i.quantity
        : Number.isFinite(i.qty) ? i.qty : 1
      return {
        ...i,
        id: i.id ?? `item_${Math.random().toString(36).slice(2, 8)}`,
        name,
        nameEn: i.nameEn || name,
        nameAm: i.nameAm ?? i.name_am ?? null,
        price: Number.isFinite(i.price) ? i.price : Number(i.price) || 0,
        qty: Number.isFinite(i.qty) ? i.qty : quantity,
        quantity,
      }
    })
}

export function normalizeOrderRow(row) {
  if (!row || typeof row !== 'object') return row
  return { ...row, items: normalizeOrderItems(row.items) }
}

/**
 * Customer confirmation payload — createOrder() returns only
 * { id, tg_user_id }, while buildOrderMessage() needs items/total/status.
 * Merge the verified payload back in so the receipt lists EVERY item with
 * the right names, quantities and total (Issue: "confirmation lists no /
 * undefined items").
 */
export function mergeOrderForMessages(order, payload) {
  const p = payload || {}
  return {
    ...order,
    items: normalizeOrderItems(Array.isArray(p.items) ? p.items : order?.items),
    total: order?.total ?? p.total ?? 0,
    service_type: order?.service_type || p.serviceType || p.service_type,
    status: order?.status || 'new',
    // Phone passthrough (user request): the label shows in BOTH the
    // customer receipt and the staff alert when the customer left one.
    customer_phone: order?.customer_phone ||
      (p.customer?.phone ? String(p.customer.phone).trim() : null),
  }
}
