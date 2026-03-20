# Deploy semnalizare WebRTC pe VPS (wss://ws.diebel.ro)

Serverul WebSocket este **`align-app/server/call-signaling-server.mjs`** (proces Node separat de Next/Vercel).

## Ce face serverul (confirmat în cod)

| Cerință | Implementare |
|--------|----------------|
| Port | **`SIGNALING_PORT`** din env, implicit **4001** (`process.env.SIGNALING_PORT \|\| 4001`) |
| WebSocket | **`ws.WebSocketServer({ server, path: "/ws" })`** |
| Health | HTTP **`GET /health`** → **200** body **`ok`** |
| Autentificare | Query **`?token=`** la URL-ul WS; token HMAC verificat cu **`SIGNALING_TOKEN_SECRET`** sau **`NEXTAUTH_SECRET`** (min 16) |

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
