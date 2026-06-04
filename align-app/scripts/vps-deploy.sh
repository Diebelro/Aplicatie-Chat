#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/root/Aplicatie-Chat/align-app
SIGNALING_ENV=/srv/aplicatie-chat/align-app/.env.signaling
HOST_PORT=3002
NGINX_SITE=/etc/nginx/sites-enabled/chat.diebel.ro

cd "$APP_DIR"

echo ">>> 1. Aliniere SIGNALING_TOKEN_SECRET cu serverul de semnalizare existent"
SECRET=""
if [ -f "$SIGNALING_ENV" ]; then
  SECRET=$(grep -E '^SIGNALING_TOKEN_SECRET=' "$SIGNALING_ENV" | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)
  if [ -z "$SECRET" ]; then
    SECRET=$(grep -E '^NEXTAUTH_SECRET=' "$SIGNALING_ENV" | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)
  fi
fi
if [ -n "$SECRET" ]; then
  # Setez ACELASI secret in .env.production (NEXTAUTH_SECRET ramane separat pentru sesiuni)
  if grep -q '^SIGNALING_TOKEN_SECRET=' .env.production; then
    sed -i "s|^SIGNALING_TOKEN_SECRET=.*|SIGNALING_TOKEN_SECRET=${SECRET}|" .env.production
  else
    echo "SIGNALING_TOKEN_SECRET=${SECRET}" >> .env.production
  fi
  echo "    OK: secret signaling preluat din $SIGNALING_ENV"
else
  echo "    ATENTIE: nu am gasit secretul signaling; las valoarea generata (apelurile pot esua pana aliniezi)."
fi

echo ">>> 2. docker-compose.override.yml (doar app pe 127.0.0.1:${HOST_PORT}; fara Caddy/signaling)"
# Curatam dependenta lui app de signaling si publicam portul.
# Signaling/caddy raman definite, dar NU le pornim (rulam explicit doar 'app').
cat > docker-compose.override.yml <<YAML
services:
  app:
    depends_on: []
    ports:
      - "127.0.0.1:${HOST_PORT}:3000"
YAML
echo "    OK"

echo ">>> 3. Build + start container app"
docker compose up -d --build --no-deps app

echo ">>> 4. Astept health pe 127.0.0.1:${HOST_PORT}"
ok=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${HOST_PORT}/api/health" || true)
  if [ "$code" = "200" ]; then ok=1; echo "    health 200 (incercarea $i)"; break; fi
  sleep 2
done
if [ "$ok" != "1" ]; then
  echo "    Health NU raspunde 200. Loguri:"
  docker compose logs --tail=40 app || true
  exit 1
fi

echo ">>> 5. nginx chat.diebel.ro -> 127.0.0.1:${HOST_PORT}"
if grep -q 'proxy_pass http://127.0.0.1:3000;' "$NGINX_SITE"; then
  # Backup IN AFARA lui sites-enabled (altfel nginx il incarca => server_name duplicat).
  mkdir -p /root/nginx-backups
  cp "$NGINX_SITE" "/root/nginx-backups/chat.diebel.ro.$(date +%s)"
  sed -i "s|proxy_pass http://127.0.0.1:3000;|proxy_pass http://127.0.0.1:${HOST_PORT};|" "$NGINX_SITE"
  echo "    proxy_pass actualizat (backup salvat)"
else
  echo "    proxy_pass deja != 3000 sau format diferit; verific manual:"
  grep -n 'proxy_pass' "$NGINX_SITE" || true
fi

nginx -t
systemctl reload nginx
echo "    nginx reincarcat"

echo ">>> 6. Sincronizare semnalizare WS pe /srv + restart call-signaling"
SIGNALING_SRV=/srv/aplicatie-chat/align-app
if [ -f "$APP_DIR/server/call-signaling-server.mjs" ] && [ -d "$SIGNALING_SRV/server" ]; then
  cp "$APP_DIR/server/call-signaling-server.mjs" "$SIGNALING_SRV/server/call-signaling-server.mjs"
  chown www-data:www-data "$SIGNALING_SRV/server/call-signaling-server.mjs" 2>/dev/null || true
  if systemctl is-active call-signaling >/dev/null 2>&1; then
    systemctl restart call-signaling
    sleep 1
    if curl -sS http://127.0.0.1:4001/health | grep -q ok; then
      echo "    OK: call-signaling repornit, /health ok"
    else
      echo "    WARN: call-signaling repornit dar /health nu raspunde ok"
    fi
  else
    echo "    WARN: call-signaling inactiv — ruleaza install-signaling-vps.sh"
  fi
else
  echo "    SKIP: $SIGNALING_SRV/server lipsa"
fi

echo ">>> 7. Verificare finala"
echo -n "    local health: "; curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:${HOST_PORT}/api/health"
echo -n "    prin nginx (Host: chat.diebel.ro): "; curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: chat.diebel.ro' https://127.0.0.1/api/health -k
echo -n "    ws signaling: "; curl -sS http://127.0.0.1:4001/health 2>/dev/null || echo "n/a"
echo "    containere:"; docker compose ps
echo ">>> GATA."
