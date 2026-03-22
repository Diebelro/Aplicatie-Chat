# Publicare probă (Vercel)

Build-ul proiectului: `prisma generate && next build` (deja în `vercel.json`).

## 1. Pregătește repo-ul Git

```bash
cd align-app   # sau rădăcina repo-ului tău
git add -A
git status     # verifică că .env NU e inclus (e în .gitignore)
git commit -m "Deploy probă"
git push origin main   # sau branch-ul tău
```

## 2. Vercel

1. Intră pe [vercel.com](https://vercel.com) → **Add New… → Project**.
2. **Import** repository-ul GitHub/GitLab/Bitbucket cu acest cod.
3. **Root Directory**: setează **`align-app`** (proiectul Next e în subfolder, nu în rădăcină).
4. **Framework Preset**: Next.js (detectat automat).
5. **Environment Variables** (Production + Preview dacă vrei aceeași probă pe preview):

   | Variabilă | Obligatoriu probă | Notă |
   |-----------|-------------------|------|
   | `DATABASE_URL` | Da (Neon) | URL **direct** sau migrări; evită pooler doar pentru `migrate` dacă ai erori P1002 |
   | `NEXTAUTH_SECRET` | Da | Min. 32 caractere random |
   | `NEXTAUTH_URL` | Da | `https://<nume-proiect>.vercel.app` sau domeniul tău |
   | `NEXT_PUBLIC_APP_URL` | Da | Același URL public ca `NEXTAUTH_URL` |
   | `BLOB_READ_WRITE_TOKEN` | Recomandat | Poze chat pe server; fără el, pe Vercel nu merge upload-ul |
   | `BLOB_READ_WRITE_TOKEN_PDF` | Opțional | Doar dacă vrei PDF în chat |

   Copiază restul din `.env.example` după nevoie (email, reCAPTCHA, WebRTC, etc.).

6. **Deploy**.

## 3. Bază de date după primul deploy

Din PC (cu `DATABASE_URL` de producție în env temporar):

```bash
cd align-app
npx prisma migrate deploy
# sau, dacă folosești doar db push în dev:
# npx prisma db push
```

Fără tabele create, login/signup pot da erori.

## 4. Verificare probă

- Deschide URL-ul Vercel → `/login` sau `/signup`.
- Testează mesaje, hartă (HTTPS + locație), apeluri doar dacă ai setat variabilele WebRTC din `.env.example`.

## Dacă build-ul pică pe Vercel

- Log-uri **Build** în Vercel → vezi eroarea Prisma/TypeScript.
- Asigură-te că **Root Directory** e `align-app`.
- `DATABASE_URL` trebuie să existe la build dacă `prisma generate` citește schema (în mod normal merge fără conexiune live la generate).
