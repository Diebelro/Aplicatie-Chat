# Măsuri de securitate – Align

## 1. Protecție cod client

- **Build producție**: minificare (SWC), `compress: true`, fără source maps (`productionBrowserSourceMaps: false`). În producție, `console.log` / `console.debug` / `console.info` sunt eliminate (`compiler.removeConsole`); rămân `error` și `warn`.
- **React DevTools și __NEXT_DATA__**: În producție, componenta `DisableDevTools` limitează expunerea hook-urilor și a `__NEXT_DATA__` după hydration.

## 2. Protecție resurse interne

- **URL-uri semnate**: Imaginile interne și resursele sensibile prin `/api/media?s=TOKEN` (HMAC, expirare). Secret: `SIGNED_URL_SECRET` (doar server).
- **Public**: Nu pune resurse premium sau date sensibile în `public`.

## 3. Protecție API și identitate

### Sursa de adevăr pentru `userId`

- **`x-user-id` singur nu este acceptat** ca identitate. Orice client poate trimite un header fals; de aceea **nu** se mai rezolvă userul doar din acest header.
- **Sesiune validă** = una din variante:
  - cookie **`align_sid`** care mapează la o intrare în `lib/sessions.ts`, sau
  - **`x-session-token`** + **`x-user-id`** unde tokenul de sesiune este valid și **userId-ul din header coincide** cu userul din sesiune (vezi `getAuthFromRequest` în `lib/sessionAuth.ts`).
- **`resolveRequestUserId`** = același contract: returnează userId **doar** dacă sesiunea e validă; altfel rutele API răspund **401** când verifică explicit.

### Middleware

- În repo există **`middleware.disabled.ts`** (nu este activ ca `middleware.ts`). **Nu** ne bazăm pe middleware Next pentru auth global; validarea se face în **Route Handlers** și în `sessionAuth`.

### Endpoint-uri sensibile WebRTC

| Endpoint | Auth | Note |
|----------|------|------|
| `GET /api/call/ice-config` | Da (`resolveRequestUserId` + user în DB/store) | Credențiale TURN efemere; rate limit `icecfg:${userId}` (20 / 60s). |
| `GET /api/call/signaling-token` | Da | Token WS semnalizare; rate limit similar. |

### Rate limiting

- **`lib/rateLimit.ts`**: limite per IP / user / path pe unele rute (feed, swipe, auth, etc.) — stocare în **memorie** (pe serverless: best-effort per instanță). Depășirile sunt înregistrate în **`lib/securityThreats.ts`** pentru **Admin → Securitate** și banner roșu când pragurile impun avertisment.
- **`lib/callRateLimit.ts`**: apeluri video (ex. ice-config, signaling-token).

## 4. Anti-bot

- **Swipe**: `canPerformLike`, `recordSuspiciousBehavior`, 429 la abuz.
- **Device blocat**: `lib/deviceBlock.ts` — 403 după prag; log în memorie (pentru producție la scară: persistare recomandată).

## 5. Protecție server și build

- **Health public**: `GET /api/health` — pentru monitoare uptime (fără autentificare); `503` dacă PostgreSQL e configurat dar nu răspunde.
- **Bord admin**: `GET /api/admin/system-status` — memorie, DB, erori proces, semnale securitate, LCP mediu (beacon anonim). Nu înlocuiește Sentry / APM.
- **Cron ops** (opțional): `GET /api/cron/ops-pulse` cu `Authorization: Bearer` (`OPS_CRON_SECRET` sau `CRON_SECRET` pe Vercel) — snapshot ca bordul; webhook la critical dacă e setat `OPS_CRITICAL_WEBHOOK_URL`.
- **Firewall**: doar porturile necesare (443/80 etc.).
- **ENV**: doar `NEXT_PUBLIC_*` în client; secretele rămân pe server.
- **Antete HTTP** (`next.config.js`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (`Strict-Transport-Security`) când `NODE_ENV=production` și `NEXT_PUBLIC_APP_URL` începe cu `https://` — poți dezactiva HSTS cu `DISABLE_HSTS=1` (ex. medii speciale).
- **ID sesiune**: generat cu `crypto.randomBytes` (cookie `align_sid` rămâne **httpOnly**, **SameSite=strict**, **Secure** în producție).
- **Parole noi**: bcrypt cu **12** runde (`lib/auth.ts`); hash-urile vechi se verifică în continuare.

## 6. Protecție UI și legală

- **Watermark**: `NEXT_PUBLIC_BUILD_HASH` + date în DOM pentru audit.
- **Termeni**: interdicții tehnice (scraping, boturi, etc.) în conținutul legal.

---

## Roadmap tehnic (neimplementat – plan)

- **Vercel / serverless la scară**: store **partajat** (ex. **Redis**) pentru sesiuni și rate limiting global.
- **Video în grupuri mari**: **SFU** (serviciu sau self-hosted), nu doar mesh între browsere.

Pentru URL-uri semnate în producție: `SIGNED_URL_SECRET` (min. 16 caractere), distinct pe medii.
