# 📱 Selam Cafe → Oracle Cloud — PHONE-ONLY edition (self-contained)

_Entire migration possible on a smartphone. No PC, no installed apps required —
all terminal work happens inside **Oracle Cloud Shell** (a black window in the
Oracle console, marked `>_` in the top bar)._

**You need:** a phone (browser + Telegram) and a card for Oracle's identity
check (never charged). That's everything.

## Phone habits (before starting)

1. Browsers: enable **"Desktop site"** on Oracle console pages (⋮ menu) — never
   fight the mobile layout.
2. Never type long commands: copy from the chat/guide → long-press → paste.
3. Split-screen (chat above, Oracle below) or picture-in-picture is your friend.

## Step 1 — Oracle account (browser)

oracle.com/cloud/free → Start for free → email code → card → phone code.
🛑 Home region = the closest to Ethiopia (UAE East / Israel). 🔴 **Cannot ever
be changed later.**

## Step 2 — Create the free VM (browser, desktop mode)

Compute → Instances → Create Instance (or console search: "instance"):
- Name `selam-cafe` · Image **Ubuntu 22.04** · Shape **Ampere A1.Flex, 1 OCPU / 12 GB RAM**
- Public subnet + public IPv4 · **Generate a key pair → save BOTH files**
  (also copy the private-key TEXT into Notes as a brain backup)
- Create → wait for **RUNNING** → write down **Public IP** + username `ubuntu`

"Out of capacity"? Retry later at 1 OCPU, or free fallback
`VM.Standard.E2.1.Micro` (1 GB RAM — last resort).

## Step 3 — Open doors 80 + 443 (browser)

Instance page → Virtual cloud network → Security Lists → Default →
**Add Ingress Rules** twice: source `0.0.0.0/0`, TCP, port **80**; then port **443**.
Two new rows = ✅.

## Step 4 — Enter the server: Oracle Cloud Shell (zero installs)

1. Console top bar → **`>_`** → start Cloud Shell (black window, bottom of page)
2. Make a key *inside Cloud Shell*:
   `ssh-keygen -t ed25519 -f ~/selam-key -N "" -C phone` then `cat ~/selam-key.pub`
3. Copy the printed `ssh-ed25519 AAAA…` line → instance page → **Edit SSH keys**
   → paste → Save
4. Connect: `ssh -i ~/selam-key ubuntu@YOUR-IP` → type `yes` once
→ prompt becomes `ubuntu@selam-cafe:~$` — everything from here happens in this window.

App alternative: **Termux** (Android, from f-droid.org: `pkg install openssh`)
or **Termius** (iOS/Android). Cloud Shell is simplest.

💡 Cloud Shell **sleeps after ~20 idle minutes and closes its window** — that's
normal, nothing is lost: your files (including `~/selam-key`) are saved. Just
tap the `>_` icon again and re-run the ssh command from Step 4.4.

## Step 5 — Code + secrets + the one big script (Cloud Shell)

    sudo apt update && sudo apt install -y git
    git clone https://github.com/oo973250-source/selam-cafe-all-in-one.git
    cd selam-cafe-all-in-one
    cp deploy/oracle/env.example .env
    openssl rand -hex 32      # copy output → JWT_SECRET
    openssl rand -hex 32      # copy output → WEBHOOK_SECRET

Fill `.env` with sed one-liners (phone-friendly, no nano!) — replace the CAPS:

    sed -i "s#^BOT_TOKEN=.*#BOT_TOKEN=PASTE-FRESH-BOTFATHER-TOKEN#" .env
    sed -i "s#^JWT_SECRET=.*#JWT_SECRET=FIRST-OPENSSL-RESULT#" .env
    sed -i "s#^WEBAPP_URL=.*#WEBAPP_URL=https://selamcafe.duckdns.org#" .env
    sed -i "s#^WEBHOOK_SECRET=.*#WEBHOOK_SECRET=SECOND-OPENSSL-RESULT#" .env

Leave `DATABASE_URL=` and `ADMIN_TELEGRAM_IDS=` **empty** — the script fills the
database URL for you and `/ping` (Step 9) gives you the admin number.
Check: `grep -E '^(BOT|JWT|WEBAPP|WEBHOOK)' .env` — each of those four lines must
show YOUR value, while `DATABASE_URL=` and `ADMIN_TELEGRAM_IDS=` stay empty.

Then the ONE BIG command:

    sudo sh deploy/oracle/setup-server.sh

No typing for ~5–10 min (installs Node 20 + PostgreSQL + nginx + certbot, creates
the `selamcafe` DB with a random password auto-written into `.env`, builds both
Mini Apps on ARM, installs the self-healing systemd service, opens the OS firewall
doors). Safe to lock your phone mid-phase — it runs server-side.

✅ `curl http://localhost:3000/health` → `{"ok":true,…}` · DB note:
PostgreSQL is installed and owned by this setup — you never manage it manually;
the connection string placed in `.env` is everything the app needs.

## Step 6 — DuckDNS (browser, phone's home turf)

duckdns.org → sign in with Google → type `selamcafe` → **add domain** →
put your server IP into **current ip** → save.
Verify in Cloud Shell: `ping -c 3 selamcafe.duckdns.org`

## Step 7 — HTTPS lock (Cloud Shell, one command)

    sudo certbot --nginx -d selamcafe.duckdns.org

(email → `y` → **2** = Redirect). Verify: `curl -I https://selamcafe.duckdns.org/health` → `HTTP/2 200`.
The certificate renews itself forever.

