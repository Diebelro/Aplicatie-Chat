# WebRTC semnalizare + variabile Vercel (scurt)

## Arhitectură

- **TURN / ICE:** REST în Next — `GET /api/call/ice-config` (credențiale efemere, `use-auth-secret` / HMAC) — **neschimbat**.
- **Semnalizare (offer / answer / ICE candidates):** proces Node separat — `server/call-signaling-server.mjs`, WebSocket pe path **`/ws`** + `?token=`.

Pe **Vercel** (serverless) **nu** există WebSocket persistent pentru apeluri; `GET /api/ws` returnează doar JSON explicativ.

## Variabile în Vercel (Production)

| Variabilă | Rol |
|-----------|-----|
| `NEXT_PUBLIC_SIGNALING_WS_URL` | Bază WS: **wss://** în producție. Ex. `wss://ws.diebel.ro/ws` sau `wss://ws.diebel.ro` (se adaugă `/ws`). |
| `NEXT_PUBLIC_TURN_URLS` | JSON array de string-uri STUN/TURN, ex. `["stun:turn.example:3478","turn:turn.example:3478?transport=udp"]` |
| `TURN_STATIC_SECRET` | Secret coturn `static-auth-secret` — pentru `/api/call/ice-config` (HMAC username) |
| `TURN_REALM` | `realm` coturn (ex. hostname TURN) |
| `TURN_AUTH_SECRET` | Min 16 — pentru token semnalizare + validări server (aliniază cu coturn dacă folosiți același secret) |
| `SIGNALING_TOKEN_SECRET` sau `NEXTAUTH_SECRET` | Min 16 — semnare token `GET /api/call/signaling-token` și verificare pe `call-signaling-server.mjs` |

## Server extern (semnalizare)

Pe VPS (ex. Hetzner), lângă coturn:

1. Setează același `SIGNALING_TOKEN_SECRET` (sau `NEXTAUTH_SECRET`) ca în Vercel.
2. Pornește: `NODE_ENV=production SIGNALING_PORT=4001 node server/call-signaling-server.mjs` sau systemd — vezi `turn/call-signaling.service.example`.
3. Nginx/Caddy: **TLS** terminat la proxy, `wss://` → `http://127.0.0.1:4001/ws` (upgrade WebSocket).

**Nu** trebuie să rulezi Next pe același port; doar procesul `.mjs`.

## `wss://<domeniu-Vercel>/api/ws`?

Standard **nu** funcționează: Vercel nu face upgrade WS la handlerul Next. Folosește subdomeniu dedicat (ex. `ws.diebel.ro`) sau un reverse proxy pe VPS care mapează `/api/ws` către backend-ul de semnalizare.

## Agregator configurare — `GET /api/webrtc-full-check`

Verificare **automată** (cu sesiune logată): token de semnalizare, ICE/TURN din API, și consistența `TURN_STATIC_SECRET` + `TURN_AUTH_SECRET`. Detalii și script: **`DEPLOY-ONLINE.md`** (`npm run verify:webrtc`).

**Limitare:** nu verifică dacă coturn sau serverul WebSocket pe VPS rulează — doar că aplicația Vercel este configurată corect pentru aceste rute.

## Verdict final doar din app — `GET /api/webrtc-ready-check`

Răspuns compact: `readyFromApp`, `missingFromApp`, `summary: APP_READY_WAITING_FOR_VPS | APP_NOT_READY`. Script: `npm run verify:webrtc:final`. Documentație: **`WEBRTC-FINAL.md`**.

## Test relay (TURN) — `chrome://webrtc-internals`

1. Deschide apelul în Chrome.
2. `chrome://webrtc-internals` → găsește conexiunea ta.
3. La **ICE candidates**, caută tip **`relay`** — confirmă că TURN e folosit (util în rețele stricte/NAT).
