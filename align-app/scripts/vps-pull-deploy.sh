#!/usr/bin/env bash
set -euo pipefail
cd /root/Aplicatie-Chat
git fetch origin
git reset --hard origin/main
cd align-app
docker compose build app
docker compose up -d --force-recreate app
sleep 6
echo "=== verify ==="
curl -s -o /dev/null -w "healthz: %{http_code}\n" http://127.0.0.1:3002/api/healthz
curl -s http://127.0.0.1:3002/api/healthz | head -c 120
echo
