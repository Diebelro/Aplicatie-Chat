
# /aplicatie-noua — start corect, nu reparații la final

Context: regulile complete sunt în `~/.claude/CLAUDE.md` (secțiunea 14 = checklist).

## Pasul 0 — Ce are aplicația (întreabă O SINGURĂ DATĂ, cu o singură întrebare)

Înainte de orice cod, stabilește cu proprietarul, într-o singură întrebare cu bife:
- Nume produs (internațional, sub umbrela Diebel) + subdomeniu `*.diebel.ro`
- Are conturi de utilizatori? (login/register/reset/delete)
- Are email? (dacă are conturi → da, obligatoriu)
- Are plăți? (Stripe Diebel) — dacă nu, NU se implementează nimic de plăți
- Are mesaje/chat/notificări?
- Are apeluri audio/video? — dacă nu, nimic de WebRTC
- Are aplicație Android / Google Play?
- Limbi: RO+EN+DE implicit; altele?
- Admin: contact@diebel.ro = admin automat

Ce nu bifează → NU se implementează și NU se verifică (regula 0.14). Nu propune în plus.

## Pasul 1 — Schelet (în ordinea asta, toate înainte de prima funcție)

1. Next.js, structură standard, `.env.example` cu TOATE variabilele listate, `.gitignore` cu `.env*`, git init + commit inițial.
2. Design system: temă deschisă/albă, paletă (3–4 culori), componente de bază (buton cu toate stările, input cu eroare lângă câmp, card, toast cu auto-hide), spațiere unică, mobile-first; layout container cu max-width pe desktop.
3. i18n de la primul text: `Record<Lang, Copy>` tipat (cheile lipsă pică la `tsc`), selector cu steaguri, limba persistă (cookie), script `check-i18n` care raportează chei lipsă.
4. Footer standard o singură dată: „© 2026 Diebel" → contact@diebel.ro. Cookie banner (o dată, memorat), pagini `/privacy`, `/terms`, `/delete-account` (dacă are conturi), Impressum dacă piață DE.
5. Dacă are conturi: register (confirmare parolă + GDPR checkbox), login, logout (invalidează sesiunea), reset parolă prin email, schimbare parolă, ștergere cont cu confirmare; primul cont / contact@diebel.ro = admin; `/admin` pe rol server-side; link Admin doar după login cu rol.
6. Dacă are email: Zoho SMTP primar + Resend fallback, expeditor `<Produs> <contact@diebel.ro>`, trimitere o singură dată; `SMTP_PASS=` lăsat gol în `.env` și fișierul deschis pentru proprietar; un email de test real după configurare.
7. Date: DB + upload-uri în folder persistent (în afara build-ului, servit de Nginx), DEV/PROD separate, `prisma migrate deploy` pe prod, script de backup zilnic (DB + upload-uri, 14 zile) instalat la primul deploy. Fără seed în producție.
8. Dacă are plăți: Stripe pe contul Diebel (chei din proiectele existente de pe server), prețuri întregi într-un singur fișier config, webhook idempotent logat în DB, plan activat doar din webhook, Customer Portal.
9. Dacă are mesaje/notificări: push real, badge care dispare la citire, buton de sugestii → contact@diebel.ro.
10. Dacă are apeluri: TURN autentificat, STUN interzis, stări distincte, cleanup la hangup, cod de apeluri izolat și marcat „nu se atinge".
11. Deploy: script `DEPLOY.sh` (backup → copiere → build → tsc/lint/teste → restart → verificare 200 → rollback la eșec), Nginx vhost + SSL, `/health` public fără secrete, pm2/systemd cu restart.
12. Dacă are Android: package `ro.diebel.<app>`, keystore salvat și documentat, edge-to-edge, iconiță adaptivă identică cu Play, folder `google-play-assets/` cu dimensiuni exacte.
13. SEO: pagini separate indexabile, sitemap, robots, meta, Analytics o singură dată.

## Pasul 2 — Lucru

Fiecare funcție nouă trece prin `/departamente` (doar cele relevante) înainte de a fi declarată gata. Deploy după fiecare set de modificări, cu confirmare „e pe net".

## Pasul 3 — Livrare

Polish în 2–3 treceri, apoi raport scurt: ce face aplicația, ce e verificat, ce rămâne manual (chei, conturi externe), ghid de utilizare în 10 rânduri.
