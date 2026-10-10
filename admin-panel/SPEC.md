# Selam Cafe — Admin Mini App SPEC (living doc, built from main-AI rules + page drops)

## Global contract (from RULES — authoritative)
- Vite + React SPA, `vite.config base: './'`, hash routing or no router, static `dist/`
- Dark, clean, touch-first admin UI. English only. Runs inside Telegram.
- Auth: raw `Telegram.WebApp.initData` → POST /api/admin-miniapp/auth → { token, user{id,tgUserId,firstName,role} }
  - Token in memory (+ CloudStorage or sessionStorage). `Authorization: Bearer <token>` on every call.
  - 401 → re-auth once, retry, else "session expired". 403 → "access denied", stop.
- API (relative paths only): orders (GET list ?status=&limit=50, GET stats/today, GET :id, PATCH :id {status}/{payment_status}), menu CRUD (POST requires client slug id), categories CRUD (sections food|drink, hidden, reorder = full id list per section, DELETE 409 → ?force=true), blocked-users CRUD (+ directory search ?q=, max 50)
- Money = INTEGER Birr. 503 → toast, never crash. Loading states, no double-submit.
- socket.io-client same origin default path, event `order:new` → prepend. Refetch after PATCH.
- SDK: telegram-web-app.js; ready()+expand() on mount; showAlert/showConfirm; haptics; themeParams-aware.
- NO backend, no env vars, no deploy files, no hardcoded menu, frontend folder ONLY.

## Page 1 — "orders" view (admin home) — source: Screenshot_20260924_215153_Miro.jpg + text spec

### Shell
- Dark bg, rounded container cards, pill controls.
- Top bar: circular back button (top-left, ↩ icon) · centered header text "admin"
- Brand block: large "Name" + small subtitle "admin panel"
- View switcher (segmented pill, top-right): `orders` | `manager` — active = gray highlighted pill

### Filter bar (pill container, full width)
- All (active = white pill, dark text) · Dain in · Takeaway · Delivery
- Filters by service_type ('dine_in'|'takeaway'|'delivery') — client-side (API has no service_type param)

### Order cards (list)
- Data: GET /api/orders?limit=50 → show ACTIVE only (new, preparing; ready treated as started). served/cancelled hidden.
- Badge (top-right, small gray pill): Delivery / Dain in / Takeaway
- Title: item lines formatted "qty, name of the food" (from items jsonb)
- 📝 Note : - → customer note; "-" when empty
- 📍 Location : --- → ONLY on Delivery cards:
  - GPS shared (customer_loc has lat/lng) → white pill button "Location 📍" (right side) opens map (Google Maps link)
  - Address sent as TEXT → show the text, NO button
  - Dine-in / Takeaway cards: no location row at all
- Action bar (inset rounded sub-container, 4 pills):
  - `start` (gold/brown) → PATCH {status:'preparing'} → button becomes `started` (golden-green). Server notifies customer via bot.
  - `Finished ✅` (gray pill) → PATCH {status:'served'} → button becomes `Done` → order disappears from list
  - `Cancel ❌` (dark pill, red X) → confirm (showConfirm) → PATCH {status:'cancelled'} → order disappears
  - `Details` (SMALL pill, muted slate-blue — my pick, distinct from gold/green/red) → shows customer details: name, phone number, ticket # (via showAlert, Telegram-native). Phone read defensively (not in documented order schema — show "-" if absent). Ticket = order id ("Ticket #N" matches bot receipt format).
- Live: socket.io `order:new` → prepend card (respect active filter). After any PATCH → refetch list.

### DECIDED (user confirmed 2026-10)
1. Card title = qty-first ("2, shiro" for qty 2). ✅
2. Brand "Name" is DYNAMIC — editable via admin profile page (Page 9 or 10, spec coming). Until then placeholder; wire later. ⚠️ REMEMBER
3. Note source = order.note fallback "-" — user may revise later. ⚠️ REMEMBER (flexible)
4. Card itself shows no total/ticket/customer name — BUT new small `Details` button (see action bar) reveals customer name + phone + ticket #. ✅
5. Spelling CORRECTED to "Dine in" (filter pill + badge). ✅
6. Cancel = showConfirm first. ✅
7. Back button: root/first page → WebApp.close() (closes Mini App); deeper pages → navigate back (nav stack). ✅

## Page 2 — "manager" view (manager hub) — source: Screenshot_20260925_235203_Miro.jpg + text spec

### Shell (same as Page 1, but Manager tab active)
- Active tab "Manager" = white pill (dark text, border ring); "Orders" inactive plain text. Mocks differ slightly on active-tab tint (P1 gray vs P2 white) → standardize ONE active style: white pill.
- Full-width horizontal separator line between header block and content area.

