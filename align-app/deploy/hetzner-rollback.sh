#!/usr/bin/env bash
# Diebel Chat — rollback pe Hetzner la imaginea anterioară (diebel-app:rollback).
# Nu atinge baza de date. Pentru restaurarea DB vezi comentariul de la final.
set -euo pipefail
APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
LOCAL_HEALTH="${LOCAL_HEALTH:-http://127.0.0.1:3002/api/health}"
cd "$APP_DIR"
docker image inspect diebel-app:rollback >/dev/null 2>&1 || { echo "nu există imaginea diebel-app:rollback"; exit 1; }
docker tag diebel-app:latest "diebel-app:failed-$(date +%Y%m%d-%H%M%S)" || true
docker tag diebel-app:rollback diebel-app:latest
docker compose up -d app
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$LOCAL_HEALTH" || true)"
  [ "$code" = "200" ] && { echo "ROLLBACK OK: $(curl -s -m 5 "$LOCAL_HEALTH")"; exit 0; }
  sleep 2
done
echo "containerul nu răspunde după rollback — docker logs align-app-app-1"
exit 1
# Restaurare DB (doar dacă e nevoie, cu aprobarea proprietarului):
#   docker exec -i align-app-postgres-1 pg_restore -U diebel -d diebel_chat --clean --if-exists < /root/backups/chat-deploy-<TS>/diebel_chat.dump
