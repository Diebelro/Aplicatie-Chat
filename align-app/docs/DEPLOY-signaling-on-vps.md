# Deploy semnalizare WebRTC pe VPS (wss://ws.diebel.ro)

**Copy-paste rapid (SSH):** [VPS-signaling-COPY-PASTE.md](./VPS-signaling-COPY-PASTE.md) · script: `align-app/scripts/install-signaling-vps.sh`

Serverul WebSocket este **`align-app/server/call-signaling-server.mjs`** (proces Node separat de Next/Vercel).

## Ce face serverul (confirmat în cod)

| Cerință | Implementare |
|--------|----------------|
| Port | **`SIGNALING_PORT`** din env, implicit **4001** (`process.env.SIGNALING_PORT \|\| 4001`) |
| WebSocket | **`ws.WebSocketServer({ server, path: "/ws" })`** |
| Health | HTTP **`GET /health`** → **200** body **`ok`** |
| Autentificare | Query **`?token=`** la URL-ul WS; token HMAC verificat cu **`SIGNALING_TOKEN_SECRET`** sau **`NEXTAUTH_SECRET`** (min 16) |
| Origine (prod) | Opțional **`SIGNALING_ALLOWED_ORIGINS`**: lista de **`Origin`** acceptate la handshake (ex. `https://chat.diebel.ro`). Gol = orice Origin (implicit). Vezi mai jos. |

**Variabile:** `SIGNALING_TOKEN_SECRET` (sau `NEXTAUTH_SECRET`) sunt **obligatorii** pentru serverul WS.  
**`TURN_AUTH_SECRET`** este pentru **Next.js** (API-uri precum `/api/call/signaling-token`, ice/TURN) — **nu** este citit de `call-signaling-server.mjs`; păstrează-l **identic între Vercel și secretele API**, nu neapărat în `.env.signaling`.

---

## 1) Pregătire cod pe VPS

```bash
sudo mkdir -p /srv/aplicatie-chat
sudo chown $USER:$USER /srv/aplicatie-chat
cd /srv/aplicatie-chat
git clone https://github.com/Diebelro/Aplicatie-Chat.git .
cd align-app
npm ci --omit=dev
```

*(Dacă repo-ul e privat, folosește SSH key sau token.)*

Minim necesar pentru serviciu: tot `align-app` (există `server/call-signaling-server.mjs` și dependența **`ws`** din `package.json`).

---

## 2) Secrete locale (semnalizare)

```bash
nano /srv/aplicatie-chat/align-app/.env.signaling
```

Conținut minim:

```env
SIGNALING_TOKEN_SECRET=acelasi_secret_ca_in_vercel_sau_nextauth_min_16
```

Opțional același `NEXTAUTH_SECRET` ca în Vercel, dacă nu folosești `SIGNALING_TOKEN_SECRET` separat.

**Origine WebSocket în producție:** browserul trimite header **`Origin`** egal cu **URL-ul paginii** (ex. `https://chat.diebel.ro`), nu cu `wss://ws.diebel.ro`. Dacă activezi allowlist-ul, include **toate** URL-urile de unde se deschide app-ul (www și non-www separate; preview Vercel dacă testezi apeluri de acolo):

```env
# opțional — virgulă, fără spații obligatorii (sau cu spații la margini, sunt tăiate)
SIGNALING_ALLOWED_ORIGINS=https://chat.diebel.ro,https://www.chat.diebel.ro
# opțional, doar cu allowlist: respinge handshake fără Origin (nu folosi dacă același WS e folosit de app nativă fără Origin)
# SIGNALING_REQUIRE_BROWSER_ORIGIN=1
```

După `systemctl restart call-signaling`, în log ar trebui să vezi fie lista de origini, fie mesajul că nu există restricție. Dacă apelul pică imediat după ce ai setat allowlist-ul, verifică că **exact** `Origin`-ul din DevTools (Network → WS → Request Headers) apare în listă.

```bash
chmod 640 /srv/aplicatie-chat/align-app/.env.signaling
# dacă rulezi cu User=www-data: chown root:www-data .env.signaling
```

---

## 3) Systemd

```bash
sudo cp /srv/aplicatie-chat/align-app/turn/call-signaling.service.example /etc/systemd/system/call-signaling.service
sudo nano /etc/systemd/system/call-signaling.service
sudo systemctl daemon-reload
sudo systemctl enable --now call-signaling
sudo systemctl status call-signaling --no-pager
```

Verifică loguri: `journalctl -u call-signaling -f`

---

## 4) Nginx (TLS + proxy WSS)

1. Certificat Let’s Encrypt pentru **`ws.diebel.ro`** (certbot nginx sau standalone).
2. Copiază exemplul:

```bash
sudo cp /srv/aplicatie-chat/align-app/turn/nginx-ws.diebel.ro.conf.example /etc/nginx/sites-available/ws.diebel.ro.conf
sudo ln -sf /etc/nginx/sites-available/ws.diebel.ro.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Căi certificat în exemplu:

- `/etc/letsencrypt/live/ws.diebel.ro/fullchain.pem`
- `/etc/letsencrypt/live/ws.diebel.ro/privkey.pem`

---

## 5) Verificări

**Health (pe server):**

```bash
curl -sS http://127.0.0.1:4001/health
# așteptat: ok
```

**Health prin Nginx:**

```bash
curl -sS https://ws.diebel.ro/health
# așteptat: ok
```

**WSS:** din browser sau `wscat` — URL-ul clientului este baza din **`NEXT_PUBLIC_SIGNALING_WS_URL`** + path **`/ws`** + **`?token=`** (vezi `lib/webrtc/signaling.ts` → `signalingWsConnectUrl`).  
Exemplu Vercel: `NEXT_PUBLIC_SIGNALING_WS_URL=wss://ws.diebel.ro` (fără `/ws` în env e OK; clientul adaugă `/ws`).

---

## 6) Variabile în Vercel (client + API Next)

| Variabilă | Rol |
|-----------|-----|
| **`NEXT_PUBLIC_SIGNALING_WS_URL`** | Ex. `wss://ws.diebel.ro` — baza WS; la conectare se adaugă **`/ws`** + token (`signalingWsConnectUrl`). |
| **`NEXT_PUBLIC_TURN_URLS`** | JSON array STUN/TURN (public). |
| **`TURN_REALM`**, **`TURN_STATIC_SECRET`** | Folosite de **`GET /api/call/ice-config`** (TURN REST). |
| **`SIGNALING_TOKEN_SECRET`** și/sau **`NEXTAUTH_SECRET`**, **`TURN_AUTH_SECRET`** | Token semnalizare + validări API în Next; **aliniate** cu `.env.signaling` pentru tokenul WS. |

Getter în cod: **`getPublicSignalingWsBaseUrl()`** în `lib/env/webrtcConfig.ts` citește **`NEXT_PUBLIC_SIGNALING_WS_URL`**.

---

## 7) Test relay (TURN)

În Chrome: **`chrome://webrtc-internals`** în timpul apelului — caută candidați tip **`relay`** pentru a confirma TURN.
