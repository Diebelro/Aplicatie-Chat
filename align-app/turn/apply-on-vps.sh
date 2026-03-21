#!/usr/bin/env bash
# Rulează PE VPS, din folderul unde ai fișierele din repo (ex. /root sau .../align-app/turn):
#   sudo bash apply-on-vps.sh
#
# Opțional: instalează și unit systemd pentru semnalizare (verifică WorkingDirectory în fișier!)
#   sudo INSTALL_SYSTEMD=1 bash apply-on-vps.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Folosește: sudo bash $0"
  exit 1
fi

TURN_SRC="$SCRIPT_DIR/nginx-turn.diebel.ro.conf"
WS_SRC="$SCRIPT_DIR/nginx-ws.diebel.ro.conf.example"

if [[ ! -f "$TURN_SRC" ]]; then
  echo "Lipsește: $TURN_SRC"
  exit 1
fi
if [[ ! -f "$WS_SRC" ]]; then
  echo "Lipsește: $WS_SRC (config corect ws.diebel.ro → 4001 + /ws)"
  exit 1
fi

echo "== Nginx: ws.diebel.ro — folosesc EXEMPLUL corect (proxy 4001), NU nginx-ws.diebel.ro.conf vechi (3000)."

# Evită dubluri server_name (vezi docs/VPS-nginx-ws-conflict-FIX.md)
rm -f /etc/nginx/sites-enabled/ws.diebel.ro.conf
rm -f /etc/nginx/sites-enabled/nginx-ws.diebel.ro.conf
rm -f /etc/nginx/sites-enabled/ws.diebel.ro
rm -f /etc/nginx/sites-enabled/turn.diebel.ro

install -d /etc/nginx/sites-available

cp "$TURN_SRC" /etc/nginx/sites-available/turn.diebel.ro
cp "$WS_SRC" /etc/nginx/sites-available/ws.diebel.ro.conf

ln -sf /etc/nginx/sites-available/turn.diebel.ro /etc/nginx/sites-enabled/turn.diebel.ro
ln -sf /etc/nginx/sites-available/ws.diebel.ro.conf /etc/nginx/sites-enabled/ws.diebel.ro.conf

nginx -t
systemctl reload nginx

echo "OK: Nginx — turn.diebel.ro + ws.diebel.ro.conf (→ 127.0.0.1:4001 pentru /health și /ws)."

if [[ "${INSTALL_SYSTEMD:-}" == "1" ]]; then
  SVC_SRC=""
  if [[ -f "$SCRIPT_DIR/call-signaling.service" ]]; then
    SVC_SRC="$SCRIPT_DIR/call-signaling.service"
  elif [[ -f "$SCRIPT_DIR/call-signaling.service.example" ]]; then
    SVC_SRC="$SCRIPT_DIR/call-signaling.service.example"
  fi
  if [[ -n "$SVC_SRC" ]]; then
    cp "$SVC_SRC" /etc/systemd/system/call-signaling.service
    systemctl daemon-reload
    systemctl enable call-signaling
    if systemctl start call-signaling; then
      echo "OK: call-signaling pornit."
    else
      echo "ATENȚIE: call-signaling nu a pornit. Verifică WorkingDirectory, node, .env.signaling: systemctl status call-signaling"
    fi
  else
    echo "Nu am găsit call-signaling.service / .example în $SCRIPT_DIR"
  fi
fi

echo ""
echo "Verificare rapidă (de pe VPS):"
echo "  curl -sS https://ws.diebel.ro/health"
echo "  curl -sI https://turn.diebel.ro/"
