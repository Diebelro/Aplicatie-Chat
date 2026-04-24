# Audit producție — aplicația de chat (align-app)

Document intern: stare arhitecturală, riscuri și hardening aplicat. **Nu** include funcționalități de business.

## 1. Structură

| Zonă | Rol |
|------|-----|
| `app/app/*` | UI autentificat (chat, profil, apeluri) |
| `app/api/*` | Route Handlers REST |
| `middleware.ts` | HTTPS redirect (prod), admin gate, probe blocklist |
| `lib/` | Auth, sesiuni, rate limit, Prisma repo, WebRTC client helpers |
| `server/call-signaling-server.mjs` | WebSocket semnalizare (VPS / proces separat, **nu** Vercel serverless) |
| `prisma/` | Schema DB |

## 2. Next.js (`next.config.js`)

- Build hash / commit: `VERCEL_GIT_COMMIT_SHA` (40 hex) → `NEXT_PUBLIC_BUILD_COMMIT_*` + `NEXT_PUBLIC_BUILD_HASH` (fără `git` la runtime în bundle).
- Antete securitate globale: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `HSTS` (prod HTTPS), `Permissions-Policy`, `X-Permitted-Cross-Domain-Policies`.
- **CSP strict pe documente HTML**: neaplicat aici — Next.js 16 + RSC folosesc adesea inline scripts; activarea CSP fără audit complet riscă să spargă UI. Reevaluare separată cu `Content-Security-Policy-Report-Only` + endpoint de raportare.

## 3. Variabile de mediu critice

- **`DATABASE_URL`** (+ `DIRECT_URL` pentru Neon): fără ele, date reale lipsesc.
- **`NEXTAUTH_SECRET`**, **`NEXTAUTH_URL`**: OAuth / NextAuth.
- **`NEXT_PUBLIC_APP_URL`**: origine canonică (chat).
- **`NEXT_PUBLIC_SIGNALING_WS_URL`**: `wss://…` către serverul de semnalizare; fără el, apelurile nu se leagă.
- **TURN** (coturn + env-uri documentate în `docs/TURN-MANDATORY.md`): apeluri reale pe rețele restrictive.
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` pentru tranzacțional.

Lista completă: `.env.example` (dacă există) și `scripts/check-online-env.mjs`.

## 4. API — public vs privat

- **Publice / pre-auth**: login, signup, forgot/reset password, verify-email, resend-verify, health, healthz (sanitizat), `GET /api/ws` (JSON explicativ, nu WS upgrade).
- **Autentificate**: majoritatea sub `resolveRequestUserId` / `getAuthenticatedUserId` / sesiune cookie `align_sid`.
- **Admin**: sub `/api/admin/*` + rol în DB; UI `/admin` protejat în middleware.

## 5. Rate limiting (`lib/rateLimit.ts`)

- Implementare **în memorie** per instanță Node/serverless: pe Vercel e **best-effort** (scalare orizontală = bugete separate). Depășirile sunt înregistrate în `securityThreats` unde e cazul.
- Limite dedicate: feed, swipe, mesaje, check-email/username, auth login/signup, **rute auth sensibile** (forgot/reset/verify/resend, align-bridge, recovery, validate token, `GET /api/ws`), feedback, vitals, etc.
- Apeluri WebRTC: `lib/callRateLimit.ts` pe ring / ice-config / signaling-token / etc.

## 6. WebRTC

- Semnalizarea **nu** e pe același WebSocket ca Next; clientul folosește URL-ul din env către procesul Node dedicat.
- TURN obligatoriu pentru producție matură (vezi `instrumentation.ts` + docs).

## 7. Middleware

- Forțare HTTPS în producție când app URL e HTTPS.
- Admin: `fetch /api/me` cu **timeout 8s** (fail-safe la incidente infra).
- **Blocklist** pentru path-uri tipice de scanare (`/.env`, `/.git`, `wp-admin`, …) → 404 imediat.

## 8. Observabilitate

- **`GET /api/health`**: fără DB, contract în `docs/API-HEALTH.md` — smoke / versiune deploy.
- **`GET /api/healthz`**: verificări profunde (DB, URL-uri); pentru monitorizare „stack complet”.
- **`lib/serverLog.ts`**: logare erori fără body/token; dezactivare `DISABLE_SERVER_ERROR_LOG=1`; stack complet doar cu `LOG_ERROR_STACK=1`.

## 9. Riscuri reziduale (reale)

| Risc | Mitigare curentă / notă |
|------|-------------------------|
| Rate limit în memorie pe serverless | Acceptat; pentru prag strict global → Redis / Upstash în viitor |
| Brute-force parolă | Login: limită + eșecuri trackuite; reCAPTCHA opțional |
| Abuse email (forgot/resend) | Limite IP + mesaje uniforme (fără enumerare user) |
| DDoS volumetric | Vercel / CDN / WAF la nivel infrastructură |
| CSP lipsă | Documentat; adoptare incrementală |

## 10. Ce **nu** s-a schimbat (conform brief)

- Logică chat mesaje, WebRTC negociere, flux utilizator.
- Refactor cosmetic fără câștig operațional.
