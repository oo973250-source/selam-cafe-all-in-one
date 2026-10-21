# 🚀 Migrating Selam Cafe from Railway → Oracle Cloud (Always Free)

_You need zero cloud experience for this. Everything below is click-by-click.
Two things you must have: a **debit/credit card for identity verification**
(Oracle does not charge it on the free tier) and a **domain name** (~$10/year,
or a free DuckDNS subdomain — see Step 6)._

**What we're building:** one free Ubuntu server (Oracle "Always Free" tier,
ARM CPU + 12 GB RAM) that runs the entire project in one process — Mini App,
Telegram bot, API, admin panel — plus its own Postgres database. This is the
same all-in-one layout Railway gave you, just on your own free machine.

**What's prepared for you in this repo (I did these already):**

| File | Purpose |
|---|---|
| `deploy/oracle/setup-server.sh` | One command that installs Node, Postgres, nginx, creates the database, builds the app, and sets up auto-start |
| `deploy/oracle/selam-cafe.service` | Makes the app restart automatically if it crashes or the server reboots |
| `deploy/oracle/nginx-selam.conf` | Web-server front that shows your app on port 80/443 |
| `deploy/oracle/env.example` | Explains every setting you must fill in |

---

## Step 1 — Create the Oracle Cloud account (~15 min)

1. Go to **https://www.oracle.com/cloud/free/** → click **Start for free**.
2. Fill the form. Before you submit:
   - **Home region**: pick the one physically close to Ethiopia — **Israel Central** or **UAE East (Dubai)** or **Germany Central** are reasonable choices; latency to Telegram matters little but to you/your staff matters.
   - ⚠️ **The home region CANNOT be changed later.** Choose consciously.
3. Verify your email and phone. Add your card when asked — Oracle places a
   small temporary hold that disappears; **you are not charged** as long as you
   stay on the Free Tier (see Step 10 about the one billing trap).
4. When done you land on the **Cloud Console** (orange/dark dashboard).

## Step 2 — Create the free VM (~10 min)

1. At the top click **Compute → Instances → Create Instance**.
2. **Name**: `selam-cafe`.
3. **Image**: **Ubuntu 22.04** (or 24.04) — "Canonical Ubuntu … Minimal" is fine too.
4. **Shape**: click **Change shape → Ampere (Arm) → VM.Standard.A1.Flex**, set
   **1 OCPU and 12 GB RAM** (the free total is 2 OCPU/12 GB; 1 OCPU is plenty
   and keeps the 2nd OCPU free for a spare VM later. If you don't care, just
   use 2 OCPU / 12 GB).
5. **Networking**: leave defaults, but confirm the subnet is **public** and
   "Assign a public IPv4 address" is ticked.
6. **SSH keys**: choose **"Generate a key pair"** → **Download BOTH the private
   key (`*.key`) and public key** and save them somewhere safe. This `.key`
   file is your password into the server — never lose it, never share it.
7. Click **Create**. Wait until the card says **RUNNING**, then copy the
   **Public IP address** shown in the instance details. **Write it down.**

> ❓ If it says **"Out of capacity"** for Ampere: go back and try allocating
> only 1 OCPU, or try again at another time of day (capacity in popular
> regions frees up). Failing that, the shape **VM.Standard.E2.1.Micro** is also
> free (2 instances of them) but has only 1 GB RAM — use it only as a
> last resort.

## Step 3 — Open ports 80 and 443 in Oracle's firewall (~5 min)

The VM has TWO firewalls. First the Oracle one:

1. Click your instance → under the **Instance details** find **"Virtual cloud network"** → click it.
2. Click **Security Lists → Default Security List** → **Add Ingress Rules**.
3. Add two rules (leave everything else at default):
   - Rule A: Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80**
   - Rule B: Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **443**
4. Save. (SSH on port 22 is already open by default.)

The guest-OS firewall on the VM is opened automatically by the setup script in Step 5 — nothing for you to do there.

## Step 4 — Connect to the server (~5 min)

**Windows:** open PowerShell (Start → type "powershell") and type:

```powershell
ssh -i C:\Users\YOU\Downloads\ssh-key.key ubuntu@YOUR_SERVER_IP
```

(The command is the "SSH command" shown on your instance page — copy it from there.)
The first time, type `yes` and press Enter. If you get "Permission denied",
make sure you used the **private** key file path and the username `ubuntu`.

**Mac/Linux:**

```bash
chmod 400 ~/Downloads/ssh-key.key
ssh -i ~/Downloads/ssh-key.key ubuntu@YOUR_SERVER_IP
```

You now see `ubuntu@selam-cafe:~$` — that shell IS the server. Type `exit` to leave.

## Step 5 — Get the project onto the server

