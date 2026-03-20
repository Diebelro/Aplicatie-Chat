#!/usr/bin/env bash
# Pregătește semnalizarea WebRTC pe Ubuntu VPS (fără acces la mașina ta din Cursor).
# Utilizare:
#   cd /srv/aplicatie-chat/align-app   # sau calea ta
#   bash scripts/install-signaling-vps.sh
#
# Opțional: cale explicită
#   bash scripts/install-signaling-vps.sh /srv/aplicatie-chat/align-app
#
# După script: editezi .env.signaling, apoi cu sudo:
#   bash scripts/install-signaling-vps.sh /cale/align-app --install-systemd

set -euo pipefail

INSTALL_SD=0
ROOT=""
for arg in "$@"; do
  if [[ "$arg" == "--install-systemd" ]]; then
    INSTALL_SD=1
    continue
  fi
  ROOT="$arg"
done
ROOT="${ROOT:-$(pwd)}"

if [[ ! -f "$ROOT/server/call-signaling-server.mjs" ]]; then
  echo "Eroare: nu găsesc $ROOT/server/call-signaling-server.mjs"
  echo "Rulează din folderul align-app sau: bash scripts/install-signaling-vps.sh /cale/către/align-app"
  exit 1
fi

cd "$ROOT"
echo "==> Director: $ROOT"

echo "==> npm ci --omit=dev"
npm ci --omit=dev

if [[ ! -f .env.signaling ]]; then
  if [[ -f .env.signaling.example ]]; then
    cp .env.signaling.example .env.signaling
    chmod 600 .env.signaling
    echo ""
    echo ">>> Am creat .env.signaling — EDITEAZĂ secretul (min 16), același ca pe Vercel:"
    echo "    nano $ROOT/.env.signaling"
    echo ""
    if [[ "$INSTALL_SD" -eq 1 ]]; then
      echo ">>> Oprește: completează .env.signaling, apoi rulează din nou cu --install-systemd"
      exit 1
    fi
  else
    echo "Lipsește .env.signaling.example — creează manual .env.signaling cu SIGNALING_TOKEN_SECRET="
    exit 1
  fi
fi

# Verificare minimă: fișierul să nu conțină placeholder-ul din exemplu
if grep -q 'schimbă-mă-minim-16' .env.signaling 2>/dev/null; then
  echo ">>> Încă ai placeholder în .env.signaling — editează înainte de systemd:"
  echo "    nano $ROOT/.env.signaling"
  if [[ "$INSTALL_SD" -eq 1 ]]; then
    exit 1
  fi
fi

if [[ "$INSTALL_SD" -eq 0 ]]; then
  echo ""
  echo "==> Gata pregătirea. Test manual (foreground):"
  echo "    set -a && source .env.signaling && set +a && export NODE_ENV=production SIGNALING_PORT=4001"
  echo "    node server/call-signaling-server.mjs"
  echo "  (alt terminal) curl -sS http://127.0.0.1:4001/health   # așteptat: ok"
  echo ""
  echo "==> Instalare systemd + pornire (necesită sudo):"
  echo "    bash scripts/install-signaling-vps.sh \"$ROOT\" --install-systemd"
  exit 0
fi

echo "==> Instalez unit systemd (sudo)…"
TMP_UNIT=$(mktemp)
sed -e "s|^WorkingDirectory=.*|WorkingDirectory=$ROOT|" \
    -e "s|^EnvironmentFile=-.*|EnvironmentFile=-$ROOT/.env.signaling|" \
    "$ROOT/turn/call-signaling.service.example" > "$TMP_UNIT"

sudo cp "$TMP_UNIT" /etc/systemd/system/call-signaling.service
rm -f "$TMP_UNIT"

echo "==> Drepturi www-data pe $ROOT (citește cod + node_modules)…"
sudo chown -R www-data:www-data "$ROOT"

sudo systemctl daemon-reload
sudo systemctl enable call-signaling
sudo systemctl restart call-signaling

sleep 1
if curl -sS http://127.0.0.1:4001/health | grep -q ok; then
  echo "==> OK: http://127.0.0.1:4001/health răspunde"
else
  echo ">>> Verifică serviciul: sudo systemctl status call-signaling --no-pager"
  echo ">>> Log: journalctl -u call-signaling -n 40 --no-pager"
  exit 1
fi

echo ""
echo "==> Următorul pas: Nginx pentru https://ws.diebel.ro/health (vezi docs/VPS-signaling-COPY-PASTE.md)"
echo "    sudo nginx -t && sudo systemctl reload nginx"
