#!/usr/bin/env bash
set +e

echo "=== SOA / zone serial (last DNS zone edit hint) ==="
dig diebel.ro SOA @hydrogen.ns.hetzner.com +short

echo
echo "=== all public records we can see under diebel.ro ==="
dig diebel.ro ANY @hydrogen.ns.hetzner.com +noall +answer
echo "--- A ---"
for name in @ www mail chat play panel conta it ws turn anunturi autobook salvora transfer; do
  if [[ "$name" == "@" ]]; then
    fqdn=diebel.ro
  else
    fqdn=${name}.diebel.ro
  fi
  a=$(dig +short "$fqdn" A @hydrogen.ns.hetzner.com | tr '\n' ' ')
  c=$(dig +short "$fqdn" CNAME @hydrogen.ns.hetzner.com | tr '\n' ' ')
  echo "$fqdn | A=$a | CNAME=$c"
done

echo
echo "=== certbot renewal config for diebel.ro ==="
cat /etc/letsencrypt/renewal/diebel.ro.conf 2>/dev/null

echo
echo "=== archive cert history (when SANs changed) ==="
ls -lt /etc/letsencrypt/archive/diebel.ro/ 2>/dev/null | head -30
for f in /etc/letsencrypt/archive/diebel.ro/fullchain*.pem; do
  [[ -f "$f" ]] || continue
  echo "---- $f ----"
  openssl x509 -in "$f" -noout -dates -ext subjectAltName 2>/dev/null | head -10
done

echo
echo "=== nginx access hits for Host www (recent logs) ==="
for f in /var/log/nginx/access.log /var/log/nginx/diebel*.log /var/log/nginx/*diebel*; do
  [[ -e "$f" ]] || continue
  echo "-- $f --"
  if [[ "$f" == *.gz ]]; then
    zgrep -h 'www.diebel.ro' "$f" 2>/dev/null | tail -3
  else
    grep -h 'www.diebel.ro' "$f" 2>/dev/null | tail -3
  fi
done

echo
echo "=== when was nginx diebel.ro config last modified ==="
ls -la /etc/nginx/sites-enabled/diebel.ro /etc/nginx/sites-available/diebel.ro 2>/dev/null
stat /etc/nginx/sites-enabled/diebel.ro 2>/dev/null | grep -E Modify\|Change || true

echo
echo "=== certbot logs mentioning www.diebel ==="
grep -h 'www.diebel.ro' /var/log/letsencrypt/letsencrypt.log 2>/dev/null | tail -40
ls -lt /var/log/letsencrypt/ | head -15
