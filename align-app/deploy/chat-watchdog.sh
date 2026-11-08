#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Diebel Chat — watchdog pe server (cron la 2 minute)
#   verifică: app (healthz 200 + dbOk), site public (health 200), semnalizare WS (health ok)
#   la 2 eșecuri consecutive ale app-ului: repornește containerul (docker compose up -d app)
#   alertă pe email (Resend, cheia citită din .env.production, niciodată afișată) cu pauză de 30 min
#   la revenire: un singur email „revenit”
# Instalare: crontab → */2 * * * * /root/Aplicatie-Chat/align-app/deploy/chat-watchdog.sh >> /var/log/chat-watchdog.log 2>&1
# Limită: dacă pică tot serverul, acest script nu mai rulează → pentru asta e nevoie de un monitor extern (UptimeRobot).
# ----------------------------------------------------------------------------
set -uo pipefail

APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
STATE_DIR="${STATE_DIR:-/var/lib/chat-watchdog}"
LOCAL_HEALTHZ="${LOCAL_HEALTHZ:-http://127.0.0.1:3002/api/healthz}"
PUBLIC_HEALTH="${PUBLIC_HEALTH:-https://chat.diebel.ro/api/health}"
WS_HEALTH="${WS_HEALTH:-https://ws.diebel.ro/health}"
ALERT_TO="${ALERT_TO:-contact@diebel.ro}"
COOLDOWN_SEC="${COOLDOWN_SEC:-1800}"
mkdir -p "$STATE_DIR"
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

send_email() { # $1 subiect, $2 text
  local key from
  key="$(grep -oP '^RESEND_API_KEY=\K.*' "$APP_DIR/.env.production" 2>/dev/null | tr -d '"' | tr -d "'")"
  from="$(grep -oP '^RESEND_FROM_EMAIL=\K.*' "$APP_DIR/.env.production" 2>/dev/null | tr -d '"')"
  [ -n "$key" ] || { echo "$(ts) fără RESEND_API_KEY — alerta nu a fost trimisă"; return 1; }
  [ -n "$from" ] || from="Diebel <contact@diebel.ro>"
  local payload
  payload="$(printf '{"from":%s,"to":[%s],"subject":%s,"text":%s}' \
    "$(printf '%s' "$from" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$from")" \
    "\"$ALERT_TO\"" \
    "$(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$1")" \
    "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$2")")"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $key" -H "Content-Type: application/json" --data "$payload")"
  echo "$(ts) email „$1” → Resend $code"
  [ "$code" = "200" ]
}

alert_once() { # $1 cheie stare, $2 subiect, $3 text
  local f="$STATE_DIR/alert-$1"
  local now; now="$(date +%s)"
  if [ -f "$f" ] && [ $(( now - $(cat "$f") )) -lt "$COOLDOWN_SEC" ]; then return 0; fi
  send_email "$2" "$3" && echo "$now" > "$f"
}

check() { # $1 nume, $2 url, $3 text obligatoriu (gol = doar 200)
  local body code
  body="$(curl -s -m 10 -w '\n%{http_code}' "$2" 2>/dev/null)"; code="${body##*$'\n'}"; body="${body%$'\n'*}"
  if [ "$code" = "200" ] && { [ -z "$3" ] || printf '%s' "$body" | grep -q -- "$3"; }; then return 0; fi
  echo "$(ts) FAIL $1 ($2) cod=$code"; return 1
}

fails=0; details=""
check "app-local" "$LOCAL_HEALTHZ" '"dbOk":true' || { fails=$((fails+1)); details="$details app-local(healthz/dbOk);"; }
check "site-public" "$PUBLIC_HEALTH" '"status":"ok"' || { fails=$((fails+1)); details="$details site-public;"; }
check "ws-signaling" "$WS_HEALTH" "ok" || { fails=$((fails+1)); details="$details ws-signaling;"; }

cnt_file="$STATE_DIR/consecutive-fails"
if [ "$fails" -gt 0 ]; then
  n=$(( $(cat "$cnt_file" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$cnt_file"
  restarted=""
  if [ "$n" -ge 2 ] && ! check "app-local" "$LOCAL_HEALTHZ" '"dbOk":true'; then
    echo "$(ts) repornesc containerul app (eșec consecutiv #$n)"
    ( cd "$APP_DIR" && docker compose up -d app >/dev/null 2>&1 ) && restarted=" Containerul app a fost repornit automat."
  fi
  alert_once "down" "[Diebel Chat] PROBLEMĂ: $details" "Watchdog $(ts): au picat:$details${restarted} Verifică: docker ps, docker logs align-app-app-1, systemctl status call-signaling nginx. Rollback: bash $APP_DIR/deploy/hetzner-rollback.sh"
  exit 1
else
  if [ -f "$cnt_file" ] && [ "$(cat "$cnt_file")" -ge 2 ]; then
    send_email "[Diebel Chat] REVENIT: toate verificările OK" "Watchdog $(ts): app, site public și semnalizarea răspund din nou normal."
    rm -f "$STATE_DIR/alert-down"
  fi
  echo 0 > "$cnt_file"
  echo "$(ts) OK"
fi
