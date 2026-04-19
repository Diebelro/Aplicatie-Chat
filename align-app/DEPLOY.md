# Publicare Align pe internet (telefon + desktop)

## 1. Pregătire

- Cont [Vercel](https://vercel.com) (gratuit).
- Repo-ul proiectului pe GitHub/GitLab/Bitbucket (sau îl încarcă direct pe Vercel).
- Bază de date PostgreSQL (ex. [Neon](https://neon.tech) sau Vercel Postgres) – ai deja `DATABASE_URL` în `.env` local.

## 2. Deploy pe Vercel

1. Mergi la [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Importă repo-ul (sau uploadează folderul `align-app`).
3. **Root Directory**: dacă proiectul e într-un subfolder, setează `align-app` (sau rădăcina unde e `package.json`).
4. **Build & development** (de obicei detectate automat):
   - Build Command: `npm run build` sau `pnpm build`
   - Output: Next.js (implicit)
   - Install Command: `npm install` sau `pnpm install`

## 3. Variabile de mediu (obligatorii în producție)

În Vercel: **Project → Settings → Environment Variables**. Adaugă:

| Variabilă | Exemplu | Notă |
|-----------|---------|------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Conectare la PostgreSQL (Neon/Vercel Postgres) |
| `NEXTAUTH_SECRET` | string lung aleatoriu (min 32 caractere) | Pentru sesiuni; generezi cu `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://chat.diebel.ro` | URL canonic public (fără slash la final) |
| `NEXT_PUBLIC_APP_URL` | același ca `NEXTAUTH_URL` | Pentru link-uri în email, OAuth, etc. |

Producția DIEBEL folosește domeniul **`https://chat.diebel.ro`** (proiect Vercel `aplicatie-chat`). URL-urile `*.vercel.app` sunt secundare (preview / debugging), nu înlocuiesc `chat.diebel.ro` în env. După schimbarea env: **Redeploy**.

Opțional (dacă le folosești):

- `BLOB_READ_WRITE_TOKEN`, `BLOB_READ_WRITE_TOKEN_PDF` – Vercel Blob pentru atașamente
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` – reCAPTCHA la signup
- `NEXT_PUBLIC_JITSI_DOMAIN` – server Jitsi pentru apeluri video

## 4. Migrări bază de date

După ce ai setat `DATABASE_URL` în Vercel:

- **Local** (o singură dată): rulezi migrările pe baza de date folosită și de producție:
  ```bash
  cd align-app
  npm run db:push
  # sau: npx prisma migrate deploy
  ```
- Dacă baza e goală și ai `prisma/seed.ts`, poți rula `npm run db:seed` local (cu același `DATABASE_URL` ca în producție, dacă vrei date de test).

## 5. Telefon (mobil)

- Aplicația e deja pregătită: viewport, safe-area, touch, font 16px la inputuri.
- **HTTPS**: Vercel oferă HTTPS; pe telefon folosește link-ul `https://...` de la Vercel.
- **„Adaugă pe ecranul principal”**:  
  Pe iOS (Safari): Share → „Adaugă la ecranul de start”.  
  Pe Android (Chrome): Meniu → „Instalează aplicația” / „Adaugă la ecranul de start”.  
  Opțional: adaugă în `public/` fișierele `icon-192.png` și `icon-512.png` pentru icon în ecranul de start (manifestul din `app/manifest.ts` poate fi extins cu aceste path-uri).

## 6. După deploy

- Deschide URL-ul Vercel pe telefon și pe desktop; testează login, mesaje, profiluri.
- Dacă link-urile din email (ex. reset parolă) merg la localhost, verifică că `NEXT_PUBLIC_APP_URL` și `NEXTAUTH_URL` sunt setate la URL-ul public (HTTPS).
- Domeniu custom: în Vercel, **Settings → Domains** și adaugi domeniul tău; apoi actualizezi `NEXTAUTH_URL` și `NEXT_PUBLIC_APP_URL` cu noul domeniu.

### chat.diebel.ro

- În producție setați `NEXT_PUBLIC_APP_URL=https://chat.diebel.ro` și `NEXTAUTH_URL=https://chat.diebel.ro`.
- **DNS**: CNAME pentru `chat` trebuie să pointeze la **cname.vercel-dns.com** (sau la Vercel conform instrucțiunilor din Domains). Nu adăugați alt A/CNAME care să ocolească Vercel – tot traficul trebuie să ajungă la Vercel ca `/api/messages` și celelalte API-uri să ruleze pe același host.

## Rezumat

1. Repo pe Git → Import în Vercel.  
2. Setează `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`.  
3. Rulează migrări local pe baza de producție (`db:push` sau `migrate deploy`).  
4. Deploy → deschizi link-ul pe telefon și pe browser; pentru „instalare” pe telefon folosești „Adaugă pe ecranul principal”.
