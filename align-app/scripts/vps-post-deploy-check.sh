#!/usr/bin/env bash
# Verificare rapidă după deploy pe VPS (rulează PE SERVER).
set -u
APP_DIR="${APP_DIR:-/root/Aplicatie-Chat/align-app}"
ENVF="$APP_DIR/.env.production"
FAIL=0

fail() { echo "  FAIL $1"; FAIL=1; }
ok()   { echo "  OK   $1"; }

echo "=== Diebel post-deploy check ==="
[ -f "$ENVF" ] || fail ".env.production lipseste"

for k in DATABASE_URL NEXTAUTH_SECRET NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SIGNALING_WS_URL SIGNALING_TOKEN_SECRET TURN_REALM TURN_STATIC_SECRET; do
  grep -qE "^${k}=.+" "$ENVF" 2>/dev/null && ok "$k" || fail "$k GOL"
done

grep -qE '^RESEND_API_KEY=.+' "$ENVF" && ok "RESEND_API_KEY" || echo "  WARN RESEND_API_KEY gol (reset parola email nu merge)"

systemctl is-active nginx >/dev/null 2>&1 && ok "nginx" || fail "nginx"
systemctl is-active call-signaling >/dev/null 2>&1 && ok "call-signaling" || echo "  WARN call-signaling inactiv"
docker compose -f "$APP_DIR/docker-compose.yml" ps --format '{{.Name}}' 2>/dev/null | grep -q align-app-app && ok "container app" || fail "container app"

code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/api/healthz 2>/dev/null || echo 000)
[ "$code" = "200" ] && ok "healthz local" || fail "healthz local $code"

code=$(curl -s -o /dev/null -w '%{http_code}' https://chat.diebel.ro/api/healthz 2>/dev/null || echo 000)
[ "$code" = "200" ] && ok "healthz public" || fail "healthz public $code"

code=$(curl -s -o /dev/null -w '%{http_code}' https://ws.diebel.ro/health 2>/dev/null || echo 000)
[ "$code" = "200" ] && ok "ws health" || fail "ws health $code"

echo
[ "$FAIL" -eq 0 ] && echo "Verdict: OK" || echo "Verdict: PROBLEME"
exit "$FAIL"
