#!/usr/bin/env bash
# Rulează pe VPS (sudo nu e obligatoriu pentru citire).
set -euo pipefail

echo "=== sites-enabled (symlink-uri) ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true

echo ""
echo "=== Fișiere în sites-available care menționează ws.diebel.ro ==="
grep -l "ws\.diebel\.ro" /etc/nginx/sites-available/* 2>/dev/null || echo "(niciunul)"

echo ""
echo "=== server_name ws.diebel.ro în sites-enabled ==="
grep -r "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep diebel || true

echo ""
echo "=== Test nginx (poate cere sudo) ==="
if sudo -n true 2>/dev/null; then
  sudo nginx -t 2>&1 || true
else
  echo "Rulează: sudo nginx -t"
fi

echo ""
echo "Dacă vezi 'conflicting server name \"ws.diebel.ro\"': ai două vhost-uri."
echo "Vezi: docs/VPS-nginx-ws-conflict-FIX.md"
