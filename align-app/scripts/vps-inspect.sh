#!/usr/bin/env bash
set -u

echo "=== call-signaling.service ==="
systemctl cat call-signaling.service 2>/dev/null | grep -iE 'ExecStart|EnvironmentFile|WorkingDirectory|^Environment=' || echo "no unit"

echo "=== fisiere env candidate ==="
for f in /root/Aplicatie-Chat/align-app/.env.signaling /root/.env.signaling /etc/diebel/signaling.env /root/diebel-signaling/.env; do
  if [ -f "$f" ]; then
    echo "FOUND $f"
    grep -oE '^(SIGNALING_TOKEN_SECRET|NEXTAUTH_SECRET|SIGNALING_ALLOWED_ORIGINS|SIGNALING_PORT)=' "$f"
  fi
done

echo "=== porturi 3000-3004 ==="
for p in 3000 3001 3002 3003 3004; do
  if ss -ltnH "sport = :$p" | grep -q ":$p"; then
    echo "$p OCUPAT"
  else
    echo "$p liber"
  fi
done

echo "=== DNS chat.diebel.ro (de pe VPS) ==="
getent hosts chat.diebel.ro || echo "fara rezolutie"
