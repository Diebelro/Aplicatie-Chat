# Cum pui Align pe Google Play (Android)

Aplicația ta e un **site Next.js**. Pe Play Store se publică de obicei un **pachet Android** (.aab) care deschide același site într-un „browser” integrat (Trusted Web Activity / WebView). Nu rescrii aplicația în Kotlin.

## 1. Ce îți trebuie înainte

| Cerință | Detalii |
|--------|---------|
| **URL public HTTPS** | Ex.: Vercel + domeniu `https://chat.diebel.ro` (sau alt domeniu). Fără HTTPS, Play și PWA nu merg corect. |
| **Variabile de mediu pe producție** | `DATABASE_URL`, `NEXTAUTH_*`, Blob pentru poze, etc. (vezi `.env.example`). |
| **Politică de confidențialitate** | O pagină publică cu URL (obligatoriu pentru aplicații care colectează date utilizatori). |
| **Cont Google Play Developer** | Taxă unică ~**25 USD** (verifică pe site-ul Google). |

## 2. PWA (site „ca aplicație”)

- În proiect există `app/manifest.ts` (Web App Manifest): nume, culori, `display: standalone`.
- Adaugă **iconițe PNG** în `public/icons/`: minim **192×192** și **512×512** (maskable recomandat). Actualizează căile în `manifest.ts` dacă folosești alte nume.
- Opțional dar util: **service worker** (ex. `next-pwa` sau manual) pentru cache offline ușor; PWABuilder/TWA funcționează și fără, dar instalarea „ca app” e mai bună cu el.

## 3. Din site → pachet pentru Play

Cea mai simplă rută fără să scrii Android:

1. Deschide **[PWABuilder](https://www.pwabuilder.com/)** (Microsoft).
2. Introdu URL-ul producției (ex. `https://chat.diebel.ro`).
3. Rulează auditul; rezolvă ce lipsește (manifest, icons, HTTPS).
4. Secțiunea **Android** → generează proiectul **Bubblewrap** / pachetul care îți dă fișier **`.aab`** (Android App Bundle).
5. Încarcă `.aab`-ul în **Google Play Console** → creare aplicație nouă → testare internă / producție.

Alternativ: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) din linia de comandă (aceeași idee: TWA peste URL-ul tău).

## 4. În Play Console

- **Titlu, descriere, capturi de ecran** (telefon, eventual tabletă).
- **Clasificare conținut** (întrebări despre chat, dating, locație, etc.).
- **Data safety** (ce date colectezi: cont, mesaje, locație… — trebuie să coincidă cu realitatea și cu politica de confidențialitate).
- **Semnare aplicație**: Play poate gestiona cheia (recomandat la început).

## 5. Ce nu poate face „codul” din repo

- Crearea contului Google Play și plata taxei.
- Generarea token-urilor Vercel Blob / Neon din panoul lor.
- Publicarea în magazin în locul tău (doar tu ai acces la cont).

## Rezumat

1. Pune site-ul live, stabil, cu HTTPS.  
2. Completează manifest + iconițe (și ideal service worker).  
3. PWABuilder → Android → `.aab`.  
4. Play Console + politică de confidențialitate + date safety.  

Dacă voiai **hartă / locație în aplicație**: ai deja flux de locație în app; pe Play doar descrii corect în Data safety că folosești locație (dacă e cazul).
