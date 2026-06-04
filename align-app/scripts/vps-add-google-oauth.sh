#!/usr/bin/env bash
# Adaugă Google OAuth în .env.production pe VPS (valorile erau pe Vercel, nu s-au copiat la migrare).
#
# Rulează PE SERVER (sau: ssh root@IP 'bash -s' < scripts/vps-add-google-oauth.sh):
#   export GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
#   export GOOGLE_CLIENT_SECRET="...."
#   bash scripts/vps-add-google-oauth.sh
#
# Apoi în Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs:
#   https://chat.diebel.ro/api/auth/callback/google
#
set -euo pipefail
APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
ENVF="$APP_DIR/.env.production"

id="${GOOGLE_CLIENT_ID:-}"
secret="${GOOGLE_CLIENT_SECRET:-}"
if [ -z "$id" ] || [ -z "$secret" ]; then
  echo "EROARE: export GOOGLE_CLIENT_ID și GOOGLE_CLIENT_SECRET înainte de rulare."
  exit 1
fi

cd "$APP_DIR"
touch "$ENVF"
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  grep -q "^${k}=" "$ENVF" && sed -i "/^${k}=/d" "$ENVF"
done
{
  echo "GOOGLE_CLIENT_ID=${id}"
  echo "GOOGLE_CLIENT_SECRET=${secret}"
} >> "$ENVF"

echo "OK: GOOGLE_* scrise în .env.production"
docker compose up -d --no-deps app
sleep 3
curl -s "http://127.0.0.1:3002/api/auth/social-config"
echo ""
echo "google:true în JSON = butonul apare pe login/signup."
