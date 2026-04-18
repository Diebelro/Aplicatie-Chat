# Cum pui aplicația online (Vercel + PostgreSQL)

Cel mai rapid: **Vercel** (host Next.js) + **Neon** sau **Supabase** (PostgreSQL gratuit). Repo-ul tău are folderul aplicației în **`align-app`** — asta contează la import.

## 1. Cod pe GitHub

Repo exemplu: **`https://github.com/Diebelro/Aplicatie-Chat`** (folder aplicație: `align-app`).

Dacă încă nu e sincronizat:

```bash
git add .
git commit -m "mesaj"
git push origin main
```

**Important:** nu comite `.env` cu parole. `.next` nu trebuie în git (de obicei e în `.gitignore`).

## 2. Bază de date PostgreSQL

1. **Neon** (recomandat cu Vercel): [neon.tech](https://neon.tech) → New project → copiază **`DATABASE_URL`** (include `?sslmode=require` dacă ți-l dă așa).
2. Sau **Supabase** → Project Settings → Database → connection string (mod **Transaction**, URI).

## 3. Proiect pe Vercel

1. Intră pe [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importă repo-ul GitHub.
3. **Root Directory** → **Edit** → setează **`align-app`** (obligatoriu dacă repo-ul conține și alte foldere; rădăcina repo-ului Git este de obicei nivelul de deasupra folderului aplicației).
4. Framework: Next.js (detectat automat).
5. **Environment Variables** (Production) — pentru **`https://chat.diebel.ro`** (domeniul canonic al app-ului):

   | Variabilă | Obligatoriu | Valoare / notă |
   |-----------|-------------|----------------|
   | `DATABASE_URL` | Da | Neon **Pooled** (host cu `-pooler`) |
   | `DIRECT_URL` | Da | Neon **Direct** (fără `-pooler`) — migrări / Prisma CLI |
   | `EXPECTED_DB_ENV` | Da | `prod` |
   | `NEXTAUTH_SECRET` | Da | ≥ 32 caractere (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | Da | `https://chat.diebel.ro` |
   | `NEXT_PUBLIC_APP_URL` | Da | `https://chat.diebel.ro` (**aceeași** bază ca `NEXTAUTH_URL`; TWA / WKWebView folosesc acest origin) |
   | `PUBLIC_APP_URL` | Recomandat | `https://chat.diebel.ro` (link-uri email / server) |

   **WebRTC (apeluri voce/video între browser și wrapper mobil)** — fără aceste variabile, semnalizarea și ICE **nu** merg pe internet:

   | Variabilă | Obligatoriu pentru apeluri | Notă |
   |-----------|----------------------------|------|
   | `NEXT_PUBLIC_SIGNALING_WS_URL` | Da | Ex. `wss://ws.diebel.ro/ws` (**wss://**, nu `ws://127.0.0.1`) |
   | `NEXT_PUBLIC_TURN_URLS` | Da | JSON array sau listă virgulă; **cel puțin un** `turn:` / `turns:` (relay) — vezi `GET /api/call/ice-config` |
   | `TURN_STATIC_SECRET` | Da (ICE) | **Identic** cu `static-auth-secret` din coturn — folosit de `/api/call/ice-config` (HMAC credențiale TURN). **Nu** e același lucru ca `TURN_AUTH_SECRET`. |
   | `TURN_AUTH_SECRET` | Da (server) | ≥ 16 car.; validare `webrtcConfig` / token semnalizare (vezi `parseTurnAndSignalingSecrets`) |
   | `TURN_REALM` | Da | Ex. `turn.diebel.ro` (sau `realm=` coturn) |
   | `SIGNALING_TOKEN_SECRET` | Da* | ≥ 16 car.; **identic** pe Vercel și pe VPS-ul unde rulează `call-signaling-server.mjs` (sau folosește același `NEXTAUTH_SECRET` ≥ 16) |

   \*Dacă `NEXTAUTH_SECRET` are deja ≥ 16 car., poți omite `SIGNALING_TOKEN_SECRET` doar dacă serverul de semnalizare e configurat să accepte același secret (vezi `docs/calls.md`).

   **Preview (URL `*.vercel.app`, PR-uri, branch-uri):** pentru **aceleași** variabile WebRTC ca mai sus, în Vercel la fiecare cheie bifează și **Preview** (nu doar Production). Dacă lipesc pe Preview, **`/api/db-ping` poate rămâne OK** (DB e setată), dar **`/api/call/ice-config` dă 500** (`TURN_REQUIRED: …`) și apelurile nu pornesc — nu e regresie de cod, e mediul. După ce le adaugi: **Redeploy**. Din `align-app`, cu `npx vercel link` făcut: `npm run vercel:assert-call-env` (listează chei lipsă, fără valori).

6. **Deploy**.

**Checklist rapid (local, fără a afișa secrete):** din `align-app`, după ce ai copiat valorile din Vercel în `.env.local` (sau export în shell), rulează `npm run check:online-env` — trebuie mesajul `OK: online env checklist passed`. Pentru doar TURN/ICE: `npm run check:turn-env`.

La build, Vercel rulează **`prisma generate && next build`** (vezi `vercel.json`).  
**Migrările SQL** nu rulează automat în build (evită erori când DB e indisponibilă sau IP blocat). Le aplici **tu** când aduci cod nou cu migrări — folosește **`prisma migrate deploy`** (nu `db push` pe producție):

```bash
cd align-app
# setează DATABASE_URL + DIRECT_URL = aceleași ca în Vercel (Neon prod), apoi:
npx prisma migrate deploy
```

Rulează asta de pe PC sau din orice mediu care poate ajunge la Neon **după** fiecare `git pull` care adaugă fișiere în `prisma/migrations/`.

## 4. După primul deploy

- Verificare **automată** env + formă conexiuni Neon + ping DB (fără valori secrete în răspuns):
  - **Health detaliat:** `https://chat.diebel.ro/api/healthz` (înlocuiește domeniul cu cel real al app-ului).
  - **Doar DB:** `https://chat.diebel.ro/api/db-ping`
  - **Ce indică „totul verde”:** în JSON, `ok: true`, `dbOk: true`, `expectedDbEnvProd: true`, `nextAuthSecretMinLengthOk: true`, `urlChecks.identical: true`, toate intrările din `requiredEnv` cu `set: true`, `dbChecks.neonPoolerShapeOk` nu este `false` (dacă folosești Neon), `dbChecks.*ContainsAmpEntity` ambele `false`. **Important:** dacă `webrtcChecks.*` sunt `false`, **apelurile tot nu vor merge** până setezi variabilele WebRTC/TURN pe **acel** deployment (inclusiv Preview); health-ul rămâne „verde” la app+DB în mod intenționat. Verificare rapidă: `GET /api/webrtc-env-check` (JSON fără secrete).
  - Există și endpoint-ul simplu pentru uptime: `GET /api/health` (doar `ok` / `database` / `ms`).

### Verificare automată end-to-end (recomandat după fiecare deploy)

Din calculator, în folderul **`align-app`**:

```bash
node scripts/verify-production.mjs
```

**Ce face:** face `GET` la `/api/healthz` și `/api/db-ping` pe domeniul de producție și verifică strict:

- `/api/healthz`: status **200**, `Content-Type` conține **application/json**, `ok === true`, `dbOk === true`, `urlChecks.identical === true`
- `/api/db-ping`: status **200**, `dbOk === true`

**Dacă răspunsul e HTML** (ex. pagina 404 din `app/not-found.tsx`), scriptul raportează explicit că **domeniul nu servește rutele API așteptate** (proiect Vercel greșit, Root Directory, sau URL greșit).

**URL alt decât implicit** `https://chat.diebel.ro`:

```bash
VERIFY_PRODUCTION_BASE_URL=https://nume-proiect.vercel.app node scripts/verify-production.mjs
```

**Commit Git pe Vercel** (opțional): dacă deployment-ul are `VERCEL_GIT_COMMIT_SHA`, `/api/healthz` include câmpul `gitSha`. Poți forța potrivirea cu commitul tău local:

```bash
VERIFY_EXPECTED_GIT_SHA=$(git rev-parse HEAD) node scripts/verify-production.mjs
```

Pe Windows PowerShell:

```powershell
$env:VERIFY_EXPECTED_GIT_SHA = (git rev-parse HEAD); node scripts/verify-production.mjs
```

**Output OK:** linia `✅ PROD OK` și exit code **0**.  
**Output eșuat:** `❌ PROD NOT READY` cu motive pe bullet-uri și exit code **1** (potrivit pentru CI).

### Verificare WebRTC (token + ICE/TURN) în producție

**Endpoint:** `GET /api/webrtc-full-check` — necesită **sesiune autentificată** (același cookie ca în browser după login). Răspunsul este **JSON sanitizat**: nu conține token WS, parole sau credențiale ICE.

**Ce verifică (doar partea Vercel / Next):** apelarea logicii echivalente cu `/api/call/signaling-token` și `/api/call/ice-config`, plus prezența **amânduror** `TURN_STATIC_SECRET` și `TURN_AUTH_SECRET`. Nu verifică dacă **coturn** sau procesul de **semnalizare pe VPS** rulează sau sunt accesibile în rețea — doar că variabilele și rutele API sunt coerente.

**Interpretare rapidă:**

| `step` în răspuns | Acțiune |
|-------------------|---------|
| `auth` | Nu ești logat — deschide app-ul în browser sau pune cookie-ul la script (vezi mai jos). |
| `signaling-token` | Verifică `TURN_AUTH_SECRET` (≥16), `SIGNALING_TOKEN_SECRET` sau `NEXTAUTH_SECRET` (≥16). |
| `ice-config` | Verifică `NEXT_PUBLIC_TURN_URLS` (JSON cu cel puțin un `turn:` / `turns:`), `TURN_REALM`, `TURN_STATIC_SECRET`. |
| `secrets` | Setează **ambele** `TURN_STATIC_SECRET` și `TURN_AUTH_SECRET` (altfel apeluri pot pica parțial). |

**Script local (din `align-app`):**

```bash
npm run verify:webrtc
```

Cookie de sesiune (din DevTools → Application → Cookies, după login pe domeniul de producție), ex.:

```bash
VERIFY_WEBRTC_COOKIE="next-auth.session-token=PASTE_TOKEN" npm run verify:webrtc
```

*Notă:* numele exact al cookie-ului poate fi `__Secure-next-auth.session-token` pe HTTPS; poți pune **întreg** header-ul `Cookie` dacă ai mai multe cookie-uri de sesiune.

**Output:** `✅ WEBRTC OK` și exit **0** dacă `ok: true`; `❌ WEBRTC FAIL at <pas>` și exit **1** altfel.

**Verdict unic „app pregătită, așteaptă VPS”:** `GET /api/webrtc-ready-check` + `npm run verify:webrtc:final` — vezi **`docs/WEBRTC-FINAL.md`**.

- Deschide URL-ul Vercel și testează login/signup.
- Dacă ai erori la build: verifică că `DATABASE_URL` e setat **înainte** de build (în Vercel → Settings → Environment Variables) și că IP-ul DB permite conexiuni (Neon/Supabase permit de obicei de oriunde).

## 5. Opțional dar util

- **Domeniu propriu:** Vercel → Project → Domains → adaugă domeniu; actualizează `NEXTAUTH_URL` și `NEXT_PUBLIC_APP_URL` la `https://domeniul-tău.ro` și redeploy.
- **Fișiere în chat (poze/PDF):** Vercel Blob — vezi `BLOB_READ_WRITE_TOKEN` în `.env.example`.
- **reCAPTCHA** la înregistrare: cheile din `.env.example`.
- **Apeluri video/audio (WebRTC):** necesită server de semnalizare + eventual TURN pe un VPS; detalii în `.env.example` și `docs/` (nu rulează doar pe Vercel serverless). Aplicația poate fi online fără ele; apelurile nu vor funcționa până nu configurezi `NEXT_PUBLIC_SIGNALING_WS_URL` etc.

## Rezumat

1. Push cod pe GitHub.  
2. Neon → `DATABASE_URL`.  
3. Vercel → Root **`align-app`** + variabilele de mai sus.  
4. Deploy.

Pentru variabile complete, vezi **`align-app/.env.example`**.
