# UI/UX audit — overflow, overlap, flex, safe-area, z-index, translucență

**Domeniu:** `align-app` (Next.js App Router)  
**Data audit:** 2026-04-12  
**Metodă:** căutări globale (`fixed`, `sticky`, `backdrop-blur`, `safe-area`, `z-`, `min-w-0`, etc.) + citire țintă a shell-ului `/app`, cookie, apel, discover, chat.  
**Reguli:** nu s-a modificat niciun fișier sursă în afara acestui document; **nu aplica** dif-urile din secțiunea „Proposed diffs” până la ordin explicit **APLICĂ**.

---

## Rezumat executiv (max 10 puncte)

1. **Cookie banner vs. bottom nav (P0/P1):** `CookieConsentBanner` e `fixed bottom-0` cu `z-[100]`; bara mobilă din `app/app/layout.tsx` e `z-30` — până la consimțământ, cookie-ul **acoperă** navigația Discover/Mesaje/Match.
2. **Footer după shell-ul `h-dvh` (P1):** În `Providers.tsx`, `<Footer />` e **frate** după `{children}`; pentru `/app/*`, layout-ul e `h-dvh` + `overflow-hidden`, dar footer-ul adaugă înălțime la `body` → posibil **scroll pe document** în plus față de zona de conținut din app.
3. **Header app translucid (P2):** `bg-dark-900/95 backdrop-blur` — pe Android poate „lăsa să se vadă” conținutul la scroll; bara de jos a fost deja întărită (`bg-dark-900` solid).
4. **Mismatch safe-area orizontal (P1):** `<main>` folosește `pl/pr` cu `env(safe-area-inset-*)`; rândul interior al `<header>` (`max-w-4xl mx-auto px-4`) **nu** repetă același padding lateral — pe iPhone în landscape / notch, header-ul și conținutul pot fi **ușor dezaliniate**.
5. **`pb-24` magic vs. înălțime nav (P2):** Spațiul pentru bottom nav e hardcodat; dacă se schimbă înălțimea nav + safe-area, risc de **prea mult / prea puțin** padding sub conținut.
6. **Layering z-index eterogen (P1):** Multe valori (`z-20`, `z-[100]`, `z-[200]`, `z-[215]`, `z-[220]`, `z-[9999]`, `z-[10050]`) fără document central — risc de **inversări** când se adaugă un modul nou.
7. **`LanguageSwitcher` la `z-[100]` (P2):** Același ordin ca `CookieConsentBanner` — depinde de ordinea în DOM; meniul limbii poate apărea **sub** alte overlay-uri cu același z.
8. **`CallUI` toolbar conferință (P2):** `bg-night-950/90` + elemente cu `backdrop-blur-sm` — conținut video poate „sângera” vizual prin chrome; acceptabil pentru overlay video, dar inconsistent cu regula „chrome solid” pe app shell.
9. **Discover (`app/page.tsx`) (P2):** Rădăcina return `flex flex-col items-center w-full` fără `min-w-0` — în scenarii cu card/flex copil lat, risc redus dar **clasic** pentru overflow orizontal.
10. **`InLucruBanner` `z-[9999]` (P2):** Dacă env e activ, ascunde tot; intenționat pentru WIP, dar documentează ca **excepție** la orice ierarhie viitoare.

---

## Inventar „chrome” fix / semi-fix

