

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

Pași concreți: **[DEPLOY-ONLINE.md](./DEPLOY-ONLINE.md)** — Vercel + PostgreSQL (Neon/Supabase), Root Directory `align-app`, variabile obligatorii.

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

## Checklist scurt producție

1. **Variabile**: Vercel (sau host) — `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, email (`RESEND_*`), Blob dacă folosești atașamente, semnalizare/TURN dacă ai apeluri (vezi `.env.example`).
2. **UI**: fără bandă WIP — nu seta `NEXT_PUBLIC_SHOW_WIP_BANNER` sau lasă-o `false`. Butoane sociale — afișate implicit (stub); ascunde cu `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=false`.
3. **Tracking**: setează `NEXT_PUBLIC_GA4_ID` / Meta / Ads doar cu ID-uri reale; altfel scripturile nu se încarcă.
4. **Verificare locală**: din `align-app`, `npm run lint`, `npm run test`, `npm run build`.
5. **Deploy**: Root Directory `align-app`; detalii în [DEPLOY-ONLINE.md](./DEPLOY-ONLINE.md) și `/docs/BUILD_AND_DEPLOY.md`.

## Security Standards
The platform implements strict security controls:

- No sourcemaps in production
- DevTools disabled