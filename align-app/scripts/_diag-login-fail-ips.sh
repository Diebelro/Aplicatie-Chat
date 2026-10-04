#!/usr/bin/env bash
set -euo pipefail
LOG=/var/log/nginx/chat.diebel.ro.access.log
echo "=== top IPs POST /api/auth/login non-2xx (access.log) ==="
grep 'POST /api/auth/login' "$LOG" 2>/dev/null \
  | awk '$9 ~ /^(401|403|404|429)$/ {print $1}' \
  | sort | uniq -c | sort -rn | head -20

echo
echo "=== search fragment 827817373 / 82.78 / 78.173 ==="
grep -E '82\.78\.|78\.173|827817373' "$LOG" 2>/dev/null | head -5 || true
grep 'POST /api/auth/login' "$LOG" 2>/dev/null | awk '{print $1}' | sort -u | grep -E '82\.78|78\.17' || true

echo
echo "=== detail for top failing IP ==="
TOP=$(grep 'POST /api/auth/login' "$LOG" 2>/dev/null \
  | awk '$9 ~ /^(401|403|404|429)$/ {print $1}' \
  | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
echo "TOP=$TOP"
if [[ -n "${TOP:-}" ]]; then
  echo "--- login status counts ---"
  grep -F "$TOP" "$LOG" | grep 'POST /api/auth/login' | awk '{print $9}' | sort | uniq -c | sort -rn
  echo "--- sample UA ---"
  grep -F "$TOP" "$LOG" | grep 'POST /api/auth/login' | head -3
  echo "--- first/last ---"
  grep -F "$TOP" "$LOG" | head -1
  grep -F "$TOP" "$LOG" | tail -1
  echo "--- geo ---"
  curl -sS --max-time 8 "http://ip-api.com/json/${TOP}?fields=status,country,city,isp,org,as,proxy,hosting,query" || true
  echo
fi

echo
echo "=== also check rotated logs for login fails ==="
for f in /var/log/nginx/chat.diebel.ro.access.log*; do
  echo "-- $f --"
  if [[ "$f" == *.gz ]]; then
    zgrep 'POST /api/auth/login' "$f" 2>/dev/null | awk '$9 ~ /^(401|403|404|429)$/ {print $1}' | sort | uniq -c | sort -rn | head -5 || true
  else
    grep 'POST /api/auth/login' "$f" 2>/dev/null | awk '$9 ~ /^(401|403|404|429)$/ {print $1}' | sort | uniq -c | sort -rn | head -5 || true
  fi
done
