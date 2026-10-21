#!/bin/sh
# ============================================================================
# Selam Cafe — one-shot setup for an Oracle Cloud Always Free Ubuntu VM (ARM)
# ----------------------------------------------------------------------------
# Run this ONCE on a fresh VM, from inside your cloned repo:
#
#     sudo sh deploy/oracle/setup-server.sh
#
# It:
#   1. installs Node.js 20, PostgreSQL, nginx, certbot, git
#   2. creates an app user `selam` and moves the repo to /opt/selam-cafe
#   3. creates the `selamcafe` database and user with a random password
#      (written into /opt/selam-cafe/.env only if DATABASE_URL is still blank)
#   4. installs dependencies and builds miniapp + admin mini app
#   5. installs the systemd service (auto-restart, starts on boot)
#   6. installs the nginx reverse proxy and opens ports 80/443
#
# Safe to re-run: existing config files are kept (backed up with .bak).
# ============================================================================

set -eu
[ "$(id -u)" = 0 ] || { echo "run with sudo: sudo sh deploy/oracle/setup-server.sh"; exit 1; }

APP_DIR=/opt/selam-cafe
APP_USER=selam
APP_DB=selamcafe
SERVICE_NAME=selam-cafe
NGINX_SITE=selam-cafe

echo "==> [1/7] Installing packages (Node 20, PostgreSQL, nginx, certbot)…"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git >/dev/null
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sh - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
apt-get install -y -qq postgresql nginx certbot python3-certbot-nginx >/dev/null

echo "==> [2/7] Creating app user and installing the app to $APP_DIR…"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
SRC_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$SRC_DIR" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  cp -a "$SRC_DIR"/. "$APP_DIR"/
fi
# npm install/build must be able to write node_modules, dist, logs
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [3/7] Preparing PostgreSQL…"
systemctl enable --now postgresql >/dev/null 2>&1 || true
DB_PASSWORD="$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1 \
  || runuser -u postgres -- psql -qc "CREATE ROLE $APP_USER LOGIN PASSWORD '$DB_PASSWORD';"
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$APP_DB'" | grep -q 1 \
  || runuser -u postgres -- createdb -O "$APP_USER" "$APP_DB"
NEW_DB_URL="postgres://$APP_USER:$DB_PASSWORD@localhost:5432/$APP_DB"

# .env — create from template, then fill DATABASE_URL only if it is still blank.
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/deploy/oracle/env.example" "$APP_DIR/.env"
fi
if ! grep -Eq '^DATABASE_URL=.+' "$APP_DIR/.env"; then
  if grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$NEW_DB_URL|" "$APP_DIR/.env"
  else
    printf '\nDATABASE_URL=%s\n' "$NEW_DB_URL" >> "$APP_DIR/.env"
  fi
fi
chown "$APP_USER:$APP_USER" "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env"

echo "==> [4/7] Installing dependencies and building the frontends (ARM-safe)…"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --no-audit --no-fund
# NOTE: build individually — `build:admin` expects a legacy folder that was
# retired, and `build:all` stops at the first failure.
sudo -u "$APP_USER" npm run build:miniapp || echo "!! miniapp build failed"
sudo -u "$APP_USER" npm run build:admin-miniapp || echo "!! admin miniapp build failed"

echo "==> [5/7] Installing systemd service…"
cp "$APP_DIR/deploy/oracle/selam-cafe.service" "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "==> [6/7] Installing nginx reverse proxy…"
if [ -f "/etc/nginx/sites-available/$NGINX_SITE" ]; then
  cp "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-available/$NGINX_SITE.bak"
fi
cp "$APP_DIR/deploy/oracle/nginx-selam.conf" "/etc/nginx/sites-available/$NGINX_SITE"
ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> [7/7] Opening firewall ports (OCI Ubuntu ships iptables rules)…"
# Ubuntu images on OCI pre-load an iptables ruleset; append explicit ACCEPTs
# and persist them so they survive reboots.
for PORT in 80 443; do
  iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp --dport "$PORT" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save
elif command -v iptables-save >/dev/null 2>&1; then
  mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4
fi

echo ""
echo "────────────────────────────────────────────────────────────────"
echo " Server setup done. NEXT STEPS (see docs/DEPLOY-ORACLE.md):"
echo ""
echo " 1. Edit the secrets:   sudo nano $APP_DIR/.env"
echo "    fill in BOT_TOKEN, JWT_SECRET, ADMIN_TELEGRAM_IDS,"
echo "    WEBAPP_URL, WEBHOOK_SECRET (deploy/oracle/env.example explains each)"
echo " 2. Start the app:      sudo systemctl restart $SERVICE_NAME"
echo " 3. Check health:       curl http://localhost:3000/health"
echo " 4. Add your domain DNS A record → this VM's public IP, then run:"
echo "        sudo certbot --nginx -d yourdomain.com"
echo " 5. Follow the log:     sudo journalctl -u $SERVICE_NAME -f"
echo "────────────────────────────────────────────────────────────────"
