# Cum pui aplicația pe Google Play (Android) — pași concreti

**În repo (deja făcut în cod):** manifest PWA (`public/manifest.json`), service worker (`public/sw.js`), iconițe generate (`npm run icons:pwa` → `public/icons/*.png`), link `metadata.icons` în `app/layout.tsx`, ruta **`/.well-known/assetlinks.json`** (se completează cu env după ce ai package + fingerprint din Play). Variabile: `.env.example` secțiunea Android TWA.

**Doar tu poți face (nu e în cod):** cont Play Developer, PWABuilder → `.aab`, completări în Play Console (capturi, Data safety, rating), setare env pe Vercel pentru asset links.

Site-ul tău e **Next.js**. În Play publici un **fișier `.aab`** (Android App Bundle): o „cochilie” Android care deschide **același URL** în **Trusted Web Activity** (ca un Chrome fără bare, peste site-ul tău). Nu rescrii chat-ul în Kotlin.

**URL de producție** (exemplu): `https://chat.diebel.ro` — înlocuiește peste tot cu domeniul tău real, **HTTPS obligatoriu**.

Manifestul PWA e la `public/manifest.json` (se servește ca `https://DOMEINUL-TĂU/manifest.json`). Iconițe: `icon-*-any.png` și `icon-*-maskable.png` în `public/icons/` (vezi `npm run icons:pwa`); alias `icon-192.png` / `icon-512.png` = copii any.

---

## A. Înainte (fără asta blochezi la audit)

1. Site-ul merge în producție pe **HTTPS**.
2. În browser, deschizi `https://DOMEINUL-TĂU/manifest.json` — trebuie să vezi JSON valid (nu 404).
3. Deschizi în browser câteva URL-uri de icon (ex. `.../icons/icon-512-any.png`, `.../icons/icon-512-maskable.png`) — trebuie să se vadă corect (fundal teal solid, nu negru).
4. Ai o pagină **Privacy Policy** publică, cu URL stabil (ex. `https://DOMEINUL-TĂU/privacy`) — îl vei lipi în Play Console la **Store listing**.

---

## B. Cont și taxă Google Play

