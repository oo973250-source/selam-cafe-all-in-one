// SANDBOX PREVIEW HARNESS — stub of POST /api/admin-miniapp/auth (accepts any initData)
import { json, readBody } from '@/lib/demo/data'

export async function POST(req: Request) {
  await readBody(req)
  return json({
    token: 'preview-demo-jwt',
    user: { id: 1, tgUserId: 999_999, firstName: 'Owner', role: 'owner' },
  })
}
