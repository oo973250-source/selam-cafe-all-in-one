# Medi Cafe — Admin Telegram Mini App (AI Handoff)

This package contains EVERYTHING needed to integrate the finished admin Mini App
frontend with the real backend — and to connect it to the Telegram bot and the
customer miniapp.

## Package contents

| Path | What it is |
|------|------------|
| `selam-admin-miniapp/` | The complete, production-ready Vite + React SPA (the deliverable frontend). |
| `SPEC.md` | The living UI spec: every screen, every decision, and every ⚠️ INTEGRATION POINT. **Read this first, top to bottom.** |
| `INTEGRATION-README.md` | This file — quick orientation for the integrating AI. |
| `sandbox-harness/` | REFERENCE ONLY: the sandbox backend stubs (Next.js route handlers + demo data) that implement the exact contract shapes. Use them as a working reference when building the real endpoints — do NOT deploy them. |

## What the app is

A dark, touch-first admin panel for a Telegram cafe-ordering bot, running as a
Telegram Mini App (`window.Telegram.WebApp`). It manages the live order queue
(start / finished→done / cancel, staff attribution), menu + categories, staff
admins, revenue analytics, cafe profile (the cafe-identity CONTROLLER), emergency
pause / store closure, announcements, reports, and order history. Currency is
INTEGER Ethiopian Birr (ETB). UI language is English only.

## Frontend facts

- Stack: Vite + React 18, plain CSS (`src/styles.css`), no router library —
  a small internal nav stack synced with `window.history` and Telegram's
  `BackButton` API (pushState/popstate, root page hides BackButton).
- Build: `cd selam-admin-miniapp && npm install && npm run build` → static `dist/`.
  Deploy the `dist/` folder at a subpath of the existing Railway service
  (it was developed to mount at `/admin-miniapp/`; the Vite build uses relative base `./`).
- Auth: `POST /api/admin-miniapp/auth` with raw `initData` → `{ token, user }`;
  every request sends `Authorization: Bearer <token>`; 401 → one silent re-auth,
  403 → access-denied screen, 503 → toast (never crash).
- Realtime: socket.io-client, same origin, default path — see the event catalog below.
- All API paths are RELATIVE (e.g. `/api/orders`) — keep serving the SPA from the same origin as the API.

## ⚠️ Backend integration points (what to build)

The frontend is complete but was built UI-first: several endpoints are not in the
original contract and are currently served by sandbox stubs. Each one is marked
with a `⚠️ INTEGRATION POINT` comment in `src/api.js` and detailed in `SPEC.md`:

1. **Store settings** — `GET|PATCH /api/admin-miniapp/settings`
   `{ order_limit, pickup_throttle_min, delivery_available, paused, pause_until, close_until, closure_reason }`.
   Server must own: intake blocking, closure-reason broadcast to customers, authoritative auto-resume.
   ORDER LIMIT: enforce only non-negative integers — NO business cap (the admin decides the
   maximum; 0 = unlimited; 9999 sanity bound at most). The cafe's real name is "Medi Cafe";
   the bot must read it at runtime from the profile row (see the identity-controller section).
2. **Staff admins** — `GET|POST /api/admin-miniapp/admins`, `GET /admins/verify?id=`,
   `PATCH|DELETE /admins/:tgUserId`. Per-admin stats `{ day, week, month }` server-computed.
3. **Revenue** — `GET /api/admin-miniapp/revenue?period=day|week|month` → `{ orders, revenue (int ETB), delivered }`.
4. **Cafe profile** — `GET|PATCH /api/admin-miniapp/profile`
   `{ cafe_name, phone, location, logo_url, hours_open, hours_close, description }`.
   `cafe_name` drives the header brand. Logo: interim = client-downscaled data URL;
   real upload endpoint (`POST /api/admin-miniapp/profile/logo → { url }`) pending.
5. **Order history attribution** — `PATCH /api/orders/:id` also receives `started_by`
   (staff display name). Persist it on the order row + add `started_at`; STAMP THE
   IDENTITY SERVER-SIDE from the Bearer token (client value is advisory) and return
   both fields in `GET /api/orders` so every admin device sees who is cooking.
6. **Pause history** — `GET /api/admin-miniapp/pause-history`
   → `{ history: [{ id, kind: 'emergency'|'countdown'|'closed', reason, started_at, ended_at|null }] }` newest first.
   Append an entry whenever intake is paused/closed; stamp `ended_at` on resume/reopen.
7. **Announcements** — `GET /api/admin-miniapp/announcements` → `{ announcements: [...] }`;
   `POST { message ≤300 }` → `{ announcement }`. Server must fan each announcement out
   to the customer app / bot channel.
8. **Category "no-delivery" flag** — the Categorize screen keeps the flag client-side
   (`noDelivery` on categories); add a real field + include it in the categories payload.
9. **Map picker** — Profile location pin currently opens a Google Maps search;
   consider `WebApp.requestLocation` for a real picker.
10. **Reports / kitchen throughput** — the Reports screen shows sales metrics + pause
    history. Kitchen throughput statistics have no data source yet (optional: derive
    from order status timestamps).
11. **Two-step order completion** — `PATCH /api/orders/:id` also accepts
    `{ dismissed: true }` → stamp `dismissed_at` on the order (also stamp
    `served_at` when status flips to `served`). `GET /api/orders` must
    KEEP returning served-but-not-dismissed orders (the queue shows them in a green
    done state until an admin taps "Done"; done cards only stay in the queue for
    the current day); dismissed orders must still reach the order-history screen.
