// SANDBOX PREVIEW HARNESS — GET /api/admin-miniapp/pause-history
// Reports page data: pause/closure log, newest first. The real server should
// append an entry whenever intake is paused/closed (emergency kill-switch,
// duration pause, days closure) and stamp ended_at on resume/reopen.
import { demo, json } from '@/lib/demo/data'

export async function GET() {
  if (!Array.isArray(demo.pauseHistory)) demo.pauseHistory = []
  const history = [...demo.pauseHistory].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  )
  return json({ history })
}
