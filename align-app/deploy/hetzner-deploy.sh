#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Diebel Chat — deploy pe Hetzner (rulează PE SERVER, din /root/Aplicatie-Chat/align-app)
#   backup (DB + upload-uri + env + imagine) → build Docker → up → health check → rollback automat la eșec
# Apelat de pe PC prin: npm run deploy:hetzner  (scripts/deploy-hetzner.sh)
# Rollback manual:      bash deploy/hetzner-rollback.sh
# ----------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
PG_CONTAINER="${PG_CONTAINER:-align-app-postgres-1}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-align-app_chat_uploads}"
LOCAL_HEALTH="${LOCAL_HEALTH:-http://127.0.0.1:3002/api/health}"
PUBLIC_HEALTH="${PUBLIC_HEALTH:-https://chat.diebel.ro/api/health}"
PUBLIC_HOME="${PUBLIC_HOME:-https://chat.diebel.ro/}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/backups/chat-deploy-$TS"

log() { echo "[$(date +%H:%M:%S)] $*"; }
fail() { echo "[$(date +%H:%M:%S)] EROARE: $*" >&2; exit 1; }

count_sql() {
  docker exec "$PG_CONTAINER" psql -U diebel -d diebel_chat -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}
snapshot_counts() {
  echo "users=$(count_sql 'select count(*) from "User"') messages=$(count_sql 'select count(*) from "Message"') photos=$(count_sql 'select count(*) from "ProfilePhoto"')"
}

cd "$APP_DIR" || fail "nu există $APP_DIR"
[ -f .env.production ] || fail "lipsește .env.production"
COMMIT="${BUILD_COMMIT_SHA:-$(cat .deploy-commit 2>/dev/null || echo unknown)}"

# ---------------------------------------------------------------- 1. BACKUP
log "1/5 Backup în $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
docker exec "$PG_CONTAINER" pg_dump -U diebel -d diebel_chat -Fc > "$BACKUP_DIR/diebel_chat.dump" || fail "pg_dump a eșuat"
[ -s "$BACKUP_DIR/diebel_chat.dump" ] || fail "dump gol"
VOL="$(docker volume inspect "$UPLOADS_VOLUME" --format '{{.Mountpoint}}')"
tar -C "$VOL" -czf "$BACKUP_DIR/chat_uploads.tar.gz" .
cp .env.production "$BACKUP_DIR/env.production.bak" && chmod 600 "$BACKUP_DIR/env.production.bak"
if docker image inspect diebel-app:latest >/dev/null 2>&1; then
  docker tag diebel-app:latest diebel-app:rollback
  log "imagine curentă etichetată diebel-app:rollback"
fi
BEFORE="$(snapshot_counts)"
log "date înainte: $BEFORE"
echo "$BEFORE" > "$BACKUP_DIR/counts-before.txt"
du -sh "$BACKUP_DIR" | awk '{print "   backup: "$1}'

# ---------------------------------------------------------------- 2. BUILD
log "2/5 Build imagine (commit $COMMIT)"
BUILD_COMMIT_SHA="$COMMIT" docker compose build app 2>&1 | tail -5 || fail "build eșuat"

# ---------------------------------------------------------------- 3. UP
log "3/5 Pornire container nou"
docker compose up -d app >/dev/null 2>&1 || fail "docker compose up a eșuat"

# ---------------------------------------------------------------- 4. HEALTH
log "4/5 Health check"
ok=0
for i in $(seq 1 45); do
  code="$(curl -s -o /tmp/chat-health.json -w '%{http_code}' -m 5 "$LOCAL_HEALTH" || true)"
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 2
done
rollback() {
  log "ROLLBACK → diebel-app:rollback"
  docker tag diebel-app:rollback diebel-app:latest
  docker compose up -d app >/dev/null 2>&1 || true
  for i in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$LOCAL_HEALTH" || true)" = "200" ] && { log "rollback OK (vechea versiune răspunde 200)"; return 0; }
    sleep 2
  done
  log "rollback: containerul vechi nu răspunde — verifică manual: docker logs align-app-app-1"
  return 1
}
[ "$ok" = "1" ] || { rollback; fail "health local nu a dat 200 în 90s"; }
LIVE_COMMIT="$(sed -n 's/.*"short":"\([^"]*\)".*/\1/p' /tmp/chat-health.json | head -1)"
pub="$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$PUBLIC_HEALTH" || true)"
home="$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$PUBLIC_HOME" || true)"
if [ "$pub" != "200" ] || [ "$home" != "200" ]; then
  rollback; fail "public health=$pub home=$home"
fi
AFTER="$(snapshot_counts)"
echo "$AFTER" > "$BACKUP_DIR/counts-after.txt"
if [ "$BEFORE" != "$AFTER" ]; then
  log "ATENȚIE: numerele diferă înainte/după: $BEFORE → $AFTER (deploy-ul nu șterge date; verifică activitatea utilizatorilor)"
fi

# ---------------------------------------------------------------- 5. CURĂȚENIE
log "5/5 Curățenie (doar imagini fără tag)"
docker image prune -f >/dev/null 2>&1 || true
log "GATA: live commit=$LIVE_COMMIT  local=200 public=$pub home=$home  date: $AFTER"
log "rollback disponibil: bash $APP_DIR/deploy/hetzner-rollback.sh  (imagine diebel-app:rollback, dump $BACKUP_DIR/diebel_chat.dump)"
