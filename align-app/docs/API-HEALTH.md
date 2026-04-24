# GET `/api/health`

Endpoint public pentru smoke-test, verificare deploy și debugging. **Nu** lovește baza de date; **nu** expune secrete. Răspunsul include metadata de build injectată la compile (vezi `next.config.js`).

## Monitoare (UptimeRobot, load balancer, scripturi)

- Verificați **HTTP 200**.
- În JSON, verificați **`status === "ok"`** (string).
- Nu vă bazați pe câmpuri din contractul vechi (`ok`, `database`, `ms`).

## Câmpuri (contract curent)

| Câmp | Tip | Notă |
|------|-----|------|
| `status` | string | `"ok"` când serviciul răspunde |
| `commit.full` | string | SHA 40 caractere sau `"unknown"` |
| `commit.short` | string | primele 16 hex din commit sau `"unknown"` |
| `build` | string | același identificator scurt ca `commit.short` |
| `environment` | string | `production` \| `preview` \| `development` |
| `timestamp` | string | ISO UTC, schimbă la fiecare request |
| `runtime.node` | string | versiune Node (fără prefix `v`) |
| `vercelRegion` | string | opțional, doar pe Vercel dacă e setat |

Antet recomandat: răspunsul folosește `Cache-Control: no-store`.

Pentru verificări care includ DB și URL-uri, folosiți **`GET /api/healthz`** (contract separat).
