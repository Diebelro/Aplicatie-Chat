#!/usr/bin/env bash
set -u

docker rm -f align-app-signaling-1 >/dev/null 2>&1 || true
sleep 4

echo "=== containere ==="
docker ps --format '{{.Names}} | {{.Status}} | {{.Ports}}' | grep -iE 'align-app|web_web' || true

echo "=== chat.diebel.ro prin nginx (SNI corect) ==="
for p in /api/health / /login /app; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --resolve chat.diebel.ro:443:127.0.0.1 "https://chat.diebel.ro${p}")
  echo "  ${p} -> ${code}"
done

echo "=== ws.diebel.ro health ==="
curl -s -o /dev/null -w '  ws /health -> %{http_code}\n' --resolve ws.diebel.ro:443:127.0.0.1 https://ws.diebel.ro/health

echo "=== nginx detine 80/443? ==="
ss -ltnp 'sport = :443 or sport = :80' | grep -ioE 'nginx|caddy|docker-proxy' | sort -u

echo "=== caddy/signaling container ramas? ==="
docker ps --format '{{.Names}}' | grep -iE 'caddy|signaling' || echo "  niciunul (bine)"
