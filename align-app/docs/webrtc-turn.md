# WebRTC TURN (REST / `use-auth-secret`)

## Ce este `use-auth-secret` la coturn

Coturn poate folosi **`use-auth-secret`** cu un **secret static** în `turnserver.conf` (`static-auth-secret=...`). Clienții **nu** folosesc acel secret direct. În schimb, **serverul aplicației** generează perechi **efemere**:

- **`username`**: de forma `timestamp_expirare:identificator` (ex. timp Unix + TTL, suffix `align` sau user id scurt).
- **`credential`**: `base64( HMAC-SHA1(secret, username) )` — același algoritm pe care îl verifică coturn.

Astfel, parola TURN **nu** ajunge în codul client și **nu** se comite în repo.

## De ce nu punem parola în client

- Orice string din bundle-ul Next.js este vizibil în browser.
- Modelul efemer permite **rotație** și **expirare** (TTL scurt), limitând abuzul dacă cineva interceptează o pereche.

## Variabile de mediu (Vercel + local)

| Variabilă | Unde | Rol |
|-----------|------|-----|
| `NEXT_PUBLIC_TURN_URLS` | Public (browser + server) | JSON array: STUN + TURN + TURNS (ex. `turn.diebel.ro`). |
| `TURN_REALM` | Doar server | Informativ / documentare; trebuie aliniat cu `realm=` din coturn (ex. `turn.diebel.ro`). |
| `TURN_STATIC_SECRET` | **Doar server** | Același secret ca `static-auth-secret` din coturn. **Niciodată** în client. |

Exemplu în `.env.example` (fără valori reale):

```env
TURN_REALM=turn.diebel.ro
TURN_STATIC_SECRET=<set-on-server-only>
NEXT_PUBLIC_TURN_URLS=["stun:turn.diebel.ro:3478","turn:turn.diebel.ro:3478?transport=udp","turns:turn.diebel.ro:5349?transport=tcp"]
```

**Notă:** ruta `GET /api/call/signaling-token` poate folosi în continuare `TURN_AUTH_SECRET` / `SIGNALING_TOKEN_SECRET` din `lib/env/webrtcConfig.ts`. Poți seta **`TURN_STATIC_SECRET` și `TURN_AUTH_SECRET` la aceeași valoare** ca secretul coturn dacă vrei o singură sursă operațională.

## Endpoint `GET /api/call/ice-config`

- Citește `NEXT_PUBLIC_TURN_URLS`, `TURN_REALM`, `TURN_STATIC_SECRET`.
- Răspunde JSON: `{ iceServers: [...], ttl, realm }` — de obicei **două intrări**: STUN (`urls` fără credențiale) + TURN (`urls` + `username` / `credential` REST).
- `ttl` = secunde până la expirarea username-ului (în implementarea curentă: **180**).
- Header `cache-control: no-store`.

Clientul (`hooks/useWebRtcCall.ts`) face `fetch("/api/call/ice-config", { cache: "no-store" })` și normalizează lista cu `iceServersFromIceConfigResponse` din `lib/webrtc/connection.ts` (toate intrările, nu doar prima).

## Cum verifici

1. **Browser:** `chrome://webrtc-internals` în timpul unui apel — caută **ICE candidates** de tip **relay** (TURN).
2. **Blocare UDP:** dacă forțezi traficul prin **TURNS** (TCP/TLS), ar trebui să vezi candidați relay pe portul TLS al TURN.
3. **Răspuns API:** în DevTools → Network → `ice-config` → intrarea TURN are `username` / `credential` (fără a expune `TURN_STATIC_SECRET`).

## 404 pe `/api/call/ice-config` în producție

Codul rutei este sub **App Router**: `app/api/call/ice-config/route.ts`. Dacă în producție primești **404** (nu 500):

1. **Vercel — Root Directory** trebuie să fie **`align-app`** (dacă monorepo-ul are rădăcina repo mai sus). Altfel build-ul poate fi alt proiect sau fără acest folder → ruta nu există în deployment.
2. **`output: "export"`** în `next.config.js` — **interzis** pentru API Routes; toate `/api/*` devin 404. În repo nu este activ; păstrează-l așa.
3. **Branch / deploy** — commit-ul care adaugă `ice-config` este pe branch-ul conectat la Production?
4. **Smoke test:** `GET /api/health` — dacă și asta e 404, problema e la deployment/config Vercel, nu la logica ICE.

Nu există `vercel.json` cu rewrites care să „fure” `/api/call/*`. Redirecturile din `next.config.js` vizează doar `/termeni` și `/confidentialitate`.

## Troubleshooting

| Simptom | Verificări |
|---------|------------|
| **404 pe ice-config** | Root Directory Vercel = `align-app`; fără `output: "export"`; verifică `/api/health`. |
| **Fără candidați relay** | `NEXT_PUBLIC_TURN_URLS` corect; firewall 3478/5349; coturn pornește; `external-ip` coturn. |
| **401/403 la TURN** | `TURN_STATIC_SECRET` identic cu `static-auth-secret` coturn; username neexpirat (ceas server sincronizat). |
| **500 „TURN urls missing”** | `NEXT_PUBLIC_TURN_URLS` JSON valid (array de string-uri). |
| **500 „realm/secret missing”** | `TURN_REALM` și `TURN_STATIC_SECRET` setate pe Vercel / `.env` server. |
| **Conexiune moare după ~3 min** | TTL credențiale 180s — clientul trebuie să refacă apelul sau (în viitor) să reîmprospăteze ICE; mărești TTL doar dacă politica de securitate permite. |
| **Certificat / hostname** | URL-urile `turns:` trebuie să corespundă certificatului de pe `turn.diebel.ro`. |

## Legături

- Playbook deploy: `docs/hetzner-production-playbook.md`, `docs/calls.md`.
- Coturn exemplu: `turn/install-coturn.sh`.
