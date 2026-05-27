#!/usr/bin/env bash
# Instalează și configurează coturn pe Hetzner (178.104.2.31)
# Compatibil cu Diebel: TURN_REALM + TURN_STATIC_SECRET (credențiale dinamice din /api/call/ice-config)
#
# Rulează pe server ca root:
#   curl -sL ... | bash
#   sau: bash setup-coturn.sh
#
# Înainte de rulare, setează secretul IDENTIC cu Vercel TURN_STATIC_SECRET:
export TURN_STATIC_SECRET="${TURN_STATIC_SECRET:-PUNE_ACELASI_SECRET_CA_PE_VERCEL}"

set -euo pipefail

PUBLIC_IP="${PUBLIC_IP:-178.104.2.31}"
TURN_REALM="${TURN_REALM:-turn.diebel.ro}"
TURN_HOST="${TURN_HOST:-turn.diebel.ro}"
LISTEN_PORT=3478
MIN_PORT=49152
MAX_PORT=49200

if [[ "$TURN_STATIC_SECRET" == "PUNE_ACELASI_SECRET_CA_PE_VERCEL" ]] || [[ -z "$TURN_STATIC_SECRET" ]]; then
  echo "EROARE: export TURN_STATIC_SECRET='...' (copiază din Vercel → TURN_STATIC_SECRET)"
  exit 1
fi

echo "==> Instalare coturn..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y coturn ufw

echo "==> /etc/default/coturn"
cat > /etc/default/coturn <<'DEFAULT'
# Coturn enabled for Diebel
TURNSERVER_ENABLED=1
DEFAULT

echo "==> /etc/turnserver.conf"
cat > /etc/turnserver.conf <<EOF
# Diebel TURN — minimal, compatibil cu align-app ice-config (HMAC time-limited credentials)
listening-port=${LISTEN_PORT}
listening-ip=0.0.0.0
external-ip=${PUBLIC_IP}
realm=${TURN_REALM}
server-name=${TURN_HOST}

# Autentificare: același mecanism ca TURN_STATIC_SECRET pe Vercel (NU user:pass fix în app)
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${TURN_STATIC_SECRET}

# Relay ports
min-port=${MIN_PORT}
max-port=${MAX_PORT}

# Fără TLS pe 5349 în setup minimal (app folosește turn: pe 3478)
no-tls
no-dtls

# Logging
log-file=/var/log/turn.log
verbose
EOF

chmod 640 /etc/turnserver.conf
touch /var/log/turn.log
chown turnserver:turnserver /var/log/turn.log 2>/dev/null || chown root:root /var/log/turn.log

echo "==> Firewall (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp comment 'SSH' || true
  ufw allow "${LISTEN_PORT}/tcp" comment 'TURN TCP' || true
  ufw allow "${LISTEN_PORT}/udp" comment 'TURN UDP' || true
  ufw allow "${MIN_PORT}:${MAX_PORT}/udp" comment 'TURN relay' || true
  # nu forțăm enable dacă e dezactivat intenționat
  ufw status verbose 2>/dev/null || true
fi

echo "==> Hetzner Cloud Firewall: deschide manual dacă folosești firewall în panou:"
echo "    ${LISTEN_PORT}/tcp+udp, ${MIN_PORT}-${MAX_PORT}/udp către ${PUBLIC_IP}"

echo "==> Pornire coturn"
systemctl daemon-reload
systemctl enable coturn
systemctl restart coturn
sleep 2

echo "==> Status"
systemctl status coturn --no-pager -l || true
echo ""
echo "==> Port 3478 (trebuie LISTEN):"
ss -tulnp | grep -E ":${LISTEN_PORT}\b" || { echo "EROARE: port ${LISTEN_PORT} nu ascultă"; exit 1; }

echo ""
echo "==> Test local TURN (generare credențială ca în app)"
EXPIRY=$(( $(date +%s) + 3600 ))
USER="${EXPIRY}:turn_test"
CRED=$(printf '%s' "$USER" | openssl dgst -sha1 -hmac "$TURN_STATIC_SECRET" -binary | base64)
if command -v turnutils_uclient >/dev/null 2>&1; then
  echo "turnutils_uclient -t -u \"$USER\" -w \"***\" ${TURN_HOST}"
  timeout 8 turnutils_uclient -v -t -u "$USER" -w "$CRED" -p "${LISTEN_PORT}" "${PUBLIC_IP}" 2>&1 | tail -5 || echo "(test uclient poate eșua din NAT; verifică portul deschis)"
fi

echo ""
echo "OK — coturn rulează."
echo "App Diebel (fără modificări): credențiale din GET /api/call/ice-config"
echo "  urls: turn:turn.diebel.ro:3478 (+ udp/tcp din NEXT_PUBLIC_TURN_URLS)"
echo "  realm: ${TURN_REALM}"
echo "  username/credential: generate automat (expiry:userId + HMAC-SHA1)"