1. Mergi la **[Google Play Console](https://play.google.com/console)**.
2. Loghează-te cu cont Google.
3. Plătești **taxa de înregistrare developer** (în jur de **25 USD**, o dată — verifică suma pe site-ul Google).
4. Completezi profilul developer (nume afișat, etc.), cum cere wizard-ul.

---

## C. Generezi pachetul Android (`.aab`) cu PWABuilder

1. Deschizi **[https://www.pwabuilder.com/](https://www.pwabuilder.com/)**.
2. În câmpul mare, pui **exact** URL-ul de producție, ex. `https://chat.diebel.ro` (fără slash la final e ok).
3. Apeși butonul de **Start** / **Analyze** (depinde de versiunea UI).
4. Aștepți **raportul** (manifest, service worker, etc.). Dacă ceva e roșu: rezolvi pe site (manifest, icons, HTTPS), redeploy, reanalizezi.
5. Cauți secțiunea **Android** (meniu lateral sau card „Package for stores” / „Publish to Google Play”).
6. Alegi generarea pachetului **Android** (Bubblewrap / TWA). Urmezi pașii din PWABuilder:
   - fie **descarci un ZIP** cu proiect Android și îl construiești local cu Android Studio / Gradle,
   - fie (dacă ți-o oferă interfața) **descarci direct `.aab`** după ce completezi datele aplicației (nume pachet, signing — vezi mai jos).
7. **Rezultatul** pe care îl cauți este un fișier **`.aab`**. Acela e singurul lucru „binar” pe care îl încarci în Play (nu `.apk` pentru prima publicare bundle).

**Dacă PWABuilder îți dă doar proiect ZIP:** îl deschizi în **Android Studio** → **Build → Generate Signed Bundle / APK** → **Android App Bundle** → urmezi wizard-ul de keystore → obții `.aab` local. Prima dată, creezi un keystore (fișier `.jks`) și **îl păstrezi în loc sigur**; fără el nu poți actualiza aceeași aplicație pe Play.

**Semnare:** la prima aplicație, în Play Console poți activa **Play App Signing** și să lași Google să gestioneze cheia de upload — e varianta recomandată pentru început (detalii în Play la primul upload).

---

## D. Creezi aplicația în Play Console și încarci `.aab`

1. În Play Console: **Create app** (Creare aplicație).
2. Completezi: **nume aplicație**, **limbă implicită**, **tip** (App), **gratuit/plătit**, declari că respecți regulile.
3. În meniul stânga, mergi la **Dashboard** / **Policy** și parcurgi ce e marcat ca obligatoriu până poți publica (variază după cont).

### Primul build (recomandat: test intern, nu direct producție)

4. Meniu: **Release** → **Testing** → **Internal testing** (sau **Closed testing**).
5. **Create new release**.
6. La **App bundles**, apeși **Upload** și alegi fișierul **`.aab`** de la pasul C.
7. Note release (ex. „Prima versiune TWA”) → **Save** → **Review release** → confirmi dacă nu sunt erori.

### Listare în magazin (Store listing)

8. Meniu: **Grow** → **Store presence** → **Main store listing** (sau **Store settings** → **Main store listing**, după UI).
9. Completezi:
   - **Short description**, **Full description**;
   - **Screenshots** telefon (minim **2** pentru multe țări — fă capturi reale de pe site în Chrome pe telefon sau emulator);
   - **Icon** 512×512 (high-res icon pentru magazin — poate fi derivat din iconița ta);
   - **Privacy policy** → lipești URL-ul complet `https://chat.diebel.ro/privacy`.

### Conformitate

10. **App content**: **Privacy policy** (link), eventual **Ads** dacă ai reclame.
11. **Data safety** (foarte important): formularul unde declari **ce date** colectezi (cont, mesaje, locație, crash logs, etc.). Răspunsurile trebuie să coincidă cu aplicația și cu politica de confidențialitate. Pentru Diebel, folosește ghidul intern `docs/google-play-data-safety.md`.
12. **Content rating**: chestionar (dating, chat, user-generated content, etc.) — răspunzi sincer; primești un rating (PEGI etc.).
13. **Target audience** / **News apps** / alte întrebări — doar dacă ți le cere wizard-ul pentru categoria ta.

### Testeri și publicare

14. La **Internal testing**: adaugi **testeri** (lista de emailuri Google sau grup) în secțiunea **Testers** → salvezi.
15. Copiezi **link-ul de join** la testul intern și intri cu un cont Google pe telefon → accepti testul → după câteva minute poți instala aplicația din Play (varianta de test).
16. Când ești mulțumit: **Release** → **Production** (sau **Open testing**) → **Create new release** → încarci **același sau un `.aab` mai nou** → parcurgi review → **Start rollout to Production**.

Google **revizuiește** aplicația (de la ore la câteva zile). După aprobare, apare în magazin pentru utilizatori (sau doar pentru testeri, după canalul ales).

---

## E. La fiecare update al site-ului

- Dacă schimbi doar conținutul pe server (**fără** schimbare de domeniu / URL start): de multe ori **nu** trebuie `.aab` nou — utilizatorii primesc site-ul nou la următoarea deschidere.
- Dacă schimbi **domeniul**, **scope**-ul manifestului, sau cerințele TWA (digital asset links, etc.): probabil trebuie **`.aab` nou** și nou release pe Play. PWABuilder/Bubblewrap au documentație pentru **asset links** dacă Google îți cere verificarea domeniului.

---

## F. Opțional, dar util (starea proiectului + ce mai poți face)

### Service Worker

- **Nu e obligatoriu pentru TWA**, dar ajută la UX (instalare, notificări, „offline light” dacă extinzi cache-ul).
- **La voi e deja:** `public/sw.js` (push apel, lifecycle) + înregistrare din `ServiceWorkerAndPush` / `PwaServiceWorkerRegister`. Nu trebuie să „adaugi” ceva ca să fii valid pentru Play; e deja un **plus**. Opțional ulterior: cache controlat pentru pagini statice — nu blocant.

### Iconițe maskable vs any

- **La voi:** manifestul are **patru** intrări: `purpose: "any"` și `purpose: "maskable"` pe fișiere **separate** (`icon-*-any.png` / `icon-*-maskable.png`). Regenerare: **`npm run icons:pwa`** — vezi `public/icons/README.md` și `scripts/generate-pwa-icons.mjs`.

### Camera / microfon în Play Console

- Când ți se cere explicație pentru **permisiuni sensibile** (sau în **Data safety** / declarații de funcții): text **scurt, factual**, aliniat cu produsul.
- Evită marketing vag sau funcții pe care nu le ai — risc de **respingere** la review.

**Texte gata de adaptat (RO):**

- *Microfon / cameră:* „Aplicația folosește microfonul și camera **doar pentru apeluri audio și video** între utilizatori, în timpul unui apel activ, după ce browserul cere permisiunea explicită. Nu înregistrăm convorbiri pe server pentru acest scop.”
- *Locație (dacă o declari în Data safety):* „Locația e folosită **doar dacă utilizatorul o permite** în browser, pentru funcțiile din aplicație (ex. hartă / potriviri în zonă), conform politicii de confidențialitate.”

### Înainte de `.aab`: doar URL de producție

- **Foarte important:** rulezi PWABuilder și testezi manual **același host** care va sta în TWA — ex. **`https://chat.diebel.ro`**, nu un URL **Vercel Preview** (`*.vercel.app`) și nu `localhost`, decât dacă știi exact că vei publica acel preview (nu e cazul uzual).
- Motive: manifest, cookies, `NEXTAUTH_URL`, asset links, icon paths — trebuie să coincidă cu ce văd utilizatorii. După ce verifici login, apel, mesaje pe **producție**, generezi `.aab`.

---

## G. Digital Asset Links (automat în cod; completezi env după Play)

După ce ai primul build în **Play Console** → **App integrity** (sau **Setup** → **App signing**): copiezi **App signing key certificate** → **SHA-256 certificate fingerprint** și **package name**-ul din proiectul Android (Bubblewrap / PWABuilder).

Pe **Vercel** (sau hostul tău), setezi:

- `ANDROID_TWA_PACKAGE_NAME` — exact `applicationId` din `build.gradle` (ex. `ro.diebel.chat.twa`).
- `ANDROID_TWA_SHA256_FINGERPRINTS` — unul sau mai mulți fingerprint-uri SHA-256, separați prin **virgulă** (cu sau fără `:` între octeți).

Aplicația servește **`GET /.well-known/assetlinks.json`** din `app/.well-known/assetlinks.json/route.ts`. Verifică în browser:

`https://DOMEINUL-TĂU/.well-known/assetlinks.json`

Trebuie să vezi un JSON cu `relation`, `target.package_name` și `sha256_cert_fingerprints` — **nu** lista goală `[]`. Cât timp env lipsește, răspunsul e `[]` (valid, dar **nu** verifică domeniul pentru TWA).

---

## Rezumat într-o propoziție

**Pregătești HTTPS + manifest + privacy → PWABuilder cu URL-ul live → obții `.aab` → Play Console: app nou, internal test, store listing + Data safety + rating, upload `.aab`, rollout.**

Dacă te blochezi la un pas anume (ex. doar ZIP, nu `.aab`, sau eroare la upload), notează **mesajul exact** din Play sau PWABuilder și caută după el — de obicei e keystore, versiune `versionCode`, sau manifest incomplet.
