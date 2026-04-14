

# Enterprise Documentation: European Premium Dating Platform

## Overview
This repository contains the source code and technical documentation for a premium, security‑focused dating platform designed for scalable deployment across the European market. The system is engineered with a modular architecture, strict security controls, GDPR compliance, and enterprise‑grade operational standards.

The platform is initially launched in Romania, with infrastructure hosted in Germany to ensure data protection, low latency, and regulatory alignment with EU requirements.

## Core Principles
- Security-first architecture
- Modular and maintainable codebase
- High performance and low latency
- GDPR-compliant data handling
- Scalable infrastructure for multi-region deployment
- Clear separation of concerns across all engines and services

## WebRTC / calls (TURN)

Voice and video calls require **coturn + TURN env** on the server. **`GET /api/call/ice-config` returns 500 if TURN is misconfigured — by design.** See **`docs/TURN-MANDATORY.md`** and **`docs/HOSTILE-NETWORKS-WEBRTC.md`** (ICE restarts, timeouts, diagnostics).

## Technology Stack
- Next.js (App Router)
- TypeScript
- PostgreSQL with Prisma ORM
- CDN-backed media delivery
- URL signing for secure asset access
- Advanced anti-bot and anti-abuse systems
- TailwindCSS for UI consistency
- Node.js runtime

## System Architecture
The platform is organized into independent engines, each responsible for a critical domain:

- Feed Engine: relevance, distance, filtering, and anti-scraping protections
- Swipe Engine: action validation, rate limiting, behavioral analysis
- Match Engine: atomic match creation and consistency guarantees
- Premium Engine: subscription logic, temporary premium, rewarded ads
- Profile System: identity, photos, preferences, visibility rules
- Security Layer: API hardening, build security, URL signing
- Anti-Bot System: device fingerprinting, behavioral detection, blocking logic

Each engine is fully documented in the `/docs` directory.

## Repository Structure
/src  
/docs  
/public  
package.json  
next.config.js  
tsconfig.json  
tailwind.config.ts  
README.md  

## Documentation
All technical and operational documentation is located in the `/docs` directory. It includes:

- Architecture Overview
- Feed, Swipe, Match, Premium, and Profile Engines
- API Security Rules
- Anti-Bot System
- Build Security
- Build and Deploy Pipeline
- URL Signing
- Legal Protection
- Index of all documents

Each document is designed to be a standalone reference and part of a unified enterprise documentation system.

## Build and Deployment
The complete build and deployment workflow is defined in `/docs/BUILD_AND_DEPLOY.md`.  
It includes:

- Environment validation
- Secure build pipeline
- Sourcemap removal
- DevTools deactivation
- Watermark injection
- Staging deployment
- Production deployment
- Rollback procedures
- Post-deploy monitoring

## Deploy online (Vercel)

Pași concreți: **[DEPLOY-ONLINE.md](./DEPLOY-ONLINE.md)** — Vercel + PostgreSQL (Neon), Root Directory **`align-app`**. Producție canonică: **`https://chat.diebel.ro`** — `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` și ( pentru apeluri) **`NEXT_PUBLIC_SIGNALING_WS_URL` (`wss://`)**, **`NEXT_PUBLIC_TURN_URLS`**, `TURN_AUTH_SECRET`, `TURN_REALM`, secret semnalizare — fără `ws://127.0.0.1` sau localhost în variabilele Vercel Production.

## Dezvoltare locală (align-app)

Dacă în PowerShell vezi **`npm is not recognized`** / **`node is not recognized`**: Node e instalat dar **nu e în PATH**. Fie adaugi `C:\Program Files\nodejs` la **Variabile de mediu → Path** și redeschizi terminalul, fie pornești dev-ul cu:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1` (din folderul `align-app`, după `npm install` făcut o dată cu calea completă la npm dacă trebuie).

1. `cd align-app`
2. `npm install`
3. **`npm run dev`** → aplicația e pe **`http://localhost:3005`** (port fix, evită confuzia cu 3000/3003).
4. Dacă apare „port in use”: **`npm run ports:free`** (Windows PowerShell — oprește procese Node care ascultă pe 3000–3010), apoi iar `npm run dev`.
5. Folosește **`http://`**, nu `https://`, pentru dev.
6. În `.env`, aliniază **`NEXTAUTH_URL`** și **`NEXT_PUBLIC_APP_URL`** cu `http://localhost:3005` dacă folosești NextAuth local.
7. Pentru semnalizare apeluri WebRTC **doar local**: `npm run signaling:dev` + `NEXT_PUBLIC_SIGNALING_WS_URL=ws://127.0.0.1:4001` (vezi `docs/calls.md`).
8. Ca să fie **ca pe Vercel** (video TURN + aceleași servicii): din `align-app`, după `npx vercel login` și `npx vercel link`, rulează **`npm run env:pull-production`** → generează `.env.local` cu variabilele din Production; deschide **`http://localhost:3005`**. Detalii în `.env.example` (secțiunea „LOCAL ca VERCEL”).

