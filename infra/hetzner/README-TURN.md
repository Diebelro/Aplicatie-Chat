# TURN (coturn) pe Hetzner — 178.104.2.31

## Important: nu folosi `diebel:parola123` în aplicație

Diebel **deja** trimite credențiale TURN corecte din backend (`/api/call/ice-config`):

- `TURN_REALM` = `turn.diebel.ro` (nu `diebel.ro`)
- `TURN_STATIC_SECRET` = același string ca `static-auth-secret` în coturn
- Username: `expiry:userId`
- Credential: `base64(HMAC-SHA1(secret, username))`

Dacă pui `user=diebel:parola123` în coturn **fără** să schimbi aplicația, apelurile **nu** vor autentifica la TURN.

## Instalare rapidă (pe server, SSH)

```bash
ssh root@178.104.2.31

# Copiază TURN_STATIC_SECRET din Vercel (Production) — Settings → Environment Variables
export TURN_STATIC_SECRET='450623c03a2666bf3211674938e8a3080a2dcccb6ca891aed89aab3bd98453a3'

# Din repo (sau copiază scriptul manual):
bash /path/to/infra/hetzner/setup-coturn.sh
```

## Verificare

```bash
systemctl status coturn
ss -tulnp | grep 3478
tail -20 /var/log/turn.log
```

Port **3478** trebuie să fie `LISTEN` pe `0.0.0.0`.

## Firewall

### UFW (scriptul configurează)

- 3478 TCP + UDP
- 49152–49200 UDP

### Hetzner Cloud Firewall (panou web)

Dacă ai firewall în [Hetzner Console](https://console.hetzner.cloud), adaugă reguli inbound:

| Port | Protocol |
|------|----------|
| 3478 | TCP, UDP |
| 49152–49200 | UDP |

Fără asta, portul poate fi deschis pe VPS dar blocat în cloud.

## Config final WebRTC (aplicația — deja setat)

**Nu schimba codul.** Clientul primește automat de la API:

```json
{
  "iceServers": [{
    "urls": [
      "turn:turn.diebel.ro:3478?transport=udp",
      "turn:turn.diebel.ro:3478?transport=tcp"
    ],
    "username": "1730000000:userId",
    "credential": "<HMAC base64>"
  }],
  "realm": "turn.diebel.ro"
}
```

Variabile Vercel (deja configurate):

- `NEXT_PUBLIC_TURN_URLS`
- `TURN_REALM=turn.diebel.ro`
- `TURN_STATIC_SECRET=...` (identic cu coturn)

## Test manual (opțional)

```bash
EXPIRY=$(( $(date +%s) + 3600 ))
USER="${EXPIRY}:test"
CRED=$(printf '%s' "$USER" | openssl dgst -sha1 -hmac "$TURN_STATIC_SECRET" -binary | base64)
turnutils_uclient -v -t -u "$USER" -w "$CRED" -p 3478 178.104.2.31
```

## Docker vs systemd

| | Recomandare |
|---|-------------|
| **systemd (coturn apt)** | Da — simplu, stabil, restart automat, potrivit pentru un singur VPS |
| **Docker coturn** | Doar dacă tot stack-ul e deja în Docker; nu e necesar aici |

## Dacă vrei totuși user fix `diebel:parola123` (doar test)

În `/etc/turnserver.conf` (în loc de `use-auth-secret`):

```
lt-cred-mech
user=diebel:parola123
```

Atunci trebuie **și** schimbat backend-ul / env — contrazice cerința „nu modifica aplicația”. Folosește `static-auth-secret`.
