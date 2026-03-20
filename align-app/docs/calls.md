# Apeluri vocale / video DIEBEL (WebRTC + TURN self‑hosted)

Arhitectură: **P2P** în browser; **semnalizare** pe proces Node dedicat (`server/call-signaling-server.mjs`) cu **WSS** în spatele Caddy/Nginx; **TURN/STUN** cu **credențiale efemere** din `GET /api/call/ice-config`. Fără Twilio / Agora / Daily (cost per minut).

**ICE în cod:** `hooks/useWebRtcCall.ts` creează `new RTCPeerConnection({ iceServers })` unde `iceServers` provine din răspunsul API (URL-uri din `NEXT_PUBLIC_TURN_URLS` + username/credential efemere). **Nu** pune în client `username`/`credential` TURN fixe — ar fi vizibile în bundle și **nu** funcționează cu coturn `use-auth-secret` (user/time-based). Echivalentul „turn UDP/TCP + TURNS” din exemplele statice e acoperit de array-ul din env + credențialele emise de server.

**Operațiuni producție (pași în ordine, firewall, systemd, curl, QA):** → **[`docs/hetzner-production-playbook.md`](./hetzner-production-playbook.md)**  
**Șablon comentariu PR (demo, DNS, health, relay, long-call):** → **[`docs/pr-calls-signoff.md`](./pr-calls-signoff.md)**

---

## A) DNS

| Înregistrare | Valoare |
|--------------|---------|
| **A** `turn.diebel.ro` | IP public Hetzner (VPS) |
| **A** `ws.diebel.ro` (recomandat) | același IP — reverse proxy TLS → port semnalizare |

**Important:** nu continua cu **Let’s Encrypt / TLS** până **`nslookup turn.diebel.ro`** și **`nslookup ws.diebel.ro`** nu returnează corect IP-ul VPS (verifică și de pe o mașină externă).

**TODO până propagă DNS:** în `NEXT_PUBLIC_TURN_URLS` poți folosi temporar `stun:`/`turn:` cu **IP public** în loc de hostname. **TURNS pe 5349** necesită certificat care să corespundă hostname‑ului din URL — cu IP brut, folosește mai întâi **TURN UDP/TCP** sau obține cert pentru domeniu când e gata.

---

## B) TURN pe Hetzner (coturn, TLS)

1. Firewall: **3478/udp**, **3478/tcp**, **5349/tcp**, **49152–49999/udp** (relay).
2. `openssl rand -hex 32` → `static-auth-secret` în coturn = **`TURN_AUTH_SECRET`** în Vercel (același secret).
3. Certificat Let’s Encrypt pentru **`turn.diebel.ro`**.
4. `sudo bash turn/install-coturn.sh` (setează `PUBLIC_IP`, `TURN_AUTH_SECRET`, `TURN_DOMAIN`).

Exemplu linii esențiale (căile certificatelor adaptate):

```conf
listening-port=3478
tls-listening-port=5349
fingerprint
realm=diebel.ro
external-ip=<PUBLIC_IP>
no-loopback-peers
no-multicast-peers
use-auth-secret
static-auth-secret=<SECRET_RANDOM_32B+>
total-quota=0
no-tlsv1
no-tlsv1_1
cert=/etc/letsencrypt/live/turn.diebel.ro/fullchain.pem
pkey=/etc/letsencrypt/live/turn.diebel.ro/privkey.pem
min-port=49152
max-port=49999
```

**systemd:** `systemctl enable --now coturn`. Health: `turnutils_uclient` sau `nc -uzv <IP> 3478` / `nc -zv <IP> 5349`.

---

## C) Semnalizare WebSocket

- **Prod:** `wss://ws.diebel.ro/ws?token=...` (token scurt de la `GET /api/call/signaling-token`, HMAC cu `SIGNALING_TOKEN_SECRET` sau `NEXTAUTH_SECRET` ≥ 16).
- **Dev:** `ws://127.0.0.1:4001` — clientul adaugă automat path `/ws` și query `token` (vezi `lib/webrtc/signaling.ts`).
- Evenimente: `join`, `session`, `offer`, `answer`, `ice`, `call-end`, `heartbeat` / `pong`. **Max 2** participanți / cameră.
- **Guard light:** limită conexiuni / IP, burst mesaje / 10s, dimensiune max. mesaj (vezi env în `server/call-signaling-server.mjs`).
- **Proxy:** trimite `X-Forwarded-For` pentru rate limiting corect.

Exemple reverse proxy: `turn/caddy-ws.example`, `turn/nginx-ws.example`. Service: `turn/call-signaling.service.example`.

---

## D) Variabile de mediu (Vercel Production & Preview + local)

Setează **identic** în **Production** și **Preview** pe Vercel (dacă vrei apeluri reale pe preview).

```env
NEXT_PUBLIC_SIGNALING_WS_URL="wss://ws.diebel.ro/ws"
NEXT_PUBLIC_TURN_URLS='["stun:turn.diebel.ro:3478","turn:turn.diebel.ro:3478?transport=udp","turns:turn.diebel.ro:5349?transport=tcp"]'
TURN_AUTH_SECRET=<ACELAȘI_SECRET_CA_IN_COTURN_static-auth-secret>
SIGNALING_TOKEN_SECRET=<min 16; aliniat cu VPS .env.signaling sau omită și folosește NEXTAUTH_SECRET>
CALL_MAX_MINUTES=30
CALL_MAX_BITRATE_DESKTOP=2500000
CALL_MAX_BITRATE_MOBILE=1200000
NEXT_PUBLIC_FEATURE_SCREENSHARE=true
FEATURE_SCREENSHARE=true
```

