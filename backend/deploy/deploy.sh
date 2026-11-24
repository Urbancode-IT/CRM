#!/usr/bin/env bash
# Pull latest code and restart API on Linode.
# Run from the server as user `tusion` (or set APP_DIR).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/tusion}"
BACKEND_DIR="$APP_DIR/backend"

cd "$BACKEND_DIR"
git pull --ff-only
npm ci
npx prisma generate
npm run prisma:deploy
pm2 reload ecosystem.config.cjs --env production
pm2 status
echo "Deploy OK — health: curl -s http://127.0.0.1:5000/api/health"
