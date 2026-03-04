# Cum pui aplicația pe net (deploy)

Aplicația este Next.js + Prisma + PostgreSQL. Ai două variante practice.

---

## Varianta 1: Vercel (app) + baza de date în cloud (recomandat)

**Idee:** Aplicația rulează pe Vercel, iar baza de date este un serviciu PostgreSQL în cloud (Neon, Supabase sau Railway).

### Pas 1: Baza de date PostgreSQL în cloud

Alege unul (gratuit pentru început):

- **[Neon](https://neon.tech)** – gratuit, PostgreSQL serverless  
  - Creează cont → New Project → copiază **Connection string** (postgresql://...).
- **[Supabase](https://supabase.com)** – gratuit, PostgreSQL + opțional auth/storage  
  - New project → Settings → Database → **Connection string** (URI).
- **[Railway](https://railway.app)** – gratuit la început  
  - New Project → Add PostgreSQL → Variables → **DATABASE_URL**.

Salvează URL-ul de tip:  
`postgresql://user:parola@host:5432/nume_db?sslmode=require`

### Pas 2: Proiectul pe GitHub

1. Creează un repo pe [github.com](https://github.com) (ex: `align-app`).
2. În folderul proiectului (align-app), rulează:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USER/align-app.git
git push -u origin main
```

(Înlocuiește `TU_USER` cu username-ul tău GitHub.)

### Pas 3: Deploy pe Vercel

1. Mergi la [vercel.com](https://vercel.com) și loghează-te (cu GitHub).
2. **Add New** → **Project** → importă repo-ul `align-app`.
3. **Environment Variables** – adaugă:
   - `DATABASE_URL` = connection string-ul de la Pas 1 (cu `?sslmode=require` dacă e nevoie).
   - Opțional: `NEXTAUTH_URL` = `https://numele-tau-proiect.vercel.app` (dacă folosești NextAuth).
4. **Deploy** – Vercel rulează `npm run build` (care include `prisma generate`).

După deploy ai un URL de tip: `https://align-app-xxx.vercel.app`.

### Pas 4: Migrare bază de date în cloud

Baza de date din cloud e goală. Trebuie să creezi tabelele:

**Opțiune A – de pe calculatorul tău (recomandat):**

1. În `.env` local pune temporar `DATABASE_URL` cu URL-ul de la Neon/Supabase/Railway.
2. Rulează:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
3. Opțional: revino la `DATABASE_URL` local dacă mai lucrezi local.

**Opțiune B – din Vercel (Build step):**

Vercel deja rulează `prisma generate` la build. Pentru a rula și migrări/push doar la deploy, poți adăuga în **Project Settings → Build & Development** un build command custom, de exemplu:

```bash
prisma generate && prisma db push --accept-data-loss && next build
```

(Preferabil: faci **Opțiunea A** o dată, apoi la deploy nu mai e nevoie de `db push` la fiecare build.)

### Pas 5: Primul admin

1. Deschide site-ul live (URL-ul Vercel).
2. Creează un cont la **Înregistrare** (`/signup`).
3. Mergi la **/admin/setup** și introdu același email/parolă → contul devine admin.

---

## Varianta 2: Railway (app + baza de date pe același serviciu)

**Idee:** Atât aplicația, cât și PostgreSQL rulează pe Railway.

1. Cont pe [railway.app](https://railway.app) (cu GitHub).
2. **New Project** → **Deploy from GitHub repo** → alege repo-ul `align-app`.
3. În același project: **New** → **Database** → **PostgreSQL**.
4. Click pe serviciul **PostgreSQL** → **Variables** → copiază `DATABASE_URL`.
5. Click pe serviciul **align-app** (aplicația) → **Variables** → **Add Variable**:  
   `DATABASE_URL` = valoarea copiată.
6. **Settings** la aplicație → **Generate Domain** → ai un URL public.
7. Pe calculatorul tău, în `.env` pune acest `DATABASE_URL` și rulează o dată:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
8. La **/admin/setup** configurezi primul admin (după ce ai făcut signup pe site-ul live).

---

## Variabile de mediu importante în producție

| Variabilă | Obligatoriu | Descriere |
|-----------|-------------|-----------|
| `DATABASE_URL` | Da | Connection string PostgreSQL (cu SSL dacă e cloud). |
| `NEXTAUTH_URL` | Dacă folosești NextAuth | URL-ul site-ului, ex: `https://nume-site.vercel.app`. |
| `NEXTAUTH_SECRET` | Dacă folosești NextAuth | Șir aleatoriu lung (min. 32 caractere). |
| `RECAPTCHA_SECRET_KEY` | Opțional | Pentru reCAPTCHA la login/signup. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Opțional | Cheia publică reCAPTCHA. |

---

## Rezumat rapid

- **Vercel + Neon/Supabase:** app pe Vercel, DB în cloud; configurezi `DATABASE_URL` în Vercel, rulezi o dată `prisma db push` (și eventual `db:seed`) către DB-ul din cloud, apoi configurezi primul admin la `/admin/setup`.
- **Railway:** app + PostgreSQL în același proiect; pui `DATABASE_URL` la serviciul app, rulezi local o dată `prisma db push` + `db:seed`, apoi admin la `/admin/setup`.

După ce aplicația e live, toate rutele (`/login`, `/app`, `/admin`, etc.) funcționează la URL-ul tău public.