## Step 8 — Point the bot at the new home

> ⚠️ From now on, ALWAYS edit **`/opt/selam-cafe/.env`** — that copy is what the
> server runs from. The `.env` inside your `~/selam-cafe-all-in-one` clone is
> only a leftover; edits there do nothing.

    sudo sed -i "s#^WEBAPP_URL=.*#WEBAPP_URL=https://selamcafe.duckdns.org#" /opt/selam-cafe/.env
    sudo systemctl restart selam-cafe

Telegram (phone-native): @BotFather → `/mybots` → your bot → **Bot Settings →
Menu Button** → `https://selamcafe.duckdns.org?lang=en`

## Step 9 — Full test (all in the Telegram app)

1. Bot → **START** → pick **English**
2. `/ping` → copy your number → make yourself admin:
   `sudo sed -i "s#^ADMIN_TELEGRAM_IDS=.*#ADMIN_TELEGRAM_IDS=YOUR-PING-NUMBER#" /opt/selam-cafe/.env && sudo systemctl restart selam-cafe`
   → `/ping` again → **Admin: YES**
3. Menu button → Mini App opens (proves DNS + HTTPS + WEBAPP_URL at once)
4. Order → **mock payment** (demo mode — nothing real is charged; adding a live
   `CHAPA_SECRET_KEY` to `.env` later flips it to real payments, zero code changes)
5. **All Done** screen → then verify the trio:
   🧾 **ORDER RECEIPT** in your chat · 🔔 **NEW ORDER ALERT** in every admin chat ·
   card appears **live** in `/admin` → 📲 Open Admin Panel (no refresh)
6. Staff round-trip: tap **Start** → **Ready** → "ready" message lands back in the
   customer chat. Full circle ✅

## Step 10 — Phone-sized future habits

- **Backup Fridays (10 s):** `pg_dump -U selam -h localhost selamcafe -Fc -f ~/backup-$(date +%F).dump`
  (password = inside `.env`'s `DATABASE_URL=postgres://selam:PASSWORD@localhost…`);
  copy a `.dump` file OFF the server monthly (phone download via Cloud Shell or Termius SFTP).
- 🥷 **Before real customers pay:** ask the assistant to remove the
  "Place Order (skip payment)" test button (same-day PR).
- **Retire Railway** fully once tests pass (two homes can't both poll: 409 Conflict).
- **Money forever:** never "Upgrade to Pay As You Go" · decline paid add-ons ·
  the $300-trial-expiry email is harmless · free tier = 2 OCPU/12 GB/200 GB, you use a fraction.
- **Re-entry:** Cloud Shell remembers `~/selam-key`; a fresh window needs only
  `ssh -i ~/selam-key ubuntu@IP`.
- **When anything breaks:** `sudo journalctl -u selam-cafe -n 50` → screenshot the
  last lines → one-line fix comes back.

## Quick phone troubleshooting map

| Symptom | Fix (all in Cloud Shell) |
|---|---|
| SSH says `Permission denied` | key not yet added on the instance page (Step 4.3) or `~/selam-key` path typo — redo both, exactly |
| SSH says `Connection timed out` | doors 80/443 not saved in Step 3, OR wrong IP / instance stopped — recheck both |
| Clone asks password | repo is private → fine-grained GitHub token (2 min on browser) |
| `401 Unauthorized` in logs | fresh BOT_TOKEN at @BotFather → sed into `.env` → restart |
| No staff alert | empty or wrong `ADMIN_TELEGRAM_IDS` → Step 9, item 2 |
| Blank Mini App | `cd /opt/selam-cafe && sudo -u selam npm run build:miniapp && sudo systemctl restart selam-cafe` |
| 502 Bad Gateway | `sudo systemctl restart selam-cafe` |
| DuckDNS wrong IP | duckdns.org → update "current ip" → save |
| Certificate warnings | re-run `sudo certbot --nginx -d domain` (safe) |
| "Out of capacity" | retry daily / E2.1.Micro fallback |
| claw back an idle-reclaimed instance (after 7 truly quiet days) | re-create VM + re-run script + update DuckDNS (~20 min) — backups make this painless |

## Done = all six ticked

☐ health 200 (both localhost + https) · ☐ `/ping` Admin: YES · ☐ Mini App opens ·
☐ mock payment completes → All Done · ☐ receipt + staff alert arrive ·
☐ Start/Ready/Done statuses echo to the customer chat.

**Conclusion — the migration is complete.** Your cafe now lives in one place:

- 🌍 **Web:** `https://selamcafe.duckdns.org` — trilingual Mini App (English / አማርኛ / Afaan Oromoo) behind an auto-renewing HTTPS certificate
- 💬 **Bot:** customer receipts 🧾, staff alerts 🔔, 📲 native Admin Panel with a live realtime order board
- 🐘 **Data:** PostgreSQL, private (localhost-only), password auto-generated and stored in the server's `.env`
- 🩹 **Server:** Oracle Always Free ARM (1 OCPU / 12 GB), self-healing systemd service, restarts on crash or reboot — **$0 forever, no trial cliff**

All six done-boxes ticked = fully functional bot + web app, deployed entirely
from a smartphone with zero prior experience. After that, life is small:
invite customers by sharing `t.me/YOURBOT`, run a 10-second backup on Fridays,
paste a live Chapa key whenever you're ready for real payments — and when
anything ever misbehaves, the ritual is one line:

    sudo journalctl -u selam-cafe -n 50

(screenshot the last lines, send them over — one-line fix comes back).
