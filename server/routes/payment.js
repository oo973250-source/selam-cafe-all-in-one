/**
 * server/routes/payment.js
 * ------------------------
 * Chapa payment proxy routes (mounted at /api/payment).
 */

import { Router } from 'express'
import 'dotenv/config'

import { initializePayment, verifyPayment } from '../chapa-client.js'
import { updatePaymentStatus } from '../db.js'

const router = Router()

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const RETURN_URL = process.env.WEBAPP_URL || ''

router.post('/initialize', async (req, res) => {
  const { amount, email, firstName, lastName, txRef, description } = req.body || {}
  if (!amount || !email || !firstName) {
    return res.status(400).json({ status: 'failed', error: 'amount, email, and firstName are required' })
  }

  const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/webhook`

  const result = await initializePayment({
    amount, email, firstName, lastName, txRef, description,
    callbackUrl,
    returnUrl: RETURN_URL || `${req.protocol}://${req.get('host')}/`,
  })

  return res.status(result.status === 'success' ? 200 : 502).json(result)
})

router.get('/verify/:txRef', async (req, res) => {
  const { txRef } = req.params
  if (!txRef) return res.status(400).json({ status: 'failed', error: 'txRef required' })
  const result = await verifyPayment(txRef)
  return res.json(result)
})

router.post('/webhook', async (req, res) => {
  const authHeader = req.headers['authorization'] || ''
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '')

  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    console.warn('[payment] webhook rejected — bad or missing secret')
    return res.status(401).json({ error: 'unauthorized' })
  }

  const body = req.body || {}
  const txRef = body.tx_ref || body.txRef
  const status = body.status || body.event

  console.log(`[payment] webhook received: txRef=${txRef} status=${status}`)

  if (txRef) {
    const verify = await verifyPayment(txRef)
    if (verify.paid) {
      console.log(`[payment] webhook: payment CONFIRMED for ${txRef}`)
      await updatePaymentStatus(txRef, 'paid')
    } else {
      console.log(`[payment] webhook: payment NOT confirmed for ${txRef}`)
    }
  }

  return res.status(200).json({ received: true })
})

export default router
