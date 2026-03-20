# Playbook: Voice/Video în producție (Hetzner + Vercel)

Self-hosted: **coturn** (TURN/TLS) + **Node signaling** (`server/call-signaling-server.mjs`) + **Next.js** pe Vercel. Fără servicii per minut.

**Ordinea recomandată:** **A DNS** (verificat cu `nslookup`) → **C Firewall** (minim **80/443** + SSH pentru ACME) → **B TLS** (Let’s Encrypt `ws` + `turn`) → **D Coturn** → **E Signaling** → **F ENV Vercel** → **G–I** QA și PR.

---

## A) DNS — nu continua cu TLS până nu e OK

1. La registrar / DNS (ex. Cloudflare, Hetzner DNS), creează **A records**:

   | Host | Tip | Valoare |
   |------|-----|---------|
   | `turn.diebel.ro` | A | IP public VPS Hetzner |
   | `ws.diebel.ro` | A | același IP |

2. Verifică de pe o mașină externă (nu doar de pe server):

   ```bash
   nslookup turn.diebel.ro
   nslookup ws.diebel.ro
   ```

   Ambele trebuie să returneze **IP-ul public** al VPS-ului. Dacă nu, **nu** rula certbot încă (Let’s Encrypt HTTP-01 / TLS-SNI eșuează sau vei obține cert greșit).

---

## B) TLS + reverse proxy (după DNS; porturile 80/443 trebuie deja deschise — vezi C)

### Certificat `ws.diebel.ro` (proxy)

- Cu **Caddy**: pornește serviciul doar după ce DNS indică VPS; Caddy obține cert automat.
- Cu **Nginx + certbot**: `certbot certonly --nginx -d ws.diebel.ro` (sau standalone pe :80).

Adaptă din repo:

- `turn/caddy-ws.example`
- `turn/nginx-ws.example`

**Țintă:** clientul se conectează la `wss://ws.diebel.ro/ws` → proxy → `http://127.0.0.1:4001/ws` (proces Node signaling).

Asigură **`X-Forwarded-For`** (vezi exemplul Nginx) pentru limitarea conexiunilor pe IP în `call-signaling-server.mjs`.

### Certificat `turn.diebel.ro` (coturn)

```bash
sudo certbot certonly --standalone -d turn.diebel.ro
# sau nginx plugin dacă expui temporar un vhost pe 80
```

Căi așteptate:

- `/etc/letsencrypt/live/turn.diebel.ro/fullchain.pem`
- `/etc/letsencrypt/live/turn.diebel.ro/privkey.pem`

**Renewal:** hook post-renew pentru **restart coturn** (certificat reîncărcat).

---

## C) Firewall pe Hetzner

### Hetzner Cloud Firewall (panou)

Permite:

- **TCP 22** — SSH (sau doar IP-uri de încredere)
- **TCP 80, 443** — ACME + reverse proxy (Caddy/Nginx)
- **UDP 3478**, **TCP 3478** — STUN/TURN
- **TCP 5349** — TURNS (TLS)
- **UDP 49152–49999** — relay coturn

### Pe VPS (Ubuntu) — exemplu `ufw`

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP ACME'
sudo ufw allow 443/tcp comment 'HTTPS WSS'
sudo ufw allow 3478/udp comment 'STUN/TURN'
sudo ufw allow 3478/tcp comment 'TURN TCP'
sudo ufw allow 5349/tcp comment 'TURNS TLS'
sudo ufw allow 49152:49999/udp comment 'TURN relay'
sudo ufw enable
sudo ufw status verbose
```

Documentează în PR output-ul `ufw status verbose` (fără IP-uri sensibile dacă politica echipei cere).

---

## D) Coturn (TURN + TLS + secret efemer)

1. Generează secret (hex 32+ bytes):

   ```bash
   openssl rand -hex 32
   ```

   Același valoare în:

   - `/etc/turnserver.conf` → `static-auth-secret=...`
   - Vercel → `TURN_AUTH_SECRET`

2. Rulează / finalizează cu `turn/install-coturn.sh`:

   ```bash
   export PUBLIC_IP=<IP_PUBLIC_HETZNER>
   export TURN_AUTH_SECRET=<secretul_generat>
   export TURN_DOMAIN=turn.diebel.ro
   sudo -E bash turn/install-coturn.sh
   ```

3. Confirmă în `/etc/turnserver.conf` liniile din specificația ta (inclusiv `cert` / `pkey` Let’s Encrypt).

4. **Log:** păstrează `no-stdout-log` + `log-file` ca în script; **nu** activa mod verbose în producție (WARN/ERROR prin fișier/syslog).

5. **systemd:**

   ```bash
   sudo systemctl enable coturn
   sudo systemctl restart coturn
   sudo systemctl status coturn
   ```

6. **Healthcheck minimal:**

   ```bash
   # UDP STUN port deschis (exemplu)
   nc -uzv turn.diebel.ro 3478
   # TLS TURN
   nc -zv turn.diebel.ro 5349
   ```

   Opțional: `turnutils_uclient` cu credențiale efemere generate de app (vezi API ice-config).

---

## E) Semnalizare WebSocket (producție)

1. Deploy cod pe VPS (ex. `/opt/align-app`) sau minim: `server/call-signaling-server.mjs` + `node_modules/ws`.

2. Creează `/opt/align-app/.env.signaling` (permisiuni restrictive `600`):

   ```env
   NODE_ENV=production
   SIGNALING_TOKEN_SECRET=<min 16; același flux ca NEXTAUTH_SECRET sau secret dedicat>
   SIGNALING_PORT=4001
   SIGNALING_MAX_CONN_PER_IP=40
   SIGNALING_MSG_BURST_PER_10S=100
   SIGNALING_MAX_MSG_BYTES=65536
   SIGNALING_HEARTBEAT_TTL_MS=75000
   ```

3. Copiază unitatea din `turn/call-signaling.service.example` în `/etc/systemd/system/call-signaling.service`, ajustează `User` / `WorkingDirectory` / `ExecStart`.

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable call-signaling
   sudo systemctl start call-signaling
   sudo systemctl status call-signaling
   ```

