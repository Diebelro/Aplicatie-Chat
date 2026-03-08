SECURITY_IMPLEMENTATION.md
(Document oficial – versiunea 1.0)

1. Protecție cod client
productionBrowserSourceMaps: false în next.config.js pentru a elimina sourcemaps în producție.

compiler.removeConsole activ în producție (păstrează doar error și warn).

Codul de producție este minificat prin SWC.

Dezactivare React DevTools prin suprascrierea __REACT_DEVTOOLS_GLOBAL_HOOK__.

După ~2.5 secunde de la mount, __NEXT_DATA__ este eliminat din window și înlocuit cu un getter care returnează {}.

2. Protecție resurse interne
Toate imaginile interne și resursele premium sunt servite exclusiv prin URL-uri semnate cu expirare (/api/media?s=..., lib/signedUrls.ts).

Regula oficială: niciun asset premium nu este permis în /public.

Toate resursele premium trebuie accesate doar prin API.

3. Protecție API
Rate limiting activ pe IP, userId și endpoint.

Middleware care cere obligatoriu headerele:

x-user-id

x-session-token

x-device-id

Request-urile fără aceste headere sunt respinse automat cu 401.

4. Anti‑bot
Detectare swipe-uri imposibil de rapide → fast_swipe → răspuns 429.

Blocare device pentru comportament automatizat → blocked_device_access → 403.

Log complet pentru evenimente suspecte în lib/deviceBlock.ts:

SuspiciousEventLog

SuspiciousEventReason (fast_swipe, rate_limit_swipe, blocked_device_access, automated_behavior)

logSuspiciousEvent()

recordSuspiciousBehavior(..., meta)

getSuspiciousEventsLog() (ultimele ~5000 evenimente)

5. Protecție server & build
Firewall: doar porturile necesare sunt permise.

Variabile ENV: doar NEXT_PUBLIC_* sunt expuse clientului.

Toată logica critică (feed, intervale, match, premium) rulează exclusiv pe server.

Nicio variabilă sensibilă nu este expusă către client.

6. Protecție UI & legală
Watermark invizibil cu hash unic per build:

NEXT_PUBLIC_BUILD_HASH generat în next.config.js.

Watermark.tsx inserează data-watermark și data-build.

Termeni și condiții actualizați (RO / EN / DE), secțiunea 8:

interdicții pentru reverse engineering

scraping

copiere UI/UX

reproducerea logicii aplicației

utilizarea de boți/scripturi

7. Fișiere modificate / create
next.config.js

components/DisableDevTools.tsx

components/Watermark.tsx

lib/deviceBlock.ts

app/api/swipe/route.ts

lib/i18n/legalContent.ts

SECURITY.md (documentație generală de securitate)