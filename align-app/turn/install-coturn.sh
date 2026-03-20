#!/usr/bin/env bash
# =============================================================================
# DIEBEL — instalare coturn pe Hetzner (Ubuntu 22.04+)
# Rulează cu sudo:  sudo bash turn/install-coturn.sh
#
# Înainte:
#   - DNS: turn.diebel.ro → IP public Hetzner (sau folosești doar IP: vezi TODO în turnserver.conf)
#   - Firewall: 3478/udp, 3478/tcp, 5349/tcp, 49152-49999/udp
#   - Generează static-auth-secret:  openssl rand -hex 32
# =============================================================================
set -euo pipefail

TURN_DOMAIN="${TURN_DOMAIN:-turn.diebel.ro}"
PUBLIC_IP="${PUBLIC_IP:?Setează PUBLIC_IP=1.2.3.4}"
AUTH_SECRET="${TURN_AUTH_SECRET:?Setează TURN_AUTH_SECRET (ex. openssl rand -hex 32)}"

apt-get update -y
apt-get install -y coturn certbot

# Pornește TLS după certbot (mai jos). Pentru început fără domeniu, comentează cert/pkey în conf.
if ! certbot certificates 2>/dev/null | grep -q "$TURN_DOMAIN"; then
  echo ">>> Rulează manual: certbot certonly --standalone -d $TURN_DOMAIN"
  echo ">>> Apoi rerulează acest script sau editează /etc/turnserver.conf cu căile Let's Encrypt."
fi

CONF=/etc/turnserver.conf
cp -a "$CONF" "${CONF}.bak.$(date +%s)" 2>/dev/null || true

cat > /etc/turnserver.conf << EOF
# DIEBEL coturn — log în fișier (minim pe stdout; nivel efectiv în syslog / fișier)
# Pentru mai puțin zgomot: evită \`verbose\` / \`stun-debug\`; păstrează doar erori/warn în producție.
no-stdout-log
log-file=/var/log/turnserver.log
simple-log

listening-port=3478
tls-listening-port=5349
fingerprint
realm=diebel.ro
external-ip=${PUBLIC_IP}
no-loopback-peers
no-multicast-peers
use-auth-secret
static-auth-secret=${AUTH_SECRET}
total-quota=0
no-tlsv1
no-tlsv1_1

# TODO: dacă încă nu ai DNS, comentează cert/pkey și folosește doar UDP/TCP fără TLS,
# sau setează certificat self-signed pentru teste.
cert=/etc/letsencrypt/live/${TURN_DOMAIN}/fullchain.pem
pkey=/etc/letsencrypt/live/${TURN_DOMAIN}/privkey.pem

# Relay ports
min-port=49152
max-port=49999

EOF

sed -i 's/^TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || \
  echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn

systemctl enable coturn
systemctl restart coturn
echo ">>> coturn activ. Test: turnutils_uclient -u user -w pass (sau din aplicație)."
echo ">>> Health HTTP: opțional pune nginx în față la /health pe alt port."
