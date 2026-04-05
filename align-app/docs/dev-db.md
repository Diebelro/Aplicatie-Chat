# Bază de date în development

- **Conexiuni Neon:** `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) — vezi `.env.example`. Guardrails: `scripts/env-guard.mjs` (la `npm run dev`, `db:*`). Recuperare date: [RECOVERY.md](./RECOVERY.md).

## Prisma vs. memorie

- **În dev, dacă există `DATABASE_URL`, scriem în DB (nu în memorie).** Aplicația folosește Prisma la fel ca în producție, astfel că utilizatorii și datele persistă după repornirea `npm run dev`.
- **Dacă lipsește `DATABASE_URL` în dev**, rămâne fallback-ul la store-ul în memorie (datele se pierd la restart).

La pornirea serverului de dezvoltare vei vedea o singură dată în consolă:

`[DEV] Using Prisma because DATABASE_URL is set`

## User stabil `contact@diebel.ro` (Neon / producție)

Parola **nu** se pune în Git. Rulezi local, cu `DATABASE_URL` spre baza folosită de producție (copiat din Vercel → Environment Variables sau din Neon):

```powershell
cd "C:\Users\Alr\OneDrive\Documents\Proiecte\Aplicatie Chat\align-app"
$env:CONTACT_PASSWORD="PAROLA_TA"
npm run db:ensure-contact
```

Opțional: `CONTACT_EMAIL` (implicit `contact@diebel.ro`).

Scriptul face `user.upsert` (parolă cu bcrypt, același algoritm ca la signup) și creează **Profile** dacă lipsea. După aceea verifică login pe https://chat.diebel.ro .

## Backup în timpul dev

Vezi `scripts/start-dev-and-backup.ps1` sau comanda one-shot din același folder (README în PR).
