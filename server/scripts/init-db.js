/**
 * server/scripts/init-db.js
 * -------------------------
 * Run with: npm run db:init
 */

import 'dotenv/config'
import { pool, ensureSchema } from '../db.js'

async function main() {
  console.log('[init-db] applying schema…')
  await ensureSchema()
  console.log('[init-db] done ✓')
  await pool.end()
}

main().catch((e) => {
  console.error('[init-db] failed:', e)
  process.exit(1)
})
