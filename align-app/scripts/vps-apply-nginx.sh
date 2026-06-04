#!/usr/bin/env bash
# Aplică nginx optimizat pentru chat.diebel.ro (static cache + API no-store).
set -euo pipefail
APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
SRC="$APP_DIR/deploy/nginx-chat.diebel.ro.conf"
DEST="/etc/nginx/sites-available/chat.diebel.ro"

if [ ! -f "$SRC" ]; then
  echo "Lipsește $SRC — rulează git pull în /root/Aplicatie-Chat"
  exit 1
fi

mkdir -p /root/nginx-backups
if [ -f "$DEST" ]; then
  cp "$DEST" "/root/nginx-backups/chat.diebel.ro.$(date +%s)"
fi
cp "$SRC" "$DEST"
ln -sf "$DEST" /etc/nginx/sites-enabled/chat.diebel.ro 2>/dev/null || true
nginx -t
systemctl reload nginx
echo "nginx OK: $DEST"
