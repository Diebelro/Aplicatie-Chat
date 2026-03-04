ARCHITECTURE_OVERVIEW.md
(Document oficial – versiunea 1.0)

1. Viziune generală
Aplicația este un ecosistem de dating premium construit pe Next.js (App Router), cu logică critică rulată exclusiv pe server, securitate strictă, anti‑bot avansat și un sistem modular care permite scalare rapidă în Europa. Arhitectura este împărțită în module independente, fiecare cu responsabilități clare.

2. Structura principală a proiectului
Next.js App Router pentru routing modern, server components și API routes în app/api/*.

Logică critică pe server pentru feed, swipe, match, premium, URL signing și device-blocking.

UI client-side cu componente React optimizate, fără logică sensibilă.

Prisma + Postgres pentru baza de date.

Straturi dedicate pentru securitate, anti‑bot și legal.

Sistem modular pentru scalare rapidă și adăugare de funcționalități noi.

3. Module arhitecturale
3.1 Feed Engine
Generează feed-ul personalizat pentru fiecare utilizator.

Rulare exclusiv pe server.

Filtre: distanță, preferințe, vârstă, vizibilitate, blocări.

Limitare feed pentru performanță.

Acces permis doar cu headere valide.

3.2 Swipe Engine
Gestionează swipe-urile și interacțiunile rapide.

Validare device-id, session-token și user-id.

Detectare swipe-uri prea rapide → fast_swipe.

Rate limiting per endpoint.

Logging pentru comportament suspect.

3.3 Match Engine
Creează match-uri atunci când două persoane se plac reciproc.

Verificare swipe anterior.

Creare match atomică în DB.

Prevenire match-uri duplicate sau false.

3.4 Premium Engine
Controlează accesul la funcții premium.

Verificare abonament activ.

Rewarded ads → premium temporar.

Limitări pentru utilizatori non-premium.

Toate regulile sunt pe server.

3.5 Profile System
Gestionează profilul utilizatorului.

Poze servite doar prin URL-uri semnate.

Setări de vizibilitate.

Interese, bio, preferințe.

Validări stricte pe server.

4. API Architecture
4.1 Reguli generale
Toate endpoint-urile API cer obligatoriu:

x-user-id

x-session-token

x-device-id

Fără aceste headere → 401 Unauthorized.

4.2 Rate limiting
Aplicat pe:

IP

userId

endpoint

4.3 Endpoint-uri critice
/api/feed — generează feed-ul.

/api/swipe — procesează swipe-uri.

/api/match — creează match-uri.

/api/media — servește imagini premium prin URL-uri semnate.

5. Anti‑Bot Architecture
Sistemul anti‑bot include:

detectare swipe-uri imposibil de rapide

detectare comportament automatizat

blocare device

logging complet în lib/deviceBlock.ts

endpoint intern pentru analiză (admin)

Evenimente logate:

fast_swipe

rate_limit_swipe

blocked_device_access

automated_behavior

6. Security Architecture
6.1 Client-side protection
Dezactivare DevTools.

Eliminare __NEXT_DATA__ după hydration.

Eliminare console.log în producție.

Cod minificat și fără sourcemaps.

6.2 Server-side protection
Nicio logică critică în client.

Nicio variabilă sensibilă expusă.

Firewall + ENV strict.

6.3 Media protection
Niciun asset premium în /public.

Toate resursele premium → URL-uri semnate cu expirare.

6.4 Legal protection
Watermark invizibil cu hash unic per build.

Termeni și condiții cu interdicții clare:

reverse engineering

scraping

copiere UI/UX

reproducerea logicii aplicației

boți/scripturi

7. Build & Deployment Architecture
Build hash generat automat.

ENV separat pentru client/server.

Deploy pe infrastructură cu firewall strict.

CDN pentru media servită prin URL-uri semnate.

8. Extensibilitate și scalare
Arhitectura permite:

lansare rapidă în alte țări (RO → DE → EU)

adăugare module noi (Events, Groups, Stories)

integrare plăți premium

integrare WebRTC pentru video calls

scalare orizontală a API-ului