#!/usr/bin/env bash
set -u

echo "=== container 3002 ==="
docker compose -f /root/Aplicatie-Chat/align-app/docker-compose.yml ps 2>/dev/null || true
curl -s -o /dev/null -w 'local 3002 /api/health: %{http_code}\n' http://127.0.0.1:3002/api/health || true

echo "=== fisiere SSL incluse ==="
ls -la /etc/letsencrypt/options-ssl-nginx.conf /etc/letsencrypt/ssl-dhparams.pem 2>&1

echo "=== cert/key match (md5 modulus) ==="
echo -n "cert: "; openssl x509 -noout -modulus -in /etc/letsencrypt/live/chat.diebel.ro/fullchain.pem 2>/dev/null | openssl md5
echo -n "key : "; openssl pkey -noout -modulus -in /etc/letsencrypt/live/chat.diebel.ro/privkey.pem 2>/dev/null | openssl md5 || openssl rsa -noout -modulus -in /etc/letsencrypt/live/chat.diebel.ro/privkey.pem 2>/dev/null | openssl md5

echo "=== handshake SNI chat.diebel.ro ==="
echo | timeout 8 openssl s_client -connect 127.0.0.1:443 -servername chat.diebel.ro 2>&1 | grep -iE 'subject=|issuer=|verify return|alert|Cipher is|Protocol' | head

echo "=== handshake SNI ws.diebel.ro (comparatie) ==="
echo | timeout 8 openssl s_client -connect 127.0.0.1:443 -servername ws.diebel.ro 2>&1 | grep -iE 'subject=|verify return|alert|Cipher is' | head

echo "=== default_server 443 ==="
grep -rnE 'listen.*443.*default_server' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || echo "niciun default_server pe 443"

echo "=== blocuri server 443 + server_name (toate) ==="
grep -rnE 'server_name|listen.*443|ssl_certificate ' /etc/nginx/sites-enabled/ 2>/dev/null | grep -vE '#' | sort