| Element | Fișier (aprox.) | Tip | z-index | Safe-area | Fundal |
|--------|------------------|-----|---------|-----------|--------|
| Header `/app` | `app/app/layout.tsx` ~373 | `sticky` | `z-20` | doar `.safe-area-inset-top` pe header | `bg-dark-900/95` + blur |
| Bottom nav mobil | `app/app/layout.tsx` ~536 | `fixed` | `z-30` | `paddingBottom` inline + clasă `safe-area-inset-bottom` | `bg-dark-900` solid |
| Meniu mobil dropdown | `app/app/layout.tsx` ~473 | în header | — | nu explicit stânga/dreapta | `bg-dark-900` |
| Match toast | `app/app/layout.tsx` ~604 | `fixed` | `z-50` | `bottom-24` (evită nav) | `bg-brand-500/95` |
| Modal match Discover | `app/app/page.tsx` ~460 | `fixed inset-0` | `z-50` | `p-4` | `bg-black/60` |
| Dialog locație chat | `app/app/chat/[id]/page.tsx` ~958 | `fixed` | `z-[100]` | `p-4` | `bg-black/40` + blur |
| Overlay apel / CallUI | `components/CallUI.tsx` ~801, 1086 | `fixed inset-0` | `z-[200]` | parțial în subcomponente | negru / gradient |
| Incoming call | `components/IncomingCall.tsx` ~246 | `fixed` | `z-[220]` | `p-6` | `bg-night-900` |
| Lightbox poze | `components/ProfilePhotoLightbox.tsx` ~148 | portal `fixed` | `z-[215]` | `pt`/`pb` cu safe-area în zone | negru |
| Call room gate | `app/app/call/[roomId]/page.tsx` ~232–296 | `fixed` | `z-[190]`–`z-[200]` | variabil | negru / gradient |
| Cookie banner | `components/CookieConsent/CookieConsentBanner.tsx` ~40 | `fixed bottom-0` | `z-[100]` | de verificat în fișier complet | `bg-dark-900/98` + blur |
| Cookie modal | `components/CookieConsent/CookieConsentModal.tsx` ~60 | `fixed` | `z-[10050]` | `p-4` | `bg-black/60` + blur |
| Cookie floating | `components/CookieConsent/CookieConsentFloatingButton.tsx` ~32 | `fixed` | `z-[10040]` | `bottom-4 right-4` | `bg-dark-800/90` + blur |
| LanguageSwitcher menu | `components/LanguageSwitcher.tsx` ~74 | `absolute` | `z-[100]` | — | transparent |
| Setări cont modal | `app/app/settings/account/page.tsx` ~457 | `fixed` | `z-50` | `p-4` | `bg-black/70` |
| Review swipes modal | `app/app/review-swipes/page.tsx` ~135 | `fixed` | `z-50` | `p-4` | `bg-black/60` |
| WIP banner | `components/InLucruBanner.tsx` ~12 | `sticky` | `z-[9999]` | — | translucid + blur |
| Watermark | `components/Watermark.tsx` ~41 | `fixed` | `zIndex: -1` | — | invizibil |

---

## Probleme identificate (detaliat)

### P0-1 — Cookie banner ascunde bottom nav până la consimțământ

- **Severitate:** P0 (blochează navigarea principală pe mobil).
- **Fișier:** `components/CookieConsent/CookieConsentBanner.tsx` (linie ~40), `app/app/layout.tsx` (nav ~536).
- **Repro:** Mobile Chrome/Safari, cont nou sau cookies șterse, navighează la `/app` sau `/app/messages`. Banner cookie acoperă întreaga lățime jos, peste Discover/Mesaje/Match.
- **Cauză probabilă:** `z-[100]` > `z-30`, ambele `fixed bottom-0`, același strat vizual.
- **Recomandare (fără a aplica):** Ridică nav la `z-[110]` doar când cookie e vizibil **sau** mută cookie deasupra nav cu layout flex column **sau** ascunde bottom nav când bannerul e deschis (cu padding compensator) — decizie produs + GDPR.

### P1-1 — Footer în flux după `h-dvh` app shell

- **Severitate:** P1 (scroll dublu / conținut „sub” viewport pe unele telefoane).
- **Fișier:** `components/Providers.tsx` (~31–35), `app/app/layout.tsx` (~372 `h-dvh`).
- **Repro:** `/app/messages`, scroll până jos pe **body** (nu doar în `main`); observă dacă apare footer legal sub shell.
- **Cauză:** `children` = shell fullscreen; `Footer` e sibling, mărește înălțimea documentului.
- **Recomandare:** Ascunde `Footer` pentru `pathname.startsWith("/app")` (similar admin) sau integrează linkurile legale doar în shell-ul `/app`.

### P1-2 — Safe-area orizontal: `main` vs `header` inner

- **Severitate:** P1 (dezaliniere subțire pe notch).
- **Fișier:** `app/app/layout.tsx` — `main` ~515–518 vs header inner ~374 (`px-4` fără `max(..., env(safe-area-inset-left))`).
- **Repro:** iPhone 14+, landscape, compară marginea stângă a logo-ului cu marginea listei din `main`.
- **Cauză:** Padding lateral diferit între chrome și conținut.

