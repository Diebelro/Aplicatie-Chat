# DIEBEL — bannere în aplicație

## Unde apar

| Loc | Fișier | Componentă |
|-----|--------|------------|
| **Toate profilurile** (sub filtre) | `app/app/profiles/page.tsx` | `<DiebelAppPromoCarousel />` |
| **Descoperă** — când feed-ul afișează slide-ul `external_ad` | `app/app/page.tsx` | `<DiebelAppPromoCarousel compact hideIfPremium />` |

`AdSlot` (Google AdSense / reclamă directă) rămâne disponibil în `components/AdSlot.tsx` pentru alte integrări; slot-urile de mai sus folosesc carouselul DIEBEL.

## Componente (`components/diebel/`)

- `DiebelBannerPulse` — Pulse Media  
- `DiebelBannerFlash` — FlashVision  
- `DiebelBannerNextWave` — NextWave Digital  
- `DiebelBannerCarousel` — le rotește (fade 400ms, 4s, dots, swipe)  
- `DiebelAppPromoCarousel` — wrapper pentru app: ascunde dacă user **Premium** (`hideIfPremium`, implicit true)

## Premium

Utilizatorii cu Premium nu văd promo-ul (aliniat la „fără reclame” din planuri).

## Export static 1920×1080

Redimensionează fereastra browser + DevTools device frame la 1920×1080 și capturează zona carousel de pe **Toate profilurile** sau cardul din feed.

## Animații

Definite în `tailwind.config.ts`: `pulseLogo`, `moveDiag`, `sweep`, `diebelFlash`, `diebelSparkle`, etc.
