# Operațiuni — chat (align-app)

Ghid scurt pentru dev și incidente.

## Rulare locală

```bash
cd align-app
npm ci
# Copiază .env.example → .env.local și completează minim: DATABASE_URL, NEXTAUTH_*, NEXT_PUBLIC_APP_URL
npm run dev
```

Port implicit dev: **3005** (vezi `package.json`). Aliniază `NEXTAUTH_URL` și `NEXT_PUBLIC_APP_URL` cu hostul din browser (localhost vs 127.0.0.1).

Semnalizare apeluri local: `npm run signaling:dev` (dacă testezi WebRTC end-to-end).

## Env critice (prod)

| Variabilă | De ce |
|-----------|--------|
| `DATABASE_URL` | Date utilizatori, mesaje |
| `DIRECT_URL` | Prisma migrate / unele query-uri Neon |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Sesiune OAuth |
| `NEXT_PUBLIC_APP_URL` | Origine canonică HTTPS |
| `NEXT_PUBLIC_SIGNALING_WS_URL` | `wss://…` semnalizare apeluri |
| TURN (`TURN_*`, `ICE_*` — vezi docs) | ICE complet pe mobil / 4G |

Nu loga valorile în ticket-uri publice.

## Verificare după deploy

1. `GET https://chat.diebel.ro/api/health` — HTTP 200, `status === "ok"`, `commit.full` = SHA așteptat (vezi `docs/API-HEALTH.md`).
2. `npm run verify:production` din `align-app` (dacă ai `VERIFY_*` setate) — include `/api/healthz`.
3. Smoke manual: login, listă mesaje, un apel test (dacă TURN+semnalizare sunt live).

## „Nu merge” — ordinea de verificare

1. **Health** (`/api/health`) — rulează codul nou? (`commit`, `environment`).
2. **Healthz** (`/api/healthz`) — DB up? URL-uri identice? Neon pooler vs direct (mesajul din script).
3. **Vercel / logs** — erori 5xx pe ruta care pică; căutare după scope `[forgot-password]` etc. din `serverLog`.
4. **Browser network** — 401 pe `/api/me` = sesiune/cookie; 429 = rate limit.
5. **Apeluri** — `NEXT_PUBLIC_SIGNALING_WS_URL` rezolvabil; TURN din `docs/TURN-MANDATORY.md`; semnalizare VPS online.

## Logare

- Producție: evită `LOG_ERROR_STACK=1` permanent (volume); folosește la debug punctual.
- `DISABLE_SERVER_ERROR_LOG=1` doar dacă un handler spam-ează și trebuie tăiat temporar.
