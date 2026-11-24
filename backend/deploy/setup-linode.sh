#!/usr/bin/env bash
# One-time Linode Ubuntu setup for Tusion API.
# Run as root (or with sudo) on a fresh Ubuntu 22.04/24.04 Nanode.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/tusion}"
REPO_URL="${REPO_URL:-}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash setup-linode.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx certbot python3-certbot-nginx

# Node.js
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

# PostgreSQL
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# App user + dirs
id -u tusion >/dev/null 2>&1 || useradd -m -s /bin/bash tusion
mkdir -p "$APP_DIR" /var/log/tusion
chown -R tusion:tusion "$APP_DIR" /var/log/tusion

# Firewall: SSH + HTTP/HTTPS only (Postgres stays local)
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# PM2
npm install -g pm2

# Optional: clone repo if REPO_URL is set
if [[ -n "$REPO_URL" ]]; then
  sudo -u tusion git clone "$REPO_URL" "$APP_DIR"
fi

# DB bootstrap (change password before production!)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='tusion'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER tusion WITH PASSWORD 'change_me_strong';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='tusion'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE tusion OWNER tusion;"

echo ""
echo "=== Linode base setup done ==="
echo "Next:"
echo "  1. Put code in $APP_DIR (git clone / rsync / scp)"
echo "  2. cd $APP_DIR/backend && cp .env.example .env && edit production values"
echo "  3. npm ci && npx prisma generate && npm run prisma:deploy && npm run seed"
echo "  4. Copy deploy/nginx-tusion-api.conf → /etc/nginx/sites-available/tusion-api"
echo "  5. certbot --nginx -d api.yourdomain.com"
echo "  6. sudo -u tusion pm2 start ecosystem.config.cjs --env production"
echo "  7. pm2 save && pm2 startup"
echo ""
echo "DATABASE_URL example:"
echo "  postgresql://tusion:change_me_strong@127.0.0.1:5432/tusion?schema=public"
