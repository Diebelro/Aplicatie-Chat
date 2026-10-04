#!/usr/bin/env bash
set -euo pipefail
IP=82.78.173.73
echo "=== geo ==="
curl -sS --max-time 8 "http://ip-api.com/json/${IP}?fields=status,country,city,isp,org,as,proxy,hosting,query"
echo
echo "=== login lines current log ==="
grep -F "$IP" /var/log/nginx/chat.diebel.ro.access.log | grep 'POST /api/auth/login' || true
echo "=== status counts ==="
grep -F "$IP" /var/log/nginx/chat.diebel.ro.access.log | grep 'POST /api/auth/login' | awk '{print $9}' | sort | uniq -c || true
echo "=== unique days/hours ==="
grep -F "$IP" /var/log/nginx/chat.diebel.ro.access.log | awk -F'[][]' '{print $2}' | cut -d: -f1-2 | sort -u || true
echo "=== rotated presence ==="
for f in /var/log/nginx/chat.diebel.ro.access.log*; do
  if [[ "$f" == *.gz ]]; then
    c=$(zgrep -cF "$IP" "$f" 2>/dev/null || echo 0)
  else
    c=$(grep -cF "$IP" "$f" 2>/dev/null || echo 0)
  fi
  echo "$f : $c"
done
