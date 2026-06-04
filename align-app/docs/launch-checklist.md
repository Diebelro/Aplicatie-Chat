# Diebel — GO‑LIVE (browser + iOS + Android)

**Test „pe internet” / producție:** folosește **`https://chat.diebel.ro`** (VPS Hetzner + Docker; deploy: `bash scripts/vps-full-deploy.sh` pe server). Nu folosi URL-uri `*.vercel.app`. Verificare locală: `npm run deploy:vps:check`.

Țintă: **aceeași aplicație web** folosită în **browser** (desktop & mobil), **Safari pe iOS** și **Chrome (sau browser default) pe Android** — de obicei cu **PWA** (Add to Home Screen). Dacă ai și **TWA** / wrapper Android nativ, vezi Digital Asset Links mai jos.

Checklist **orientat pe risc**. Detalii env: `align-app/.env.example`; infrastructură: `docs/hetzner-production-playbook.md` (dacă există).

---

## Neon + Vercel — `DATABASE_URL` (pooler) vs `DIRECT_URL` (direct)

Pe **Vercel → Environment Variables → Production**: păstrează **`DATABASE_URL`** cu host **pooled** (conține **`-pooler`**). Setează **`DIRECT_URL`** la conexiunea **Direct** din Neon (host **fără** **`-pooler`**), copiată din **Neon Console → Connection details** (nu același string ca la pooled).

- [ ] Neon: **Pooled** → `DATABASE_URL` (lăsat cum e dacă deja are `-pooler`).
- [ ] Neon: **Direct** (fără `-pooler` în hostname) → înlocuiește **doar** `DIRECT_URL` în Vercel.
- [ ] Opțional (CLI): din rădăcina repo `npx vercel env pull .env.vercel.production.pull --environment=production --yes`, apoi din `align-app`: `npm run vercel:fix-direct-url` (ia `DATABASE_URL_UNPOOLED` din pull și rescrie `DIRECT_URL` în Production).
- [ ] **Redeploy** producție (Vercel sau `npm run deploy:chat` din `align-app`).
- [ ] `GET /api/healthz`: `dbChecks.neonPoolerShapeOk === true`, fără `warnings` cu `NEON_POOLER_SHAPE`. Verificare locală: `npm run verify:production`.

---

## Go / No‑Go (3 reguli)

**GO** dacă (toate îndeplinite):

1. [ ] **Login în prod** merge pe **Desktop + iOS + Android**.
2. [ ] **Call cross‑network** merge (**iOS ↔ Android** sau **mobil ↔ desktop**; ex. 4G ↔ Wi‑Fi).
3. [ ] **Dacă folosești TWA**: `/.well-known/assetlinks.json` → **200**, body **JSON** (fără HTML / redirect). *Fără TWA → N/A, dar 1 + 2 rămân obligatorii.*

*Pentru 2: nu e suficient „merge pe același Wi‑Fi” — GO doar dacă testul cross‑network e făcut pe **minim 2 combinații**: **iOS↔Android** și **mobil↔desktop**.*

**NO‑GO** dacă **oricare** din cele 3 (aplicabile) pică.

---

## Completări recomandate (risc mare, efort mic)

- [ ] **„Fresh session” pe toate 3**: incognito desktop + Safari iOS + Chrome Android — **open → login → start call → hangup** (prinde edge‑case‑uri cookies / sesiune).
- [ ] **Service Worker / PWA după deploy**: hard refresh (sau ștergere date site) și confirmă că **nu** rămâne build vechi în cache (SW prea agresiv poate servi versiune veche).
- [ ] **DNS / HTTPS**: același domeniu canonic (**www vs non‑www**) — fără redirect-uri ciudate pe **login**, **call**, **assetlinks** (critic pentru TWA).
- [ ] **Fallback incident**: un pas clar — ex. Vercel **Redeploy previous** / rollback + **unde te uiți la loguri** (ex. Vercel Logs) când „arde”; nu trebuie monitorizare complicată, doar procedură știută.
- [ ] **Observabilitate minimă**: fără Sentry — notează unde vezi **error rate** (ex. Vercel); dacă există, **`NEXT_PUBLIC_CALL_TELEMETRY=1`** pentru evenimente call în consolă (primele ore).