### Manager control menu — vertical stack of 6 large full-width pills (centered text, dark pill, subtle lighter border — all identical per mock)
1. `menu` → menu management panel: add/edit/remove items, prices, availability (API: GET/POST/PATCH/DELETE /api/menu)
2. `Categorize` → category management: create/organize/delete categories (API: /api/menu/categories CRUD + reorder) — spelling CORRECTED from mock's "Catagorize"
3. `Admins` → staff roles, add/remove admin Telegram IDs — ⚠️ API GAP: no endpoint in contract (ADMIN_TELEGRAM_IDS is a server env var). Plan: page shows current admin from auth payload; add/remove UI marked INTEGRATION POINT pending main-AI endpoint
4. `Revenue` → financial analytics: total sales, daily/weekly earnings, transaction history — ⚠️ API GAP: only GET /api/orders/stats/today exists. Plan: today's stats + transaction history derived from GET /api/orders (50-row window); weekly/monthly trends INTEGRATION POINT pending endpoint
5. `Profile` → business account details, venue info, contact info, operating hours + brand "Name" editing (Page 1 remember-list wires HERE) — ⚠️ API GAP: no endpoint. Plan: Telegram CloudStorage persistence (device-local) by default; needs endpoint for cross-device/global truth
6. `Emergency pause` → kill switch halting incoming customer orders — ⚠️ API GAP: no endpoint; a frontend-only toggle would be an ILLUSION (orders keep flowing server-side). Plan: UI built (toggle state + confirm + paused banner on orders view), actual intake blocking = INTEGRATION POINT pending main-AI endpoint. STYLE (user confirmed): RED signal styling.
- Paused banner on Orders view CONFIRMED: "⏸ Paused — not accepting orders" strip above the list.