`npm run dev:auto` pornește Next pe portul implicit (3000 sau următorul liber) dacă preferi comportamentul vechi.

## Medii DB (Neon) și guardrails (flux zilnic)

- **Separare DEV / PROD:** proiecte Neon (sau endpoint-uri) **diferite**. Nu folosi connection string de producție în `.env.local` fără `EXPECTED_DB_ENV=prod` și fără să știi ce faci.
- **Variabile:** `DATABASE_URL` = conexiune **pooled** (`-pooler`); `DIRECT_URL` = conexiune **directă** (fără `-pooler`) pentru `migrate` / `db push` / `generate` (vezi `prisma/schema.prisma`). Model: **`.env.local.example`**.
- **Guard:** `scripts/env-guard.mjs` rulează înainte de `dev`, `start`, `db:*`. Setări utile: `EXPECTED_DB_ENV=dev|prod`, `FORBIDDEN_PROD_DB_SUBSTRING`, `DEV_URL_MARKERS`, `PROD_URL_MARKERS_IN_DEV`. Pe producție: **`prisma db push`** este blocat; folosește **`npm run db:migrate:deploy`**.
- **În mod normal** nu ai nevoie de variabile `BOOTSTRAP_*` în `.env.local`. După recovery, rulează **`npm run cleanup`** ca să rămâi doar cu contul tău real (ex. admin) și fără secrete de bootstrap în env.

## Am pierdut conturile / DB nouă (**doar recovery**, nu uz zilnic)

Folosește după **reset DB**, **Neon nou** sau când **lipsește admin-ul**. Pașii sunt în **`docs/RECOVERY.md`**. Rezumat:

1. În **`.env.local`**, setezi **temporar** `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (exemple **doar comentate** în **`.env.local.example`**).
2. **`npm run bootstrap`** — schema + `prisma/bootstrap-accounts.ts` (vezi `docs/RECOVERY.md`).
3. **`npm run cleanup`** — verifică admin-ul ținut (`contact@diebel.ro` implicit sau `CLEANUP_KEEP_EMAIL`), **șterge din `.env.local` toate `BOOTSTRAP_*`**, listează userii și îți arată (exemplu) **`npm run cleanup:bootstrap -- --keep … --delete … --yes`** dacă vrei să elimini manual conturi de test. **Cleanup nu șterge nimic în DB fără comanda ta explicită.**
4. **`npm run dev`** și login cu credențialele tale normale (parola e cea din DB după bootstrap / ce ai setat la înregistrare).

**Listare / ștergere user specific (foarte explicit):** `npm run cleanup:bootstrap` fără argumente listează userii; pentru ștergere: `npm run cleanup:bootstrap -- --keep contact@diebel.ro --delete alt@email.com --yes`.

## Checklist scurt producție

1. **Variabile**: Vercel (sau host) — `DATABASE_URL` **pooled**, `DIRECT_URL` **direct**, `EXPECTED_DB_ENV=prod`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, email (`RESEND_*`), Blob dacă folosești atașamente, semnalizare/TURN dacă ai apeluri (vezi `.env.example`).
2. **UI**: fără bandă WIP — nu seta `NEXT_PUBLIC_SHOW_WIP_BANNER` sau lasă-o `false`. Butoane sociale — afișate implicit (stub); ascunde cu `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=false`.
3. **Tracking**: setează `NEXT_PUBLIC_GA4_ID` / Meta / Ads doar cu ID-uri reale; altfel scripturile nu se încarcă.
4. **Verificare locală**: din `align-app`, `npm run lint`, `npm run test`, `npm run build`.
5. **Deploy**: Root Directory `align-app`; detalii în [DEPLOY-ONLINE.md](./DEPLOY-ONLINE.md) și `/docs/BUILD_AND_DEPLOY.md`.

## Security Standards
The platform implements strict security controls:

- No sourcemaps in production
- DevTools disabled