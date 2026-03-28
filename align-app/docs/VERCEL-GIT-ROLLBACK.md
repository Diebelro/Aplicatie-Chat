# Vercel: deploy la fiecare commit și punct de intoarcere

Monorepo: aplicația Next.js este în **`align-app`**. Vercel trebuie să folosească acest folder ca **Root Directory**.

---

## 1. Legătura Git → Vercel (o singură dată)

1. [vercel.com](https://vercel.com) → **Add New…** → **Project** → importă repo-ul `Aplicatie Chat` (GitHub/GitLab/Bitbucket).
2. **Root Directory**: `align-app` (click „Edit” lângă root dacă e nevoie).
3. **Framework Preset**: Next.js (detectat automat).
4. **Build Command** / **Install Command**: lasă gol dacă folosești `vercel.json` din `align-app` (sau confirmă că sunt cele din proiect).
5. **Environment Variables**: copiază din Vercel Production (sau `npx vercel env pull` local) — `DATABASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_*`, secrete TURN/signaling pentru producție, etc.
6. **Production Branch**: de obicei `main`. Fiecare push pe `main` → **Production Deploy**.

Preview: orice alt branch sau PR primește un URL de previzualizare automat (dacă e activ în setări).

---

## 2. Ce se întâmplă la commit

| Acțiune | Rezultat tipic |
|--------|----------------|
| Push pe `main` | Build + deploy **Production** (domeniul tău) |
| Push pe alt branch / deschidere PR | **Preview** (URL unic) |
| GitHub Actions (`align-app-ci.yml`) | Lint, test, build de verificare (fără deploy); nu înlocuiește Vercel |

CI-ul din repo verifică că buildul trece înainte/synchronous cu merge; deployul efectiv îl face Vercel după ce primește push-ul.

---

## 3. Punct de intoarcere (rollback)

### Varianta A — din dashboard (recomandat)

1. Vercel → **Project** → **Deployments**.
2. Găsești deploy-ul **care a fost bun** (dată, commit SHA).
3. Meniu **`⋯`** pe acel rând → **Promote to Production** (sau **Redeploy** / **Instant Rollback** — depinde de plan și versiune UI).

Asta pune din nou în producție artefactul deja construit al acelui commit, fără build nou.

### Varianta B — din Git

1. `git revert <commit-rău>` sau `git reset --hard` + force (doar dacă echipi știe ce face).
2. Push pe `main` → Vercel face un deploy nou din codul vechi.

Pentru urgență fără așteptat build, preferă **Varianta A**.

---

## 4. Verificări după deploy

- `GET https://<domeniu>/api/health` → 200, `database: up` (sau `skipped` în mod demo).
- Login rapid, o pagină principală.

---

## 5. Fișiere relevante în repo

- `align-app/vercel.json` — comenzi de install/build (inclusiv `prisma generate`).
- `.github/workflows/align-app-ci.yml` — verificări la push/PR pe `align-app/**`.

Dacă schimbi structura monorepo-ului, actualizează **Root Directory** în setările proiectului Vercel.
