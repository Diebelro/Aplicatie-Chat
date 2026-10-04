#!/usr/bin/env bash
set +e

echo "=== dig verbose www @8.8.8.8 ==="
dig www.diebel.ro @8.8.8.8 A +noall +answer +authority +additional
echo
echo "=== dig www @1.1.1.1 ==="
dig www.diebel.ro @1.1.1.1 A +noall +answer
echo
echo "=== dig NS ==="
dig diebel.ro NS +short
echo
echo "=== local resolv ==="
dig www.diebel.ro A +short
getent hosts www.diebel.ro
getent hosts diebel.ro

echo
echo "=== nginx diebel.ro ==="
cat /etc/nginx/sites-enabled/diebel.ro

echo
echo "=== certs live ==="
ls -la /etc/letsencrypt/live/ 2>/dev/null

echo
echo "=== SANs per cert ==="
for d in /etc/letsencrypt/live/*/; do
  echo "---- $d ----"
  openssl x509 -in "${d}fullchain.pem" -noout -subject -dates -ext subjectAltName 2>/dev/null | head -20
done

echo
echo "=== curl -k www via resolve ==="
curl -skI --max-time 10 --resolve www.diebel.ro:443:178.104.2.31 https://www.diebel.ro/ | head -25

echo
echo "=== certbot certificates ==="
certbot certificates 2>/dev/null | head -80