If you know your **GitHub repo URL** (it's this project — check with me if unsure):

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git selam-src
cd selam-src
```

(If the repo is private, GitHub will ask for a username + token at clone time — I can walk you through making a token when you get here.)

> Make sure the **latest code is pushed first** (I normally do this for you —
> just ask "push the latest code to GitHub" before you start the migration).

## Step 6 — Create `.env` and run the setup script

1. Still inside the repo folder, copy the template:

   ```bash
   cp deploy/oracle/env.example .env
   nano .env
   ```

2. Fill in (nano basics: type, `Ctrl+O` Enter to save, `Ctrl+X` to exit):
   - `DATABASE_URL` — **leave EMPTY**, the setup script fills it automatically.
   - `BOT_TOKEN` — from @BotFather. Since the old one was revoked, use your new one.
   - `JWT_SECRET` — generate: `openssl rand -hex 32` (run that in another terminal tab, paste result).
   - `ADMIN_TELEGRAM_IDS` — your Telegram numeric ID(s), comma separated.
   - `WEBAPP_URL` — `https://YOURDOMAIN.com` (the domain from Step 7; write the final form now).
   - `WEBHOOK_SECRET` — `openssl rand -hex 32` again.

3. Run the one-shot installer (takes ~5–10 min, prints progress):

   ```bash
   sudo sh deploy/oracle/setup-server.sh
   ```

4. When it finishes, check the app is alive:

   ```bash
   curl http://localhost:3000/health
   # expect: {"ok":true,...}
   sudo systemctl status selam-cafe
   ```

## Step 7 — Domain + HTTPS (required: Telegram Mini Apps demand a valid certificate)

**Option A — buy a domain (~$10/yr):** any registrar (Namecheap, Cloudflare, etc.).
**Option B — free:** go to **duckdns.org**, sign in, create e.g. `selamcafe.duckdns.org`, note the token.

Then point the domain at your server:

- **Purchased domain**: in the registrar's DNS page, add an **A record**:
  `@` (or `app`) → `YOUR_SERVER_IP`. If you used `app`, your final URL is `https://app.YOURDOMAIN.com`.
- **DuckDNS**: on duckdns.org just type your server IP into the "current ip" box and save.

Wait 2–5 minutes, then on the server:

```bash
sudo certbot --nginx -d selamcafe.duckdns.org   # ← your real full domain
```

Follow the prompts (enter your email, agree, choose "Redirect" when asked).
Certbot gives you HTTPS automatically **and renews it on its own** forever.
Verify: `curl -I https://YOURDOMAIN.com/health` → `HTTP/2 200`.

## Step 8 — Point the bot at the new address

1. Reconnect to the server and update the URL: `sudo nano /opt/selam-cafe/.env` →
   set `WEBAPP_URL=https://YOURDOMAIN.com` → save → then:

   ```bash
   sudo systemctl restart selam-cafe
   ```

2. Open Telegram → your bot → **/ping** — it should reply and say you are admin.
3. In @BotFather (only if the button went stale): `/mybots` → your bot →
   **Bot Settings → Menu Button** → send `https://YOURDOMAIN.com?lang=en`.
   (Ordinarily the bot re-sets the button itself on language choice.)
4. Open the menu button → the Mini App should load → place a test order →
   you get the receipt in the bot AND the staff alert.

## Step 9 — Moving your old data (orders & menu) from Railway

Case 1 — **Railway project is still reachable** (trial recently expired but
project not deleted): Railway pauses rather than deletes. You can upgrade to
Hobby ($5) briefly, `railway shell` into the Postgres and `pg_dump`, or simply
connect from the new server and dump directly:

```bash
pg_dump "postgresql://...RAILWAY_PUBLIC_URL..." -Fc -f /tmp/selam.dump
pg_restore -d postgres://...LOCAL_DB_URL... --clean --if-exists /tmp/selam.dump
```

Case 2 — **project data is gone**: nothing to do. The app **auto-creates its
schema and re-seeds the default Ethiopian menu** on first boot; customers just
press Start again in the bot. Only old order history is lost.

I can do Case 1 for you end-to-end if the Railway project is still up — just ask.

## Step 10 — Staying on the free tier (important)

- ✅ Everything in this guide fits the **Always Free** allowance: 2 ARM OCPUs +
  12 GB RAM total, 200 GB storage. Your usage: ~1 OCPU, ~2 GB RAM, ~50 GB disk.
- ⚠️ **Never click "Upgrade to Pay As You Go"** unless you're ready for real
  billing. The free trial's $300 credits expire; the Always Free resources do not.
- ⚠️ Don't enable extra paid services (load balancers, managed databases,
  backups-as-a-service). Our setup uses none of them.
- ℹ️ Oracle may reclaim **completely idle** free VMs after a long idle period.
  A working cafe bot has daily traffic, so in practice this doesn't happen —
  but take a small backup weekly: `pg_dump` to a file you copy off the server.

## Troubleshooting

| Symptom | Command / fix |
|---|---|
| App down | `sudo systemctl status selam-cafe`, then `sudo journalctl -u selam-cafe -n 50` |
| Bot silent | `sudo journalctl -u selam-cafe -n 30 \| grep -i bot` — check BOT_TOKEN · run `/ping` in the bot |
| Mini App won't open | URL must be `https://` with valid cert: `sudo certbot --nginx -d YOURDOMAIN` |
| Site unreachable before HTTPS | This is the OCI security list (Step 3): did you add ports 80 & 443? |
| "Out of capacity" | Try 1 OCPU, retry later, or E2.1.Micro fallback |
| Locked out of SSH after firewall edits | Never enable `ufw` without allowing OpenSSH first — the setup script uses plain iptables rules and keeps SSH open |
| Wanna see live logs | `sudo journalctl -u selam-cafe -f` (Ctrl+C to exit) |

---

## One-page checklist

1. ☐ Oracle signup, card verified, home region chosen
2. ☐ VM `VM.Standard.A1.Flex` Ubuntu 22.04, SSH key downloaded, IP noted
3. ☐ Ingress rules 80 + 443 added (Security List)
4. ☐ SSH in, clone repo
5. ☐ `cp deploy/oracle/env.example .env`, fill secrets
6. ☐ `sudo sh deploy/oracle/setup-server.sh`
7. ☐ `curl http://localhost:3000/health` → 200
8. ☐ Domain → A record → server IP; `sudo certbot --nginx -d domain`
9. ☐ `WEBAPP_URL` updated, restart, /ping works, menu button opens app
10. ☐ Test order: customer receipt + staff alert arrive