Notă: `lib/webrtc/signaling.ts` evită dublarea path-ului `/ws` dacă URL-ul îl conține deja.

API (confirmare implementare — **nu loga secrete**):

- **`GET /api/call/ice-config`** — `iceServers` cu `username` / `credential` efemere, **`ttl`: 600** (10 min), fără `TURN_AUTH_SECRET` în JSON. Rate limit 120/min per user.
- **`GET /api/call/signaling-token`** — `token` HMAC, **`expiresInMs`: 600000** (10 min).

Validare: `lib/env/webrtcConfig.ts` (Zod).

---

## E) UI (CallUI) + integrare logică

- **`CallUI`** + **`useWebRtcCall`:** la intrarea în pagina de apel se deschide WS, se creează `RTCPeerConnection`, se atașează track-uri locale, rulează timer limită (`CALL_MAX_MINUTES`); **închidere** (`leave`) trimite `call-end`, închide PC, curăță WS și intervale.
- **Ring / incoming → accept** rămân în fluxul existent al aplicației (navigare la `/app/call/...`); nu e nevoie de modificări vizuale pentru sign-off.
- Controale: mute, cameră, **switchCamera** (≥2 camere), **toggleScreenShare** + restore la stop, fără schimbare de layout pentru butoanele de bază.

---

## F) Calitate media

- Audio: ecou, zgomot, AGC, 2 canale (`lib/webrtc/mediaConstraints.ts`).
- Video: 720p implicit; desktop lat poate cere 1080p (`innerWidth >= 1200`).
- Codecs: preferințe VP8 → H264 → VP9 (`lib/webrtc/connection.ts`).
- Bitrate: `RTCRtpSender.setParameters` + ENV desktop/mobile.

---

## G) Securitate

- Doar **WSS** în producție pentru semnalizare.
- Nu logăm SDP/ICE în clar în fluxurile user-facing; serverul de semnalizare nu loghează conținutul ofertelor.
- Validare utilizator pe rutele API; rate limit ring + ice-config + token semnalizare unde e cazul.

---

## H) Dev: „invalid response” / port

1. Folosește **`http://`** către Next dev, **nu** `https://localhost` — altfel „invalid response”.
2. Dacă **3000–3002** sunt ocupate, Next pornește pe **3003** etc. — deschide exact URL-ul din terminal.
3. Implicit: `npm run dev` → **`http://localhost:3005`** (port fix). Dacă vrei port auto: `npm run dev:auto`.
4. Oprește procese `node` vechi dacă portul rămâne blocat.

Semnalizare dev: `npm run signaling:dev` + `NEXT_PUBLIC_SIGNALING_WS_URL=ws://127.0.0.1:4001`.

---

## I) Testare (obligatoriu înainte de go-live)

- Browsere: Chrome, Edge, Firefox, Safari desktop; Chrome Android; Safari iOS.
- Rețele: WiFi, 4G/5G, CGNAT; **blochează UDP** (firewall client sau regulă de test) → verifică fallback **TURNS TCP/TLS :5349**.
- Apel lung ~20 min; `chrome://webrtc-internals` sau `getStats` — bitrate, jitter, packet loss.
- Controale: mute, cameră, schimbare cameră, ecran (dacă activ), timer, reconectare după pierdere rețea.

---

## J) Runbook demo (înregistrare scurtă)

1. Două browsere/profiluri autentificate, apel 1-la-1 din chat — video P2P.
2. Repetă cu **UDP blocat** către `turn.diebel.ro:3478` — apelul ar trebui să treacă pe **TURNS**.

---

## READY FOR PROD — checklist

- [ ] DNS **A** `turn.diebel.ro` + `ws.diebel.ro` → Hetzner; TLS **după** `nslookup` OK
- [ ] Firewall Hetzner Cloud + `ufw`: 80, 443, 3478 udp/tcp, 5349 tcp, 49152–49999 udp
- [ ] coturn: TLS valid pe 5349, `external-ip` corect, log fără verbose
- [ ] `TURN_AUTH_SECRET` identic Vercel ↔ coturn; **niciodată** în client
- [ ] Semnalizare: systemd `Restart=always`, proxy WSS → `127.0.0.1:4001/ws`, `/health` OK
- [ ] Vercel: variabile secțiunea D (**Production + Preview**)
- [ ] API ice-config + signaling-token verificate (fără logare secrete)
- [ ] QA: browsere + rețele + UDP blocat → **relay** + long-call ~20 min
- [ ] PR: lipește semnarea din **`docs/pr-calls-signoff.md`** + link demo video

---

## Known issues

- **Vercel** nu poate găzdui WS persistent — semnalizarea rămâne pe VPS.
- **Conferință multi-participant** (`align-conf-*`): necesită SFU — mesaj explicit în UI.
- **Jitsi** (`lib/useJitsiRoom.ts`): legacy, nefolosit de `CallUI`.