### Navigation
- Each button pushes its page onto the nav stack; back button (↩) returns to manager hub (per Page 1 decision #7).

## BUILD MODE (user directive)
- UI-FIRST: build all pages per mocks now; backend wiring later when full picture exists.
- Deliverable contains the complete api.js written against the documented contract (token/401-retry/503-toast included) — switch from preview stubs to live server = data layer only.
- Preview harness (sandbox-only, NOT in deliverable): Next.js route stubs + injected Telegram shim + demo data so every screen is clickable before integration.

## Page 3 — "menu" → category list w/ availability toggles — source: Screenshot_20260925_235219_Miro.jpg + text spec

### Shell variant (deeper page)
- Same back ↩ / "admin" / Name + "admin panel".
- Top-right: LARGE "menu" badge pill (section indicator — replaces the orders|manager switcher on deeper pages; pattern for all sub-pages).
- Below badge: Foods | Drinks segmented toggle (Foods active = white pill; Drinks plain). Maps to API `section` ('food'|'drink'); client-side filter of GET /api/menu/categories.
- Separator line under header.

### Category cards (numbered: "1,Category name" per mock — index = position/sort_order in section)
- Data: GET /api/menu/categories → filter by section. Spelling corrected "Catagory"→"Category".
- Inner pill panel inside each card with TWO small toggle pills:
  - `unavailable` — toggles whole category off for customers. MAPPING (proposed): PATCH /api/menu/categories/:id { hidden } — server-supported "hide from customer view"; user's own wording allows "hidden from customer view". Toggle color: muted dark-red when ACTIVE (category unavailable), neutral when available.
  - `No delivery` — disables delivery for all items in category. ⚠️ API GAP: NO field anywhere in contract (items/categories have no delivery flag). UI toggle built; persistence = INTEGRATION POINT pending main-AI field (e.g. category.no_delivery). Toggle color: bright red when active.
- Toggle UX: constant label, COLOR = state (neutral = normal, red = restriction active) — mock shows both reddish; per-card state colors inferred.

### Open questions (defaults if unanswered)
1. Nav: this opens from Manager → `menu` button. Then `Categorize` button = deeper category CRUD (add/rename/reorder/hide/delete)? And tapping a category card → items-in-category page (future page)? DEFAULT: yes to both
2. Confirm `unavailable` → category `hidden` mapping. DEFAULT: yes (only server-supported option)
3. `No delivery` = integration point (needs field from main AI). DEFAULT: build UI, mark pending
4. Tapping card title opens items; tapping toggles only toggles. DEFAULT: yes

## Page 4 — "menu" → items inside a selected category — source: Screenshot_20260925_235249_Miro.jpg + text spec

### Shell variant (deeper page, badge = selected category)
- Same back ↩ / "admin" / Name + "admin panel". Back returns to the category list (Page 3) via nav stack; root close-app rule unchanged.
- Top-right: large badge pill showing the SELECTED CATEGORY NAME (mock text "Selected catagory name", spelling corrected). Long names shrink via `.badge-menu-sm`.
- Separator line under header. No Foods|Drinks toggle on this page (it belongs to Page 3).

### Item list with custom scrollbar (per mock)
- Layout: capsule track FAR LEFT (full list height, outlined) + white pill thumb indicating scroll position (hidden when content fits, height = visible/total ratio, position tracks scrollTop; ResizeObserver keeps it correct after refetch).
- List scrolls INTERNALLY (page itself stays put); native scrollbars hidden.

### Item cards (numbered "1,Item name" per mock)
- Data: GET /api/menu?category=<id> → items sorted by sort_order; display index = position.
- Title: "1,Doro Wat" (qty-free, index-first). Price row: "Price : x" (x = INTEGER Birr).
- Top-right of each card, two circular outline icon buttons:
  - 🗑️ waste-basket = DELETE (user asked for "basket icon to delete"; using 🗑️ for delete semantics — swap to 🧺 on request). showConfirm first → DELETE /api/menu/:id → toast "Item deleted" → refetch list. Disabled while a delete/save is in flight (no double submit).
  - ✏️ pencil = EDIT → opens the edit modal below.
- Items with available=false render dimmed + small red "unavailable" flag.

### Edit modal (bottom sheet)
- Fields: Name (required), Price (Birr INTEGER — non-digits stripped, validated whole ≥ 0), Description (optional), Photo URL (+ 56px preview thumb), Availability toggle pill (`available` white active ↔ `unavailable` dark-red active).
- Save → PATCH /api/menu/:id { name_en, price, description, image_url, available } → toast → refetch list (RULES: refetch after PATCH). Cancel / tap-outside closes. Saving state disables both buttons.

### FIELD MAPPING (assumption — confirm at integration)
- Item fields used: `name_en`, `price`, `description`, `image_url`, `available` — matches the contract-shaped preview harness; the RULES doc doesn't enumerate item columns. If the real backend differs (e.g. `name`, `photo_url`, `hidden`), it's a data-layer-only touch-up in api.js/mapping.

### DECIDED (user confirmed 2026-10)
1. Basket icon added next to pencil for delete, with confirm dialog. ✅
2. Edit modal updates name, price, description, photo, availability state. ✅
3. Card tap from Page 3 carries the category object on the nav stack (push payload). ✅

### ADDENDUM (user, with Page 5 drop): "also add the scroll controls in the menu section"
- Page 3's category list now uses the SAME custom capsule scroll controls as Page 4 (far-left outlined rail + white pill thumb; thumb hidden when content fits). The list scrolls internally, the shell stays put. ✅

## Page 5 — "Categorize" → category management — source: Screenshot_20260925_235238_Miro.jpg + text spec

### Shell (deep page, opened from Manager hub → Categorize button)
- Same back ↩ / "admin" / Name + "admin panel". Back returns to the Manager hub (Page 2) via nav stack.
- Top-right: LARGE badge pill "Category" — mode indicator for Category Management (mock text "Catagory", spelling corrected).
- Foods | Drinks segmented toggle below the badge — same pattern/state source as Page 3 (shares the global section state).
- Separator line under header.

### Controls bar (directly under separator)
- 🔍 `search..` pill bar (magnifier icon + input): dynamic client-side filter of the active section's categories by name.
- Circular "+" button far right (light disc, dark plus per mock): opens "New category" modal → name (required) + section = active Foods/Drinks toggle → POST /api/menu/categories { name_en, section } → toast → refetch.

### Category pills list
- Vertical stack of full-width pill buttons, centered category name, NO numbering (unlike Page 3's "1,Name" cards).
- Scroll indicator: slim/thin far-left rail with a small subtle thumb (mock text: "standard thin scrollbar, formatted like a standard system browser scrollbar") — THIN variant of the shared VScroll component. Hidden when content fits.
- Tap a pill → "Edit category" overlay (bottom sheet):
  - Rename: name input + Save → PATCH /api/menu/categories/:id { name_en } → toast → refetch.
  - Reorder: Position stepper (▲ n/total ▼) → optimistic local move → POST /api/menu/categories/reorder with the FULL ordered id list for that section → revert via refetch on failure.
  - Delete: showConfirm → DELETE /api/menu/categories/:id → 409 { error, itemCount } → second confirm "delete the category AND its N items?" → DELETE ?force=true → toast + refetch. (First DELETE call is toast-quiet so the 409 flow can speak for itself.)

### DECIDED (2026-10)
1. Badge text = "Category" (corrected spelling). ✅
2. This page uses the THIN scrollbar variant; Page 3 keeps the CAPSULE variant (user addendum). ✅
3. Category pills are NOT numbered here (mock shows plain names). ✅
4. Search filters the active section only, client-side. ✅
5. Add-category modal: section follows the active toggle, shown as a static pill. ✅

### NOTES
- All Page 5 endpoints ARE in the documented contract (categories CRUD + reorder + 409/force) — no new integration gap.
- Assumption: POST /api/menu/categories accepts { name_en, section } (harness-verified). If the real backend also requires a client-generated id, it's a one-line addition in the add flow.

## Page 6 — "Admins" → staff admin management — source: Screenshot_20261003_172329_Miro.jpg + text spec

### Shell (deep page, opened from Manager hub → Admins button)
- Same back ↩ / "admin" / Name + "admin panel". Back returns to the Manager hub via nav stack.
- Top-right: LARGE badge pill "Admins".
- Separator line under header.

### Metrics toggle — Day | Week | Month (user: "Time-Based Scroll Metrics")
- Segmented pill under the header, centered (Day active = white pill). Mock's lowercase "week" normalized to "Week" (consistent with Day/Month + the Foods/Drinks pattern).
- Toggling instantly recalculates each admin card's order-count metric:
  - `Day` = orders completed today during their active shift
  - `Week` = current-week completed totals (weekly efficiency)
  - `Month` = monthly completed orders (performance reviews / bonus distribution)

### Add-admin flow (circular + button, user: "Adding Staff Admins")
- Light circular "+" button at the top of the list area (right-aligned, mock shows it inside the scroll region).
- Opens "Add admin" overlay/modal asking for:
  1. **Telegram User ID** (or @username) input
  2. **Role selection** chips: Cashier | Kitchen | Delivery (user's examples — "e.g." implies the set can grow)
  3. **Assigned Shift / Branch**: shift chips (Morning/Afternoon/Night) + branch text
- **Instant verification**: system checks the ID via Telegram Bot API → displays the user's Telegram profile photo + name (+ verified chip) before granting; "Grant access" activates their admin access.
  - ⚠️ INTEGRATION POINT: the frontend cannot call the Bot API directly — needs a server verify endpoint (or a server-side check inside the create call). Harness stub resolves a demo profile.

### Scroll list — CAPSULE scrollbar
- Mock shows the outlined far-left rail + white pill thumb = the Page 4 CAPSULE variant (NOT Page 5's thin variant). The + button row lives INSIDE the scroll container (rail extends up beside it, per mock).

### Admin cards (numbered "1,name" per mock)
- Left: square rounded Telegram avatar (initial-letter fallback when no photo).
- Title: "1,Name" (index = list position). Small muted line: ID + role (user text: card displays "Telegram avatar, display name, ID, and live order count").
- Metric block: label "#total order done" + value line "--- N" (mock literal format); N flips with Day/Week/Month.
- Right column (Page 4 circular icon-button pattern):
  - ✏️ pencil → Edit sheet
  - ❌ red X → revoke
- Suspended admin → dimmed card + red "suspended" flag (mirrors Page 4's unavailable pattern).

### Edit sheet (pencil — user: "Quick Action Controls")
- Role + RBAC permission chips (Orders, Menu, Revenue, Refunds, Pause)
- **Active status toggle — ON/OFF without deleting** (suspend → dimmed card)
- Shift assignment + **refund limit** (INTEGER Birr, digits-only)
- Save → PATCH → toast → refetch (RULES refetch-after-PATCH).

### Revoke (red X)
- User text: "Immediately revokes admin rights, detaches the Telegram User ID, and archives their shift history."
- RULES destructive-op policy keeps showConfirm FIRST ("Revoke admin access for X? Their shift history will be archived.") → DELETE → toast → card removed. ⚠️ flagged: if the user wants truly instant revoke with NO confirm, one line changes — asked at integration.

### ⚠️ WHOLE PAGE = INTEGRATION POINT
- The RULES contract has NO staff-admin endpoints (ADMIN_TELEGRAM_IDS is a server env var). Data-layer interface ships in api.js (list / verify / create / patch / delete); sandbox harness serves contract-shaped stubs so every control is clickable.
- Suggested endpoints (main AI to confirm): GET/POST /api/admin-miniapp/admins, GET /api/admin-miniapp/admins/verify?id=, PATCH/DELETE /api/admin-miniapp/admins/:id. Metrics delivered per-admin as `stats: { day, week, month }` computed server-side from completed orders.

### DECIDED (2026-10)
1. Badge text "Admins"; toggle normalized to "Day | Week | Month". ✅
2. Cards keep the mock numbering ("1,name") and the "--- N" value line format. ✅
3. This page uses the CAPSULE scrollbar (not thin). ✅
4. Role set = Cashier / Kitchen / Delivery. ✅
5. Card shows ID + role meta line per user text. ✅

## Page 7 — "Emergency pause" → Admin panel (store status & order controls) — source: upload/1791055752967.jpg + text spec

### Shell (deep page, opened from Manager hub → Emergency pause button)
- Same back ↩ / "admin" centered title / brand block ("Name" + "admin panel" — mock literally says "Admin / admin panel"; standardized to the DYNAMIC brand like every other page, per Page 1 decision #2).
- Top-right: the **EMERGENCY PAUSE button REPLACES the badge pill** in the brand row — white-outlined rounded pill, uppercase text (first deep page without a section badge).
- Separator under header (mock tints it greenish; standardized to the shared `.hr`).
- Back arrow → Manager hub (nav stack; root close-app rule unchanged).

### Emergency pause kill-switch (top-right)
- User text: "Instant kill-switch trigger. Tapping this immediately halts all incoming customer orders across all channels **without needing to fill out countdown timers**."
- RULES destructive-op policy → showConfirm FIRST ("EMERGENCY PAUSE — halt ALL incoming customer orders immediately?").
- Paused state: button flips to a filled-red "RESUME ORDERS" state (tap → confirm → resume). Orders view shows the paused banner (existing).
- ⚠️ INTEGRATION GAP (known since Page 2): real intake blocking needs the server; UI state persists via the settings endpoint below.

### ORDER MANAGEMENT section (bordered rounded panel)
1. `Limit incoming orders to:` — numeric stepper (value box flanked by − / +, direct typing allowed; INTEGER). Cap on active orders; at the cap the customer app disables ordering until orders clear. 0 = no limit (assumption — confirm at integration).
2. `Throttle pickup times to (+min):` — numeric stepper, INTEGER minutes. Adds extra prep time to customer-facing pickup/prep countdowns. 0 = none (assumption).
3. Thin divider, then `Delivery Service:` row — iOS-style toggle + dynamic text:
   - ON → green switch + green `AVAILABLE` (delivery enabled on customer apps)
   - OFF → gray switch + red `UNAVAILABLE` (pickup/dine-in only)

### TEMPORARY STORE STATUS section (bordered rounded panel)
1. `Pause for [HH:MM] Hours` — duration stepper (− / + step 30 min, typeable). Pauses incoming orders for that duration; **auto-resumes when the timer expires**. Applied via a small ✓ apply button at the row end (mock shows no submit affordance; "activates when the pause duration is submitted" requires one) → showConfirm → starts the countdown.
2. `Close for [N] Days` — numeric day stepper for multi-day closures (maintenance/holidays). Same ✓ apply + showConfirm ("Close the store for N days?").
3. Closure reason textarea, placeholder `Type closure reason for all users...` — broadcast text pushed to the customer app when users try to order during pause/closure. Autosaves on blur (toast "Closure note saved"); also sent along with pause/close applies.
- Caption below panel (mock literal): "This reason will be visible to all users attempting to order during closure."

### Active countdown status box (bottom of page)
- Mock literal active state: `!! Count down started [Time]` + boxed `00:00`.
- Inactive: muted "No countdown running" + boxed 00:00 (dim).
- Active: `!! Count down started` + started-at time, ticking HH:MM:SS once per second, + a small `Stop` chip (confirm → resume immediately).
- Countdown expiry → auto-resume: UI reloads settings + toast "Pause ended — orders resumed"; the SERVER must own the authoritative auto-resume at integration (frontend timer is informational).
- When the store is CLOSED (days closure) the same box shows "Closed until {date}" + a `Reopen` chip.

### Bottom quick-nav bar — REVISED (user drop 2026-10-04, screenshot Screenshot_20261004_153358_Chrome.jpg)
- **Menu-only**: the single remaining ☰ circular button → resets to the Orders root view (`switchTab('orders')`), centered in the bar.
- REMOVED per user decision ("no need for the favorite button… report and announcement button opens nothing"): ⭐ Star (favorites), ＋ Add/Announcements, `REPORTS` pill — all three were ComingSoon placeholders that opened nothing. ComingSoon page + 'soon' route stay in the codebase for future page drops.

### ⚠️ NEW INTEGRATION GAPS (all UI-first per user directive)
- RULES contract has NO store-settings endpoints. Suggested shape (main AI to confirm):
  - `GET /api/admin-miniapp/settings` → `{ settings: { order_limit, pickup_throttle_min, delivery_available, paused, pause_until, close_until, closure_reason } }`
  - `PATCH /api/admin-miniapp/settings` (partial body, same fields) — server validates ints ≥ 0, ISO timestamps, string ≤ 500 chars.
- Server-side responsibilities at integration: actually BLOCK intake when `paused || pause_until > now || close_until > now`, broadcast `closure_reason` to the customer bot/app, auto-resume on timer expiry, expose a live countdown source (settings GET or socket event).

### DECIDED (2026-10)
1. Hub "Emergency pause" button now NAVIGATES to this page (kill-switch lives here); hub keeps its red styling + active tint while paused. ✅
2. Emergency = indefinite pause (no countdown); Pause-for = countdown with auto-resume; Close-for = multi-day closure. All three surface on the Orders banner (with the closure reason when set). ✅
3. Brand block stays dynamic ("Selam Cafe"), not the mock's literal "Admin". ✅
4. Steppers: − / + flanking the value box, direct typing on blur; pause duration steps 30 min (cap 23:59), days step 1 (cap 30), limit/throttle step 1 (limit cap 99, throttle cap 120). ✅
5. ✓ apply buttons on Pause/Close rows + Stop/Reopen chips in the countdown box = proposed affordances (mock has no submit; flagged). ✅

## Page 8 — "Revenue" → Revenue & financial analytics — source: Screenshot_20260925_235311_Miro.jpg + text spec

### Shell (deep page, opened from Manager hub → Revenue button)
- Same back ↩ / "admin" centered title / brand block ("Name" + "admin panel"). Back returns to the Manager hub via nav stack.
- Top-right: LARGE badge pill "Revenue" (the spec's "Revenue Header Badge" — indicates the analytics view; standard deep-page badge pattern).
- Separator line under header.

### Time Range Toggle (segmented pill below the header, per mock)
- `Day` (active = white pill, dark text) | `week` | `Month` — mock's lowercase "week" normalized to "Week" (same normalization as Page 6).
- Filters all three metric cards instantly (toggle is client-side; numbers come from the server per period).

### Metric cards (vertical stack of centered rounded rectangles)
- STYLING (user directive, this view): every card/container carries a clean thin WHITE outline — `border: 1px solid rgba(255,255,255,0.8)` — so it distinctively pops against the dark background.
- Card 1: big value `x` + label "Total orders" — order count in the period.
- Card 2: big value `Y` + label "Revenue ETB" — total earnings in Ethiopian Birr; INTEGER Birr per contract (thousands separators, no decimals).
- Card 3: big value `Xy` + label "Delivery done" — completed DELIVERY orders in the period.
- The stack lives inside the app-wide THIN scrollbar container (see global directive below).

### ⚠️ INTEGRATION POINT (revenue endpoints — 8th)
- Contract only documents GET /api/orders/stats/today (no week/month, no revenue total, no completed-delivery count).
- Suggested endpoint (main AI to confirm): `GET /api/admin-miniapp/revenue?period=day|week|month` → `{ orders: int, revenue: int, delivered: int }` — server-computed from orders (count; SUM(total) over completed/paid orders, integer Birr; completed delivery count).
- api.js ships `getRevenueStats(period)`; harness stub serves plausible per-period demo numbers. Day values may later remap to stats/today if it grows these fields — data-layer only.

## Global directives from the Page 8 drop

### 1. Standard thin scrollbar — APP-WIDE (user: "across this view (and throughout the application)")
- ALL vertical scroll containers use the ultra-thin native-overlay-style rail (2–4px wide, subtle white thumb) — NOT the wide capsule track.
- VScroll capsule variant RETIRED: Pages 3, 4, 6 switched capsule → thin (Page 5 was already thin). Capsule CSS kept in styles.css temporarily for rollback.
- Native scrollbars stay hidden; the custom thin rail is the only scrollbar.

### 2. Telegram BackButton + browser-history integration (user directive, delivered with Page 8)
- `tg.BackButton.onClick(handler)` bound ONCE at boot. Handler: if a modal overlay (`.modal-overlay`) is open → close it (synthetic click = same as outside tap); else `history.back()` → popstate pops the nav stack. No double-handling: Telegram fires onClick INSTEAD of navigating webview history, so the handler owns the pop.
- Browser history in lockstep with the nav stack: baseline `replaceState({ selam: 0 })` at boot; every `push` → `history.pushState({ selam: depth })`; `popstate` truncates the React stack to the entry's stored depth (history state = single source of truth). Hardware back and swipe gestures therefore step through the Mini App's pages instead of exiting Telegram.
- In-app ↩ button on sub-pages calls `history.back()` (NOT a direct stack pop) so app state and browser history never diverge.
- `switchTab` (root resets: orders↔manager switcher, Page 7 bottom-nav → Menu) unwinds ALL pushed entries via `history.go(-n)`.
- Visibility (user spec): `tg.BackButton.hide()` on the main/root Orders screen; `tg.BackButton.show()` on every sub-page/modal view (NavDepthTracker syncs on stack depth; modals only open on sub-pages where the button is already visible).
- ROOT behavior (user spec): BackButton hidden on the Orders root → Android/iOS hardware back & swipe close the Mini App (Telegram default) instead of navigating in-app; in-app ↩ at root still calls `WebApp.close()` (Page 1 decision #7).
- Sandbox shim upgraded: BackButton stub keeps a handler registry + show/hide console logs + `window.__tgBackFire()` so preview QA can simulate a hardware-back press.

## Page 9 — "Profile" → Cafe Profile & Business Settings — source: upload/1791095785041.jpg + text spec

### Shell (deep page, opened from Manager hub → Profile button)
- Same back ↩ / "admin" centered title / brand block. Back returns to the Manager hub via the history-synced nav stack.
- Top-right: badge pill with a person icon + "Profile" text (first badge carrying an icon).
- Separator under the header. App-wide global directives apply: every container/input carries the thin WHITE outline — `border: 1px solid #FFFFFF / rgba(255,255,255,0.8)` — and any vertical overflow uses the ultra-thin (2–4px) native-overlay scrollbar.

### Profile form panel (single rounded container, legend pill on its top edge)
- Legend: "🏪 Cafe Profile Settings" — dark pill with white border, centered, overlapping the panel's top border (fieldset-legend look).
- Field rows (colorful rounded-square icon left + label + control right):
  1. **Cafe Name** — red storefront icon 🏪; text input, value "UniCafe". DRIVES the header brand block (Page 1 decision #2 remember-list item: brandName = profile.cafe_name, fallback "Selam Cafe" until loaded / on failure).
  2. **Phone Number** — green phone icon 📞; tel input, value "+251 91 234 5678".
  3. **Location** — red pin icon 📍; text input ("Addis Ababa, Bole") + PURPLE map-pin button on the right. INTERIM behavior: opens Google Maps search for the typed address; real map picker = pending (candidate: `WebApp.requestLocation`).
  4. **Profile Picture** — blue image icon 🖼️; small square preview of the current logo + purple "🖼️ Change" button + dark-outline "🗑️ Remove" button. Change = hidden file input → client-side canvas downscale (max 256px, JPEG) → data-URL preview → persisted with the PATCH; real upload endpoint = pending (Remove clears logo_url).
  5. **Opening Hours** — purple clock icon 🕒; two time-picker dropdowns separated by "–" (30-min steps, 12-hour AM/PM display like "08:00 AM" / "10:00 PM"; payload = 24h "HH:MM").
  6. **Description** — yellow document icon 📄; multi-line textarea, maxLength 200, live counter "N/200" bottom-right inside the field; value "Fresh food, great taste..." (22/200).
- **Update button**: prominent full-width PURPLE pill at the panel bottom, 💾 icon + "Update" → PATCH, toast "Profile updated ✓", header brand refreshes instantly. Saving guard (no double submit); spinner while the profile loads.

### ⚠️ INTEGRATION POINT (profile endpoints — 9th)
- The RULES contract has NO profile endpoints. Suggested: `GET|PATCH /api/admin-miniapp/profile` → `{ profile: { cafe_name, phone, location, logo_url, hours_open, hours_close, description } }`. PATCH whitelists + validates (cafe_name required non-empty ≤60; description ≤200; hours "HH:MM"; logo ≤ ~400KB). Logo upload: interim data URL inside logo_url; real `POST /api/admin-miniapp/profile/logo → { url }` pending main AI.
- brandName wiring (Page 1 decision #2) goes LIVE with this page: boot fetches the profile, Header renders `profile.cafe_name` everywhere (fallback "Selam Cafe").

## Page 1 — v3 addendum: staff badge + bright-yellow "started" — source: Screenshot_20261004_150339_Miro.jpg + text spec

### Problem it solves (user words)
- Staff admins should NOT need to talk to each other to know who is taking which order — when someone taps "start", their name appears ON the order card for every admin to see.

### Order card changes
- **Staff/cooker name badge (NEW)**: when an order is started (`preparing`/`ready`) and the starter is known, a LIGHT-BLUE pill shows at the TOP-LEFT corner of the card with the staff display name (mock: "Fozi", "Rosa"). Service-type badge stays top-right. Card title gets extra top margin so the two pills never overlap.
- **Start button states**: `start` = gold/olive (unchanged) → tapped → `started` = **BRIGHT YELLOW** (`--gold-bright #ffe14d`, white bold text), disabled (status only moves forward via Finished/Cancel). Replaces the previous golden-green started state.
- Name source: authenticated admin's Telegram first name (`user.firstName` from POST /api/admin-miniapp/auth) sent as `started_by` in the PATCH body; optimistic local stamp + authoritative refetch.

### ⚠️ INTEGRATION POINT (10th — started_by field)
- PATCH /api/orders/:id accepts `{ started_by: string }` (trimmed, ≤40 chars) alongside status/payment_status; GET /api/orders returns it on each order.
- Real backend: persist `started_by` (+ recommended `started_at` timestamp) on the orders table, and STAMP IT SERVER-SIDE from the Bearer-token admin identity — the client-sent name is advisory only. Sandbox harness stubs this behavior.

## Page 7 — v2 revision: quick-nav buttons made FUNCTIONAL — user drop 2026-10-04 ("make them work, they open nothing")

- User clarification: the earlier Menu-only trim misread intent — ⭐ Favorites STAYS removed ("no need for the favorite button"), but ＋ Announcements and REPORTS must OPEN WORKING SCREENS, not placeholders.
- Bottom quick-nav restored to 3 buttons: ☰ Menu (switchTab orders) · ＋ Announcements (push announcements) · REPORTS pill (push reports).

### NEW SCREEN: Reports (badge 📊 "Reports", from REPORTS)
- SALES METRICS: Day|Week|Month segmented toggle + the three white-outlined metric cards (Total orders / Revenue ETB / Delivery done) — same data source as the Revenue screen (GET /api/admin-miniapp/revenue?period=).
- PAUSE HISTORY: read-only list of pause/closure events, newest first — card = kind label (Emergency pause / Timed pause / Store closure, color-coded) + duration + "Reason: …" + started→ended timestamps; ongoing events show "ongoing".

### NEW SCREEN: Announcements (badge 📢 "Announcements", from ＋)
- Compose panel: white-outlined card, textarea (≤300 chars + live N/300 counter), full-width purple "📢 Send announcement" button (disabled while empty/sending; composer clears only on success; toast "Announcement sent ✓").
- SENT list: cards with message (pre-wrap) + timestamp + author, newest first; empty state "No announcements sent yet".

### ⚠️ INTEGRATION POINTS 11th + 12th
- `GET /api/admin-miniapp/pause-history` → `{ history: [{ id, kind: 'emergency'|'countdown'|'closed', reason, started_at, ended_at|null }] }` newest first. Server appends an entry whenever intake is paused/closed and stamps ended_at on resume/reopen (sandbox settings PATCH already does this in the harness).
- `GET /api/admin-miniapp/announcements` → `{ announcements: [{ id, message, created_at, author? }] }`; `POST` `{ message ≤300 }` → `{ announcement }`. Server must fan each announcement out to the customer app / bot channel.

## Page 1 — v4 addendum: Order History entry point — user drop 2026-10-04 ("list note icon top-right corner → history orders for today and yesterday")

- Orders root header (tabs variant) renders a LIST-NOTE icon button in the TOP-RIGHT corner of the top bar (list-with-ruled-lines SVG, circular 34px, right-aligned, title stays centered).
- Tap → pushes the History screen (badge 🕘 "History"). Root-page BackButton behavior unchanged (BackButton stays hidden at root; in-app ↩ from History pops back to Orders).
- History screen: two sections — TODAY and YESTERDAY (local calendar day grouping, client-side) — read-only rows: `#id` + HH:MM + status chip (New gold / Preparing violet / Ready & Served green / Cancelled red; cancelled rows dimmed), item summary "qty, name · …" (2-line clamp), service label + total "N ETB". Includes served AND cancelled orders (history ≠ active queue). Data: GET /api/orders?limit=100 (existing contract endpoint; no new integration point). Refresh on every entry.

## Page 1 — v5 addendum: two-step Finished → Done — user report ("it changes to done then the order disappear!! It should disappear when click done")

### Behavior (user directive)
- OLD (bug): tapping "Finished ✅" flipped the card to "Done" for ~0.7s and the order auto-disappeared from the queue.
- NEW (fixed): tapping **"Finished ✅"** marks the order `served` — the bot notifies the customer — and the card **STAYS VISIBLE** in the queue in a green done state (green card border + "✓ Order done — customer notified" line + bright-green **"Done"** button). The order leaves the queue ONLY when an admin explicitly taps **"Done"** (dismiss).
- Done-state cards: start button shows disabled "started", Cancel is disabled (a served order cannot be cancelled), Details stays active, staff badge (who cooked it) remains visible.
- Dismissed orders are not deleted — they still appear in the Order-history screen (today/yesterday).

### Data contract (13th INTEGRATION POINT)
- `PATCH /api/orders/:id { status: 'served' }` — unchanged (customer notification happens server-side here).
- `PATCH /api/orders/:id { dismissed: true }` — NEW: server stamps `dismissed_at` on the order row.
- `GET /api/orders` must KEEP returning `served`-but-not-dismissed orders (the queue filters them client-side via `dismissed_at`); dismissed orders must still reach the history screen.
- Queue filter (client): `status ∈ {new, preparing, ready}` OR (`status = served` AND no `dismissed_at`).

## Page 7 — v3 revision: closure-reason SAVE button — user report ("when the admin types the reason there is nothing to click")

- The closure-reason textarea used to autosave on blur only — undiscoverable on a phone (no visible affordance).
- NEW: a green **"✓ Save reason"** pill button directly under the textarea; disabled until the text differs from server truth; a green "Saved ✓" label appears once saved. Toast "Closure note saved" on every successful save. Blur-autosave kept as a fallback.
- Same panel also seeds pause-for / close-for with the typed reason (unchanged).

## Page 9 — v2: the Profile page is the CAFE-IDENTITY CONTROLLER — user directive ("if the admin changed the name of the cafe [it should change] all the bot project everywhere the name of the cafe is mentioned")

### Single source of truth
- The profile record (`GET|PATCH /api/admin-miniapp/profile`) is THE one cafe-identity record for the whole project. Nothing else stores the cafe name.
- In the admin miniapp the wiring already works end-to-end: Update → PATCH → `brandName` refreshes the header block on every screen instantly.
- `PATCH` responses now include an `updated_at` identity-version stamp — consumers detect a changed profile without diffing fields.

### Propagation contract (server-side, at integration)
- When any profile field changes, the real backend must:
  1. broadcast `profile:update` (full profile object) to all connected ADMIN devices (socket.io) — every admin's header brand refreshes instantly;
  2. broadcast `brand:update` to the CUSTOMER miniapp (same socket server, customer room);
  3. make the BOT read the name at RUNTIME from the profile row (bot templates never hardcode the name) — greeting, order-status, receipt and broadcast messages all pick up the new name with zero redeploy.
- Public consumer endpoint: `GET /api/brand` → `{ name, logo_url, updated_at }` (no auth) — the customer app / any surface calls this on boot and re-reads on `brand:update`.
- Sandbox harness implements `/api/brand` + `updated_at` so the contract shape is testable before integration.

## Global — realtime event catalog (super-speed sync, user directive: "control the customer miniapp using the admin miniapp with super speed of loading and responding")

The admin miniapp's socket layer (`src/socket.js`) now listens to the full push catalog; polling refetches remain only a fallback. Server → admin miniapp events:

| Event | Payload | Effect in the admin app |
|---|---|---|
| `order:new` | full order object | prepended to the live queue (+ success haptic) |
| `order:update` | `{ id, ...patch }` | one order patched in place (status / started_by / dismissed_at from another device) |
| `settings:update` | full settings object | pause / closure / delivery state syncs instantly on every admin device |
| `profile:update` | full profile object | cafe name & profile data refresh everywhere (identity controller) |
| `announcement:new` | announcement object | announcements list prepends + toast |

The same socket server should serve the CUSTOMER miniapp room: `brand:update`, `menu:update`, `settings:update` (closed/pause banner + intake blocking), `announcement:new`, and order-status messages (`order:status` → bot DM). Full wiring guide for connecting the admin miniapp to the Telegram bot lives in `INTEGRATION-README.md` of the handoff zip.
