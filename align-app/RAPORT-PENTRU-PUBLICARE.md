# Raport: ce mai trebuie făcut pentru publicare și publicitate

## 1. Înainte de a pune aplicația pe net

### 1.1 Bază de date (obligatoriu)
- **PostgreSQL** – fără el, conturile și datele se pierd la repornire.
- În `.env` (pe serverul de producție) pune:
  ```env
  DATABASE_URL=postgresql://user:parola@host:5432/nume_baza
  ```
- După ce ai pus `DATABASE_URL`, rulează pe server: `npm run db:setup` (sau `db:migrate` dacă folosești migrări).

### 1.2 Variabile de mediu pentru producție
Completează în `.env` pe server (nu pune `.env` pe GitHub – rămâne secret):

| Variabilă | Rol |
|-----------|-----|
| `DATABASE_URL` | Conexiune PostgreSQL (conturi, profiluri, mesaje) |
| `NEXTAUTH_SECRET` | Secret pentru sesiuni (min. 32 caractere random) |
| `NEXTAUTH_URL` | URL-ul public, ex. `https://taudomeniu.ro` |
| `RECAPTCHA_SECRET_KEY` | Cheie secretă reCAPTCHA (pentru signup/login) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Cheie publică reCAPTCHA |
| `SIGNED_URL_SECRET` | Secret pentru URL-uri semnate (min. 16 caractere), dacă folosești resurse protejate |

Opțional: Jitsi (apeluri video), Resend (email), etc. – vezi `.env.example`.

### 1.3 Hosting
- Alege un provider: **Vercel** (foarte simplu cu Next.js), **Railway**, **Render**, **DigitalOcean App Platform**, sau VPS (ex. Hetzner).
- Conectează repo-ul de GitHub; la build setează variabilele de mediu din 1.2.
- Pentru PostgreSQL: ofertă inclusă (Railway, Render, Supabase) sau serviciu separat (ex. Neon, Supabase, Aiven).

### 1.4 Domeniu și HTTPS
- Cumpară un domeniu (ex. align.ro) și leagă-l de hosting (DNS: A/CNAME către IP sau domeniul oferit de Vercel/Railway etc.).
- HTTPS este de obicei inclus (Let’s Encrypt) când folosești Vercel/Railway/Render.

---

## 2. Pentru publicitate și vizibilitate online

### 2.1 Meta tags și SEO
- **Title și description** unice pe pagină (ex. homepage, login, signup) – folosite de Google și când se share-uie linkul.
- În `layout.tsx` (sau per-pagină): `<title>`, `<meta name="description" content="...">`.
- Open Graph: `<meta property="og:title">`, `og:description`, `og:image` (imagine 1200×630 px) – pentru Facebook/Instagram/WhatsApp.
- Opțional: Twitter Card (`twitter:card`, `twitter:title`, `twitter:image`).

### 2.2 Google / reCAPTCHA
- Ai deja reCAPTCHA pentru signup; verifică că cheile sunt pentru domeniul de producție în Google reCAPTCHA Admin.

### 2.3 Rețele sociale și ads
- **Meta Pixel** – în consolă apare „Invalid PixelID: null”. Pentru Facebook/Instagram Ads: pune în `.env` (sau config) un Pixel ID valid și folosește-l în cod; altfel dezactivează/ascunde scriptul pixel dacă nu îl folosești.
- Conturi sociale (Facebook, Instagram etc.) și link-uri către ele în app (footer, „Despre noi”).

### 2.4 Link-uri utile în app
- Termeni și condiții, Politica de confidențialitate, Cookies – le ai; asigură-te că sunt la zi și ușor de găsit.
- Pagină „Contact” sau „Despre” cu email/link-uri – bine pentru încredere și SEO.

---

## 3. GitHub: commit și push

### 3.1 Ce NU trebuie pus pe GitHub
- Fișierul **`.env`** – conține parole și chei. Rămâne doar pe calculatorul tău și pe server.
- **`node_modules/`** – se instalează cu `npm install`.
- **`.next/`** – build local.
- Baze de date locale (ex. `*.db`) – nu le comitezi.

Asigură-te că `.gitignore` conține: `.env`, `node_modules`, `.next`, `*.db` (sau path-ul la baza Prisma).

### 3.2 Cum faci commit și push (pe scurt)
1. **Salvezi tot** în Cursor (Ctrl+K S).
2. În terminal (în folderul proiectului, ex. `Aplicatie Chat` sau `align-app`):
   ```bash
   git add .
   git status
   ```
   Verifici că nu apare `.env` în listă. Dacă apare, scoate-l: `git reset HEAD .env` și verifică `.gitignore`.
3. Commit:
   ```bash
   git commit -m "Fix login: sesiuni partajate (globalThis), middleware cookie pentru /api/me, delay 500ms după login"
   ```
4. Push pe GitHub:
   - Dacă ai deja remote: `git push origin main` (sau `master`).
   - Dacă nu ai repo pe GitHub: creezi un repository nou pe github.com (fără README), apoi:
     ```bash
     git remote add origin https://github.com/NUME_UTILIZATOR/NUME_REPO.git
     git push -u origin main
     ```

### 3.3 După push
- Conectezi repo-ul la Vercel/Railway etc. și configurezi variabilele de mediu din secțiunea 1.2.
- La fiecare `git push` pe `main`, hosting-ul poate face deploy automat (dacă ai activat opțiunea).

---

## 4. Checklist rapid

- [ ] PostgreSQL configurat (local/producție) și `DATABASE_URL` în `.env`
- [ ] `npm run db:setup` rulat după ce ai pus `DATABASE_URL`
- [ ] Toate variabilele din 1.2 setate pe serverul de producție
- [ ] Hosting ales și conectat la GitHub
- [ ] Domeniu și HTTPS
- [ ] Meta tags + OG (title, description, image) pentru share
- [ ] Meta Pixel corectat sau dezactivat
- [ ] `.env` nu e în Git; `.gitignore` în regulă
- [ ] Commit + push pe GitHub; deploy activ

După ce parcurgi pașii de mai sus, aplicația poate fi publică și pregătită pentru publicitate.