### P1-3 — Z-index: același `z-[100]` pentru cookie și dialog chat

- **Severitate:** P1 (edge case: ordine paint / focus trap).
- **Fișiere:** `CookieConsentBanner.tsx`, `app/app/chat/[id]/page.tsx` (~958).
- **Repro:** Rar: deschide dialog locație în chat în timp ce banner cookie e vizibil (sesiune fără consimțământ).
- **Cauză:** Valori duplicate fără ierarhie documentată.

### P1-4 — `MatchToast` `z-50` sub cookie (`z-100`) și sub nav viitor dacă nav crește

- **Severitate:** P1 (toast de match poate fi acoperit).
- **Fișier:** `app/app/layout.tsx` ~604–607.
- **Repro:** Match nou + cookie banner activ.
- **Cauză:** ierarhie z mai mică decât cookie.

### P2-1 — Header translucid (`bg-dark-900/95` + blur)

- **Severitate:** P2 (cosmetic / inconsistent cu bottom nav solid).
- **Fișier:** `app/app/layout.tsx` ~373.
- **Repro:** Scroll rapid sub header pe Android.
- **Cauză:** translucență + blur variabil pe GPU.

### P2-2 — `pb-24` magic pentru offset bottom nav

- **Severitate:** P2 (fragil la schimbări de design).
- **Fișier:** `app/app/layout.tsx` ~517.
- **Repro:** Schimbă înălțimea nav; observă gap sau suprapunere cu ultimul rând.
- **Cauză:** fără token CSS `--app-mobile-nav-height`.

### P2-3 — Discover root fără `min-w-0`

- **Severitate:** P2 (overflow orizontal rar).
- **Fișier:** `app/app/page.tsx` ~458.
- **Repro:** Viewport îngust + conținut flex lat în card.
- **Cauză:** flex item default `min-width: auto`.

### P2-4 — CallUI / bară controale `bg-night-950/90`, chip-uri cu blur

- **Severitate:** P2 (acceptabil în context video; menționat pentru consistență).
- **Fișier:** `components/CallUI.tsx` (ex. ~921, ~1284).
- **Repro:** Apel video, observă banner-uri peste video.
- **Cauză:** design overlay intenționat.

### P2-5 — Pagini marketing / legal: header `sticky` translucid

- **Severitate:** P2.
- **Fișiere:** `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/cookies/page.tsx`, `components/HomePageContent.tsx` — pattern similar `bg-dark-900/95 backdrop-blur`.

### P2-6 — `CookieConsentFloatingButton` `h-10 w-10` (40px)

- **Severitate:** P2 (sub guideline 48px tap target).
- **Fișier:** `components/CookieConsent/CookieConsentFloatingButton.tsx` ~32.

---

## Plan de fix (fără aplicare)

### Principii

- **Chrome fix app (`/app`):** prefer `bg-dark-900` (sau token) **fără** `/95` + fără blur pe header când vrei paritate cu bottom nav.
- **Safe-area:** aceeași formulă `pl-[max(1rem,env(safe-area-inset-left,0px)))]` pe **header inner** și pe **main** (sau wrapper unic).
- **Padding scroll:** `pb-[calc(var(--app-nav-mobile-h)+env(safe-area-inset-bottom,0px))]` cu `--app-nav-mobile-h` setat o dată (sau măsurat cu `ResizeObserver` — doar dacă e nevoie).
- **Z-index:** tabel mic documentat: `shell < toast match < modal app < incoming call < lightbox < cookie modal`; evită duplicate `100`.
- **NU modifica:** fluxul de consimțământ (logică cookie), rutele nav, business swipe/match, WebRTC.

### Ce NU atinge planul

- Logica `useWebRtcCall`, API-uri, Prisma, semnalizare.
- Texte legale fără review conținut.
- Structura rutelor `/app/*`.

---

## Proposed diffs (text only — **NU aplica**)

### Diff A — P0/P1 cookie vs nav (exemplu: ridică nav când cookie există; varianta minimală e doar z-index)

