SANDBOX PREVIEW HARNESS (reference implementation, not production code)

This folder is the in-memory Next.js API stub used to preview and QA every
admin screen before real-backend integration. It is CONTRACT-SHAPED: your real
backend should implement the same routes/payloads and honor every
"⚠️ INTEGRATION POINT" documented in INTEGRATION-README.md and SPEC.md.

Layout:
  data.ts    -> in-memory demo DB (orders incl. yesterday seeds, categories,
                menu, staff, settings, cafe profile "Medi Cafe", pause history,
                announcements) + helpers.
  api/       -> route handlers (mirror the URL paths under src/app/api/):
                orders, menu, blocked-users, brand (public),
                admin-miniapp/{auth,settings,profile,revenue,admins,
                pause-history,announcements}.

Key behaviors already implemented here (copy them into the real backend):
- orders/[id] PATCH: status transitions, started_by stamp (who cooked it),
  served_at (Finished -> done state), dismissed_at (explicit "Done" removal),
  cancelled.
- settings PATCH: order_limit has NO business cap (admin decides the maximum;
  0 = unlimited, sanity bound 9999), pause/close actions append pause-history
  events and stamp ended_at on resume.
- profile PATCH: stamps updated_at (identity version). The cafe name is
  "Medi Cafe" and must be read at RUNTIME by the bot — never hardcode it.
- /api/brand: public identity endpoint for the customer miniapp + bot.