4. Local (fără TLS): `curl -s http://127.0.0.1:4001/health` → `ok`.

5. După proxy TLS:

   ```bash
   curl -I "https://ws.diebel.ro/health?ping=1"
   ```

   Aștepți **200** și body `ok` la GET (head poate fi limitat de proxy — folosește `curl -s` GET complet în semnarea PR).

---

## F) ENV aplicație — Vercel (Production **și** Preview)

Setează **aceleași** chei în ambele medii (sau Preview cu același stack dacă testezi apeluri reale):

```env
NEXT_PUBLIC_SIGNALING_WS_URL="wss://ws.diebel.ro/ws"
NEXT_PUBLIC_TURN_URLS='["stun:turn.diebel.ro:3478","turn:turn.diebel.ro:3478?transport=udp","turns:turn.diebel.ro:5349?transport=tcp"]'
TURN_AUTH_SECRET=<ACELAȘI_SECRET_CA_IN_COTURN>
SIGNALING_TOKEN_SECRET=<min 16; aliniat cu .env.signaling>
CALL_MAX_MINUTES=30
CALL_MAX_BITRATE_DESKTOP=2500000
CALL_MAX_BITRATE_MOBILE=1200000
NEXT_PUBLIC_FEATURE_SCREENSHARE=true
FEATURE_SCREENSHARE=true
```

Plus `NEXTAUTH_SECRET` (dacă folosești fallback la token semnalizare).

### Confirmare API (fără a loga secrete)

- **`GET /api/call/ice-config`** (header `x-user-id` valid, sesiune/auth ca în app):

  - Răspuns: `iceServers[0].urls` (array), `username`, `credential`, `ttl` (**600** sec = 10 min).
  - **Nu** apare `TURN_AUTH_SECRET`.

- **`GET /api/call/signaling-token`**:

  - Răspuns: `token`, `expiresInMs` (**600000** = 10 min).

Implementare: `app/api/call/ice-config/route.ts`, `app/api/call/signaling-token/route.ts`, `lib/webrtc/turnCredentials.ts`, `lib/signalingToken.ts`.

---

## G) Integrare cod (deja în repo)

- **`hooks/useWebRtcCall.ts`:** WS + `RTCPeerConnection`, track-uri locale, timer limită, mute/cameră, `switchCamera`, `toggleScreenShare` + restore, ICE restart cu **o singură** `createOffer({ iceRestart: true })`, `getStats` pentru banner.
- **`components/CallUI.tsx`:** consumă hook-ul; flux ring → pagină apel rămâne în paginile existente (`startCall` / navigare).
- Constrângeri audio/video și codec: `lib/webrtc/mediaConstraints.ts`, `lib/webrtc/connection.ts`.

Nu e nevoie de schimbări vizuale suplimentare pentru sign-off.

---

## H) QA obligatoriu — documentează în PR

Completează tabelul (Da/Nu + notițe) în descrierea PR sau `docs/pr-calls-signoff.md`.

| # | Test | Rezultat |
|---|------|----------|
| 1 | Chrome, Edge, Firefox, Safari desktop | |
| 2 | Chrome Android, Safari iOS | |
| 3 | WiFi / 4G·5G / CGNAT | |
| 4 | UDP blocat către TURN → candidați **relay** + audio/video OK (webrtc-internals) | |
| 5 | Long call ~20 min, bitrate/jitter/packet-loss acceptabile | |
| 6 | Mute, cameră, switch, ecran, end, timer, reconectare după fail | |
| 7 | Dev local: `http://localhost:3005` (`npm run dev`) sau `npm run dev:auto` | |

---

## I) Livrabile PR (operator)

- [ ] Link **demo video** (2 browsere + clip UDP blocat / TURNS)
- [ ] Confirmare **DNS** (screenshot `nslookup` sau text)
- [ ] Confirmare **TLS** activ (`turn` + `ws`)
- [ ] Output `curl -s -o /dev/null -w "%{http_code}" "https://ws.diebel.ro/health?ping=1"` (așteptat `200`) + opțional body `ok`
- [ ] Confirmare candidați **relay** la test UDP blocat
- [ ] Confirmare **long-call** OK

Șablon scurt: vezi **`docs/pr-calls-signoff.md`**.