12. **Amharic translations (name_am)** — menu items AND categories carry an
    optional `name_am` (Amharic name, e.g. Doro Wat → ዶሮ ወጥ). `POST /api/menu`,
    `PATCH /api/menu/:id`, `POST /api/menu/categories` and
    `PATCH /api/menu/categories/:id` all accept it; add the column to both tables
    and include it in every read payload. The admin UI edits it ("Name (Amharic)"
    field) and renders it as a second line; the customer app / bot should show
    the right name per the user's language.
13. **Cache headers on the SPA** — serve the mini app's `index.html` with
    `Cache-Control: no-store, must-revalidate` (hashed `/assets/*` may stay
    `immutable`). Telegram webviews cache aggressively: without this, devices
    keep running an OLD bundle after every redeploy ("the fix isn't there").
14. **Cafe identity (`GET /api/brand`, public)** — `{ name, logo_url, updated_at }`,
    backed by the SAME row as the profile endpoint. Every surface (customer miniapp,
    bot templates, receipts) reads the cafe name from here — see the controller section below.

## Cafe identity — the Profile page CONTROLS EVERYTHING (user directive)

The profile record is the SINGLE SOURCE OF TRUTH for the cafe identity across the
whole project. When an admin changes the cafe name (or any profile field) in the
Profile page, the backend must propagate it EVERYWHERE the name is mentioned:

1. **Admin devices**: broadcast `profile:update` (full profile) over socket.io —
   every admin's header brand refreshes instantly (the client already handles this).
2. **Customer miniapp**: broadcast `brand:update` + serve `GET /api/brand`
   `{ name, logo_url, updated_at }` (public, no auth) — customers see the new
   name/logo on their next app open or immediately via the push.
3. **The bot**: message templates must READ the cafe name at runtime from the
   profile row (cache it, invalidate on profile change) — greeting messages,
   order confirmations, "order ready" notifications, receipts, broadcast texts.
   NEVER hardcode the name in bot code. Result: one name change in
   Profile → the entire bot project reflects it with zero redeploy.

The PATCH response carries `updated_at` — consumers use it as the identity version.

## Realtime event catalog (socket.io, same origin, default path)

Server → **admin miniapp** (the client listens to all of these; polling is only
the fallback):

| Event | Payload | Effect |
|---|---|---|
| `order:new` | full order object | prepended to the live queue (+ haptic) |
| `order:update` | `{ id, ...patch }` | order patched in place (status / started_by / dismissed_at changed on another device) |
| `settings:update` | full settings object | pause / closure / delivery availability syncs instantly |
| `profile:update` | full profile object | cafe name & profile refresh everywhere |
| `announcement:new` | announcement object | announcements list + toast |

Server → **customer miniapp / bot** (recommended):
`brand:update` (identity), `menu:update` (items/categories changed),
`settings:update` (closed / paused banner + hard intake blocking),
`announcement:new` (broadcast), plus bot DMs for order status changes
(`order:status` → customer chat: preparing / ready / delivered / cancelled).

## Connecting the admin miniapp to the Telegram bot (architecture)

1. **Serve everything from one origin** (the existing Railway service):
   `/admin-miniapp/` → built SPA; `/api/*` → Express handlers; `/socket.io/*` → socket.io.
2. **Auth**: the miniapp sends raw `initData` to `POST /api/admin-miniapp/auth`.
   Validate it server-side with the bot token (HMAC-SHA256 `data-check-string`),
   check the admin allowlist (or the staff-admins table), return a short-lived
   `{ token, user }`. Every subsequent call carries `Authorization: Bearer <token>`.
3. **Socket rooms**: put every authenticated admin socket in an `admins` room;
   customers in a `customers` room. Emit:
   - bot webhook receives a new order → `order:new` → `admins` room (queue updates in <100 ms)
   - any admin PATCH (start / finished / done / cancel) → `order:update` → `admins` room
   - settings PATCH → `settings:update` → `admins` + `customers` rooms
   - profile PATCH → `profile:update` → `admins`, `brand:update` → `customers`
   - announcement POST → `announcement:new` → `admins` + `customers` (+ bot broadcast)
4. **Customer-app control from the admin panel** (already wired client-side):
   - `paused` / `pause_until` / `close_until` → customer app shows the closed banner,
     server REFUSES new orders while active; auto-resume is server-owned.
   - `delivery_available` → hides/disables the delivery option for customers.
   - category `hidden` / item `available` → items disappear from the customer menu.
   - `closure_reason` → the reason text shown to customers during closure.
   - announcements → broadcast message to all customers (bot channel + app).
5. **Speed checklist**: emit socket events on every state change (no polling loops),
   keep the queue payload small (only active + served-until-dismissed orders),
   add DB indexes on `orders.status` / `orders.created_at`, and keep the admin SPA
   served with immutable caching (Vite hashes assets).

## Behavior notes

- Orders flow: `new → preparing → ready → served`; `cancelled` terminal.
  Queue shows active + finished (served) orders. "Finished ✅" marks served and
  NOTIFIES the customer — the card STAYS in a green done state until an admin
  taps "Done" (`dismissed: true`), which removes it from the queue (history keeps it).
- Money is always integer Birr — no decimals anywhere.
- Every list has loading, empty, and error states; no double-submit guards are skipped.
- Hardware back / swipe: sub-pages pop in-app; on the root page the Telegram default
  (close the Mini App) applies.
- Order history (Orders header top-right list icon): today + yesterday, read-only,
  includes served and cancelled orders.
