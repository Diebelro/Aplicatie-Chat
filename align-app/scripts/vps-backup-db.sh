#!/usr/bin/env bash
# Backup zilnic al bazei de date Postgres (conturi, mesaje, prietenii) — Diebel.
# Instalat pe VPS ca /usr/local/bin/diebel-backup-db.sh, rulat din /etc/cron.d/diebel-db-backup.
# Nu oprește aplicația: pg_dump citește printr-o tranzacție consistentă.
set -euo pipefail

PGC="align-app-postgres-1"
BACKUP_DIR="/root/backups/db"
KEEP=14
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

fail() {
  log "EȘEC: $*"
  rm -f "$OUT" 2>/dev/null || true
  exit 1
}

if ! docker inspect -f '{{.State.Running}}' "$PGC" 2>/dev/null | grep -q true; then
  OUT=""
  log "EȘEC: containerul $PGC nu rulează"
  exit 1
fi

# Credențialele vin din containerul însuși, ca să nu le dublăm aici.
PGUSER=$(docker exec "$PGC" printenv POSTGRES_USER)
PGDB=$(docker exec "$PGC" printenv POSTGRES_DB)
OUT="$BACKUP_DIR/${PGDB}-${STAMP}.dump"

docker exec "$PGC" pg_dump -U "$PGUSER" -d "$PGDB" --format=custom --no-owner > "$OUT" \
  || fail "pg_dump a returnat eroare"

[ -s "$OUT" ] || fail "arhiva rezultată e goală"

# Verificăm că arhiva se poate citi; altfel un backup corupt ar trece drept bun.
OBJECTS=$(docker run --rm -v "$BACKUP_DIR":/bk:ro postgres:15-alpine \
  pg_restore --list "/bk/$(basename "$OUT")" 2>/dev/null | grep -c . ) \
  || fail "arhiva e coruptă (pg_restore --list a eșuat)"

[ "$OBJECTS" -gt 50 ] || fail "arhiva pare incompletă ($OBJECTS obiecte)"

# Rotație doar după un backup valid, ca să nu ștergem copiile bune degeaba.
ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

log "OK -> $OUT ($(du -h "$OUT" | cut -f1), $OBJECTS obiecte, păstrăm ultimele $KEEP)"
