#!/usr/bin/env bash
set -euo pipefail

echo "=== DNS local ==="
echo -n "www.diebel.ro A: "; dig +short www.diebel.ro A @8.8.8.8 || true
echo -n "www.diebel.ro CNAME: "; dig +short www.diebel.ro CNAME @8.8.8.8 || true
echo -n "diebel.ro A: "; dig +short diebel.ro A @8.8.8.8 || true
echo -n "www NS answers: "; dig www.diebel.ro @8.8.8.8 +noall +answer || true

echo
echo "=== curl apex ==="
curl -sS -I --max-time 10 https://diebel.ro/ | head -15

echo
echo "=== curl www by Host header to IP ==="
curl -sS -I --max-time 10 --resolve www.diebel.ro:443:178.104.2.31 https://www.diebel.ro/ 2>&1 | head -20
curl -sS -I --max-time 10 --resolve www.diebel.ro:80:178.104.2.31 http://www.diebel.ro/ 2>&1 | head -20

echo
echo "=== nginx diebel.ro server_name ==="
grep -nE 'server_name|listen|ssl_certificate|return|root' /etc/nginx/sites-enabled/diebel.ro | head -60

echo
echo "=== certs mentioning www ==="
ls /etc/letsencrypt/live/ 2>/dev/null | head -40
grep -rln 'www.diebel.ro' /etc/nginx/ /etc/letsencrypt/ 2>/dev/null | head -20 || true

echo
echo "=== docker containers ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -25