```diff
--- a/app/app/layout.tsx
+++ b/app/app/layout.tsx
@@ -533,7 +533,7 @@
       <nav
-        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex …"
+        className="md:hidden fixed bottom-0 left-0 right-0 z-[110] flex …"
```

*Notă:* ridicarea nav peste cookie poate încălci UX legal; alternativă mai sigură: ascunde nav când `!hasConsented` (necesită context cookie în layout — mai mult cod).

### Diff B — P1 footer ascuns în `/app`

```diff
--- a/components/Providers.tsx
+++ b/components/Providers.tsx
 function SiteFooter() {
   const pathname = usePathname();
   if (pathname?.startsWith("/admin")) return null;
+  if (pathname?.startsWith("/app")) return null;
   return <Footer />;
 }
```

### Diff C — P1 safe-area consistent pe header inner

```diff
--- a/app/app/layout.tsx
+++ b/app/app/layout.tsx
-        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
+        <div className="max-w-4xl mx-auto py-3 flex items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
```

### Diff D — P2 header solid (aliniat cu bottom nav)

```diff
--- a/app/app/layout.tsx
+++ b/app/app/layout.tsx
-      <header className="… bg-dark-900/95 backdrop-blur z-20 …">
+      <header className="… bg-dark-900 border-b border-dark-600 z-20 …">
```

*(Elimină `backdrop-blur` și opacitatea `/95`.)*

### Diff E — P2 Discover root `min-w-0`

```diff
--- a/app/app/page.tsx
+++ b/app/app/page.tsx
-    <div className="flex flex-col items-center w-full">
+    <div className="flex flex-col items-center w-full min-w-0 max-w-full">
```

### Diff F — P2 LanguageSwitcher deasupra cookie (exemplu)

```diff
--- a/components/LanguageSwitcher.tsx
+++ b/components/LanguageSwitcher.tsx
-          className={`absolute ${menuPosition} z-[100] flex …`}
+          className={`absolute ${menuPosition} z-[120] flex …`}
```

### Diff G — P2 Cookie banner fundal solid

```diff
--- a/components/CookieConsent/CookieConsentBanner.tsx
+++ b/components/CookieConsent/CookieConsentBanner.tsx
-      className="… bg-dark-900/98 backdrop-blur-lg …"
+      className="… bg-dark-900 border-t border-dark-600 …"
```

### Diff H — P2 floating cookie: tap target + solid

```diff
--- a/components/CookieConsent/CookieConsentFloatingButton.tsx
+++ b/components/CookieConsent/CookieConsentFloatingButton.tsx
-        className="fixed bottom-4 right-4 z-[10040] flex h-10 w-10 … bg-dark-800/90 … backdrop-blur-sm …"
+        className="fixed bottom-4 right-4 z-[10040] flex h-12 w-12 min-h-[48px] min-w-[48px] … bg-dark-800 …"
```

### Diff I — P1 z-index dialog chat peste cookie (doar layering)

```diff
--- a/app/app/chat/[id]/page.tsx
+++ b/app/app/chat/[id]/page.tsx
-          className="fixed inset-0 z-[100] flex …"
+          className="fixed inset-0 z-[120] flex …"
```

---

## Gate

**Nu aplica** niciun diff din acest document până când stakeholder-ul scrie explicit **APLICĂ** (și ideal specifică ce dif-uri: A–I sau subset).

---

## Fișiere atinse de căutări (referință rapidă)

- Shell: `app/app/layout.tsx`
- Discover: `app/app/page.tsx`
- Chat: `app/app/chat/[id]/page.tsx`
- Apel: `components/CallUI.tsx`, `app/app/call/[roomId]/page.tsx`, `components/IncomingCall.tsx`
- Cookie: `components/CookieConsent/*.tsx`, `components/Providers.tsx`
- Lightbox: `components/ProfilePhotoLightbox.tsx`
- Globals safe-area: `app/globals.css` (`.safe-area-inset-top`, `.safe-area-inset-bottom`)
- Altele: `components/InLucruBanner.tsx`, `app/app/settings/account/page.tsx`, `app/app/review-swipes/page.tsx`, pagini `terms` / `privacy` / `cookies`.