---

## 1) Prod build & deploy

- [ ] Branch corect (**main** sau release) și ultimul deployment **Ready**.
- [ ] `npm run build` trece local (și în CI, dacă există).
- [ ] Fără bannere/debug în producție (`NEXT_PUBLIC_SHOW_WIP_BANNER` etc.).

## 2) Auth & URL‑uri

- [ ] OAuth / NextAuth: **callback URL‑uri de producție** (`chat.diebel.ro`), nu localhost.
- [ ] `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, redirect‑uri aliniate cu hostingul real.

## 3) TURN / WebRTC (**critic** — toate platformele)

- [ ] În prod: `TURN_REALM`, `TURN_STATIC_SECRET`, `NEXT_PUBLIC_TURN_URLS` (udp/tcp/443 după cum ai coturn), semnalizare + token.
- [ ] **Browser**: apel între două rețele diferite (Wi‑Fi ↔ 4G).
- [ ] **iOS (Safari)**: același test; verifică permisiuni cameră/mic (HTTPS obligatoriu).
- [ ] **Android (Chrome)**: același test; permisiuni + eventual comportament în **WebView** dacă deschizi linkul din altă aplicație.

## 4) Call startup UX

- [ ] Fără flash alb / meniu la intrarea în call (toate suprafețele).
- [ ] Preview local stabil; reconectare: banner + subtitlu, fără ieșire din call.

## 5) Permisiuni cameră / microfon

- [ ] **Allow** → call OK pe **iOS**, **Android** și **browser**.
- [ ] **Block** → ecran de help clar + **un CTA** (reîncearcă / instrucțiuni).

## 6) Android — Digital Asset Links (**TWA / link către app**)

- [ ] `https://chat.diebel.ro/.well-known/assetlinks.json` → **JSON**, nu HTML; **200**; **fără redirect**.

## 7) iOS — ce verifici în plus (fără `assetlinks`)

- [ ] **Safari**: site-ul e **HTTPS**; primul apel / primul ringtone poate cere gest utilizator (comportament normal).
- [ ] **PWA de pe ecranul principal**: deschidere, login, call (dacă o promiteți utilizatorilor).
- [ ] Dacă ai **link-uri universale** către o aplicație iOS nativă: `apple-app-site-association` (separat de acest proiect web) — altfel N/A.

## 8) Erori globale & 404 (încredere)

- [ ] **404** OK în **RO / EN / DE**.
- [ ] `app/error.tsx`: mesaj clar + **Încearcă din nou** + focus accesibil.

## 9) Offline / servicii indisponibile

- [ ] Fără rețea: UI nu crapă; mesaj scurt + CTA unde există fluxul.
- [ ] Backend indisponibil: mesaj util + retry — **fără stack trace** către utilizator.

## 10) Legal

- [ ] Linkuri **Termeni / Privacy / Cookies** în prod (fără 404).
- [ ] Cookie banner: apare și acțiunile merg.

## 11) Mobile / PWA (iOS + Android)

- [ ] **Tastatură**: layout **nu** taie câmpurile la login / chat.
- [ ] **Add to Home Screen** pe **iOS** și **Android**: instalare + prima deschidere + login + call smoke.

## 12) Utilizator „fresh”

- [ ] Acoperit de **Completări → „Fresh session”** (toate 3 suprafețe); dacă acolo e OK, majoritatea userilor noi sunt OK.

---

## După deploy (rapid)

- [ ] Health: `/api/health` sau `/api/healthz`.
- [ ] Plan rollback: tag/commit cunoscut, redeploy rapid (vezi **Completări → Fallback incident**).

## Post‑lansare (non‑blocant)

- [ ] Feedback pe fluxuri critice; polish incremental pe ecranele cu cele mai multe sesiuni.
