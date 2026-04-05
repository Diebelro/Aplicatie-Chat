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
3. **Root Directory** → **Edit** → setează **`align-app`** (obligatoriu dacă repo-ul conține și alte foldere).
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
   | `NEXT_PUBLIC_TURN_URLS` | Da | JSON array: `stun` / `turn` / `turns` către serverul TURN (ex. `turn.diebel.ro`) |
   | `TURN_AUTH_SECRET` | Da | ≥ 16 car.; aliniat cu coturn / `GET /api/call/ice-config` |
   | `TURN_REALM` | Da | Ex. `turn.diebel.ro` (sau realm-ul coturn) |
   | `SIGNALING_TOKEN_SECRET` | Da* | ≥ 16 car.; **identic** pe Vercel și pe VPS-ul unde rulează `call-signaling-server.mjs` (sau folosește același `NEXTAUTH_SECRET` ≥ 16) |

   \*Dacă `NEXTAUTH_SECRET` are deja ≥ 16 car., poți omite `SIGNALING_TOKEN_SECRET` doar dacă serverul de semnalizare e configurat să accepte același secret (vezi `docs/calls.md`).

6. **Deploy**.

La build, Vercel rulează **`prisma generate && next build`** (vezi `vercel.json`).  
**Migrările SQL** nu rulează automat în build (evită erori când DB e indisponibilă sau IP blocat). Le aplici **tu** când aduci cod nou cu migrări — folosește **`prisma migrate deploy`** (nu `db push` pe producție):

```bash
cd align-app
# setează DATABASE_URL + DIRECT_URL = aceleași ca în Vercel (Neon prod), apoi:
npx prisma migrate deploy
```

Rulează asta de pe PC sau din orice mediu care poate ajunge la Neon **după** fiecare `git pull` care adaugă fișiere în `prisma/migrations/`.

## 4. După primul deploy

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
