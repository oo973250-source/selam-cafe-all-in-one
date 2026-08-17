/**
 * server/chapa-client.js
 * ----------------------
 * Chapa API wrapper. Mock mode supported.
 */

import 'dotenv/config'

const CHAPA_BASE = 'https://api.chapa.co/v1'
const CURRENCY = 'ETB'

const SECRET_KEY = process.env.CHAPA_SECRET_KEY
const MOCK_MODE = process.env.MOCK_MODE === 'true'

export function generateTxRef() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `cafe-${ts}-${rand}`
}

export async function initializePayment({
  amount, email, firstName, lastName = '', txRef,
  callbackUrl, returnUrl, description = 'Selam Cafe order',
}) {
  const ref = txRef || generateTxRef()

  if (MOCK_MODE) {
    console.info('[chapa] MOCK initializePayment ->', { amount, email, firstName, ref })
    await new Promise((r) => setTimeout(r, 800))
    return { status: 'success', txRef: ref, checkoutUrl: null, raw: { mocked: true } }
  }

  if (!SECRET_KEY) {
    return { status: 'failed', txRef: ref, checkoutUrl: null, raw: { error: 'CHAPA_SECRET_KEY not set' } }
  }

  try {
    const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: CURRENCY,
        email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: ref,
        callback_url: callbackUrl,
        return_url: returnUrl,
        customization: {
          title: 'Selam Cafe',
          description,
        },
      }),
    })
    const data = await res.json()
    if (data?.status === 'success' && data?.data?.checkout_url) {
      return { status: 'success', txRef: ref, checkoutUrl: data.data.checkout_url, raw: data }
    }
    return { status: 'failed', txRef: ref, checkoutUrl: null, raw: data }
  } catch (err) {
    return { status: 'failed', txRef: ref, checkoutUrl: null, raw: { error: String(err) } }
  }
}

export async function verifyPayment(txRef) {
  if (MOCK_MODE) {
    console.info('[chapa] MOCK verifyPayment ->', txRef)
    await new Promise((r) => setTimeout(r, 500))
    return { status: 'success', paid: true, raw: { mocked: true } }
  }

  if (!SECRET_KEY) {
    return { status: 'failed', paid: false, raw: { error: 'CHAPA_SECRET_KEY not set' } }
  }

  try {
    const res = await fetch(`${CHAPA_BASE}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    })
    const data = await res.json()
    const paid =
      data?.status === 'success' &&
      (data?.data?.status === 'success' || data?.data?.status === 'paid')
    return { status: paid ? 'success' : 'failed', paid, raw: data }
  } catch (err) {
    return { status: 'failed', paid: false, raw: { error: String(err) } }
  }
}
