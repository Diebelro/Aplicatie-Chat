# Checklist – aplicația 100% gata pentru producție

## 1. Deploy (hosting)

- [ ] **Vercel:** fie `vercel login` + `npx vercel --prod` din `align-app`, fie conectezi repo-ul (GitHub etc.) în Vercel și faci deploy din dashboard.
- [ ] După primul deploy, notează URL-ul de producție (ex. `https://align-app.vercel.app` sau domeniul tău).

---

## 2. Variabile de mediu pe Vercel (obligatorii)

Setate în **Vercel → Project → Settings → Environment Variables** (Production):

| Variabilă | Obligatoriu | Exemplu / Notă |
|-----------|------------|----------------|
| `DATABASE_URL` | **Da** | Connection string Neon (Postgres). Din Vercel Storage sau din Neon. |
| `NEXTAUTH_SECRET` | **Da** | Min. 32 caractere random. Gen: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **Da** | URL-ul aplicației în producție, ex. `https://taudomeniu.vercel.app` |

Fără aceste 3, login/sesiuni și DB nu vor funcționa corect în producție.

---

## 3. Variabile recomandate (pentru funcționalitate completă)

| Variabilă | Pentru ce | Dacă lipsește |
|-----------|-----------|----------------|
| `EMAIL_PUBLIC_APP_URL` | Opțional: **doar** baza URL pentru linkuri din email (override peste `PUBLIC_APP_URL`) | Folosește dacă vrei explicit `https://chat.diebel.ro` fără să atingi alte setări. |
| `PUBLIC_APP_URL` | **Prioritar** (după `EMAIL_PUBLIC_APP_URL`) pentru link-uri în email (reset, verificare) | Ex. `https://chat.diebel.ro`. În **production**, dacă e greșit `https://diebel.ro` (apex), codul înlocuiește automat cu `https://chat.diebel.ro` (vezi `lib/appUrl.ts`). Excepție: `DISABLE_DIEBEL_APEX_EMAIL_REDIRECT=1`. |
| `NEXT_PUBLIC_APP_URL` | URL în browser + fallback pentru link-uri email | Același ca `PUBLIC_APP_URL` + `NEXTAUTH_URL` (ex. `https://chat.diebel.ro`). |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA la signup/login | App merge, dar fără protecție anti-bot. |
| `RECAPTCHA_SECRET_KEY` | Validare reCAPTCHA pe server | Idem. |
| `RESEND_API_KEY` | Trimitere email (reset parolă, verificare email) | Fluxurile de email nu vor trimite mesaje reale. |
| `RESEND_FROM_EMAIL` | Adresa expeditor (ex. `noreply@taudomeniu.com`) | Se folosește implicit `onboarding@resend.dev`. |

---

## 4. Baza de date

- [ ] **Neon (sau Postgres din Vercel):** `DATABASE_URL` setat pe Vercel.
- [ ] **Schema:** După primul deploy (sau înainte), rulezi o dată migrarea/schema pe DB-ul de producție:
  - fie local cu `DATABASE_URL` = connection string-ul de producție și `npm run db:push`,
  - fie printr-un script/job care rulează cu acel `DATABASE_URL`.

---

## 5. După deploy – verificări rapide

- [ ] Deschizi URL-ul de producție în browser.
- [ ] Pagina principală se încarcă.
- [ ] **Login:** pui email + parolă (cont existent) → intri în app.
- [ ] **Signup:** creezi un cont nou → merge fără erori.
- [ ] **Ai uitat parola:** dacă ai setat Resend, primești email; dacă nu, poți verifica doar că pagina nu dă eroare.
- [ ] Link-uri din email (reset parolă etc.) folosesc `NEXT_PUBLIC_APP_URL` (nu localhost).

---

## 6. Opțional (poți adăuga mai târziu)

- Jitsi propriu: `NEXT_PUBLIC_JITSI_DOMAIN`
- URL-uri semnate (premium): `SIGNED_URL_SECRET`
- Stripe (plăți): `STRIPE_PRICE_*`
- Analytics: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, AdSense
- Reclame interne: `NEXT_PUBLIC_AD_*`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, etc.

---

## Rezumat minimal pentru „100% ready”

1. Deploy pe Vercel (CLI sau Git).
2. Setează pe Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (= URL-ul de producție).
3. Rulezi o dată schema pe DB (ex. `db:push` cu `DATABASE_URL` de producție).
4. (Recomandat) Setezi `NEXT_PUBLIC_APP_URL`, reCAPTCHA și Resend pentru email + protecție.

După pașii 1–3 aplicația poate rula în producție; cu pasul 4 este gata 100% pentru utilizatori reali (email, reset parolă, protecție).
