# Playbook recuperare date (Neon + operații sigure)

**REGULĂ:** **DEV** și **PROD** sunt **proiecte Neon diferite** (sau cel puțin branch-uri/endpoints diferite), cu `DATABASE_URL` / `DIRECT_URL` separate în Vercel vs `.env.local`. Niciodată același endpoint pentru „încerc pe local” și „userii reali”.

Scurt ghid fără secrete în repo. Pașii exacți pot varia ușor în UI-ul Neon; verifică documentația curentă Neon pentru denumiri de meniuri.

## 0. Trei pași când „am pierdut datele” sau DB e goală

1. **Verifică proiectul Neon corect** (dev vs prod) și connection string-urile în `.env.local` / Vercel (`DATABASE_URL` pooled, `DIRECT_URL` direct).
2. **Dacă trebuie recuperat în timp:** folosește **PITR / Instant restore** (secțiunea 1) sau **recover project** (secțiunea 2) dacă proiectul a fost șters.
3. **Dacă DB e nouă goală după restore sau proiect nou:** setezi **temporar** în `.env.local` **`BOOTSTRAP_ADMIN_EMAIL`** + **`BOOTSTRAP_ADMIN_PASSWORD`** (exemple **doar comentate** în `.env.local.example`) și din `align-app` rulezi **`npm run bootstrap`**. User de test **doar** dacă pui **`BOOTSTRAP_TEST_EMAIL`**. Nimic nu șterge useri existenți. **După ce ești înapoi în picioare:** rulează **`npm run cleanup`** — scoate `BOOTSTRAP_*` din `.env.local` și îți lasă fluxul zilnic fără „cont bootstrap” în config.

Login: credențialele din DB după bootstrap (sau flux normal). NextAuth `/api/auth/session` e separat de cookie-ul custom `align_sid` pentru `/api/auth/login`.

## 1. Point-in-time restore (PITR / Instant restore) pe Neon

**Când:** date șterse/modificate greșit, migrație rea, sau nevoie de „înapoi la ora X”.

**Ideea:** Neon poate restaura starea unei baze la un moment din fereastra de istoric (plan-dependent). Restaurarea pe **branch-ul principal** este de obicei un **overwrite**: starea curentă a acelui branch este înlocuită cu cea din punctul ales.

**Pași tipici (conceptual):**

1. Deschide **Neon Console** → proiectul tău → secțiunea **Branches** (sau **Restore** / **Point-in-time restore**, după UI).
2. Alege **branch-ul** care deservește producția (ex. `main` / `production`).
3. Selectează **Restore** / **Point-in-time** și setează **timpul** țintă (timestamp) în fereastra permisă de plan.
4. Confirmă. Uneori Neon **creează automat un backup branch** sau snapshot înainte de overwrite — verifică mesajul din UI.
5. După restore, **reporniți** aplicația (Vercel redeploy sau restart worker) și verifică **health** + un flux critic (login).

**Atenție:** Restore-ul pe branch-ul live afectează toți utilizatorii conectați la acel branch. Pentru „doar investigare”, preferă **clonare branch** sau restore într-un branch nou, apoi compară datele.

## 2. Proiect Neon șters accidental (grace period)

**Când:** proiectul a fost șters din greșeală și încă e în perioada în care Neon permite recuperarea.

**Pași tipici:**

1. **Neon Console** → zone pentru proiecte șterse / **Restore project** (denumire exactă în docs Neon).
2. Ai nevoie de identificatorul proiectului (**project ID**) sau de link-ul din e-mailul de confirmare ștergere, după caz.
3. Urmează **Recover** în UI. După recuperare, **verifică** connection string-urile (pool + direct) și variabilele din Vercel (DATABASE_URL, DIRECT_URL).

## 3. Ce să NU faci în panică

- Nu rula **`prisma migrate reset`** pe **producție** — în acest repo este blocat când `NODE_ENV=production`.
- Nu folosi **`db push`** ca proces obișnuit pe producție dacă echipa folosește **migrări versionate**; folosește **`migrate deploy`** din CI sau manual cu **DIRECT_URL** corect.
- Nu copia connection string-ul de **dev** în variabilele **Production** din Vercel fără verificare; folosește `EXPECTED_DB_ENV` / guardrails din `scripts/env-guard.mjs`.

## 4. Legătură cu variabilele din aplicație

- **Runtime (Vercel / server):** `DATABASE_URL` = de regulă string **Pooled** (host cu `-pooler` pe Neon).
- **Migrări / CLI Prisma:** `DIRECT_URL` = string **Direct** (fără `-pooler`). Configurate în `prisma/schema.prisma` prin `directUrl`.

Detalii suplimentare: `.env.example` și scripturile `npm run db:*` din `package.json`.
