
## 1. Protecție cod client

- **Obfuscation**: Build-ul de producție folosește minificare (SWC), `compress: true`, fără source maps (`productionBrow# Măsuri de securitate – Align
serSourceMaps: false`). În producție, `console.log` / `console.debug` / `console.info` sunt eliminate (`compiler.removeConsole`); rămân doar `error` și `warn`.
- **React DevTools și __NEXT_DATA__**: În producție, componenta `DisableDevTools` elimină `__REACT_DEVTOOLS_GLOBAL_HOOK__` și, după hydration, limitează expunerea `__NEXT_DATA__` din `window`.

## 2. Protecție resurse interne

- **URL-uri semnate**: Toate imaginile interne și resursele premium sunt servite prin `/api/media?s=TOKEN`, unde `TOKEN` este generat cu `lib/signedUrls.ts` (HMAC, expirare). Secret: `SIGNED_URL_SECRET` (doar server).
- **Niciun asset premium în /public**: Directorul `public` nu trebuie să conțină resurse premium sau date sensibile. Resursele premium sunt servite exclusiv prin API cu URL semnat; nu pune fișiere premium (imagini plătite, conținut exclusiv) în `public`.

## 3. Protecție API

- **Rate limiting**: `lib/rateLimit.ts` – limite stricte per IP, userId și endpoint (ex. `/api/swipe`, `/api/feed`, auth).
- **Header-e obligatorii**: Middleware-ul cere pentru rutele API protejate: `x-user-id`, `x-session-token`, `x-device-id`. Request-urile fără aceste header-e sunt respinse cu 401.
- Rutele publice (login, signup, reset password, `/api/media` cu token, etc.) sunt exceptate în `middleware.ts`.

## 4. Anti-bot

- **Swipe-uri prea rapide**: În `app/api/swipe/route.ts` se folosește `canPerformLike` (limită de likes per fereastră de timp). Depășirea → `recordSuspiciousBehavior` și 429.
- **Device blocat**: După un număr de incidente (prag în `lib/deviceBlock.ts`), device-ul este blocat; request-uri ulterioare cu acel device → 403.
- **Log evenimente suspecte**: `lib/deviceBlock.ts` păstrează un log de evenimente (`SuspiciousEventLog`: fast_swipe, blocked_device_access, automated_behavior etc.). Funcția `getSuspiciousEventsLog()` poate fi folosită pentru analiză (ex. endpoint admin). Log-ul este în memorie; pentru producție se poate persista în Redis/DB.

## 5. Protecție server și build

- **Firewall**: Asigură-te că pe server sunt deschise doar porturile necesare (ex. 443/80 pentru aplicație; nu expune porturi de debug sau servicii interne în afară).
- **ENV**: Doar variabilele `NEXT_PUBLIC_*` sunt expuse la client. `SIGNED_URL_SECRET`, `RECAPTCHA_SECRET_KEY`, parole, API keys etc. rămân doar pe server (nu le prefixa cu `NEXT_PUBLIC_`).
- **Logică critică pe server**: Feed, intervale, match și premium sunt implementate în API-uri și pe server; nu există logică critică duplicată doar în client.

## 6. Protecție UI și legală

- **Watermark invizibil**: Componenta `Watermark` include un hash unic per build (`NEXT_PUBLIC_BUILD_HASH`) plus identificator (userId/anon și dată) în `data-watermark` / `data-build`, pentru protecție legală și audit.
- **Termeni și condiții**: Secțiunea „8. Interdicții tehnice” (RO/EN/DE) interzice explicit: reverse engineering, scraping, copierea UI/UX, reproducerea logicii aplicației și utilizarea de boturi/scripturi.

---

Pentru semnarea URL-urilor, seteză în producție `SIGNED_URL_SECRET` (min. 16 caractere) și nu folosi același secret în alte medii.
