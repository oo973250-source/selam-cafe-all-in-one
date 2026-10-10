Sandbox harness — REFERENCE IMPLEMENTATION ONLY (do NOT deploy).

These are the Next.js route handlers + in-memory demo data that power the
sandbox preview (preview -> / redirects to the staged built miniapp). They
implement the EXACT contract shapes the admin miniapp expects, so use them
as a working reference when building the real Express/Postgres backend:

  api/orders/...             order queue GET + PATCH (status, started_by,
                             served_at, dismissed - two-step completion)
  api/menu/...               menu items + categories (CRUD, reorder, 409/force)
  api/blocked-users/...      blocked users + customer directory
  api/admin-miniapp/auth     initData -> { token, user }
  api/admin-miniapp/settings store settings (intake pause/close, delivery)
  api/admin-miniapp/admins   staff admins CRUD + Bot-API-style verify
  api/admin-miniapp/revenue  revenue metrics per period
  api/admin-miniapp/profile  CAFE-IDENTITY CONTROLLER (single source of truth)
  api/admin-miniapp/pause-history  reports: pause/closure log
  api/admin-miniapp/announcements  broadcast messages
  api/brand                  PUBLIC cafe identity for customer app + bot
  data.ts                    demo data + types = the payload shapes

Every real endpoint is also documented in SPEC.md (integration points 1-12)
and INTEGRATION-README.md (architecture, realtime event catalog, bot wiring).
