INDEX.md (versiunea finală, completă)
Document oficial – versiunea 1.1

1. Rolul documentului INDEX
Acest document servește ca punct de intrare în întreaga documentație a proiectului. El oferă o imagine clară, structurată și completă asupra tuturor modulelor, sistemelor și regulilor care definesc arhitectura aplicației. INDEX.md este „manualul general” al platformei și trebuie citit înaintea oricărui alt fișier.

2. Structura completă a documentației
Documentația este împărțită în patru secțiuni principale:

Arhitectură

Securitate

Procese interne

Legal

Fiecare secțiune conține documente oficiale, independente, dar interconectate.

3. Arhitectură (7 documente)
3.1 ARCHITECTURE_OVERVIEW.md
Descrierea completă a arhitecturii aplicației, module, fluxuri, responsabilități și interacțiuni.

3.2 FEED_ENGINE.md
Logica server-side pentru generarea feed-ului, filtre, sortare, protecție anti-scraping.

3.3 SWIPE_ENGINE.md
Procesarea swipe-urilor, validări, rate limiting, detectare comportament suspect.

3.4 MATCH_ENGINE.md
Crearea match-urilor, reguli de reciprocitate, tranzacții atomice, protecție anti-abuz.

3.5 PREMIUM_ENGINE.md
Reguli premium, abonamente, premium temporar, rewarded ads, limite, protecție conversie.

3.6 PROFILE_SYSTEM.md
Structura profilului, validări, poze, vizibilitate, integrare cu feed/swipe/match.

3.7 VIDEO_CALLS.md
Documentul oficial pentru apeluri video 1:1, integrare Jitsi, configurare domeniu propriu, TURN, scalare, recomandări de producție și extensibilitate.

4. Securitate (5 documente)
4.1 SECURITY_IMPLEMENTATION.md
Implementarea completă a securității aplicației, reguli globale, protecție cod, anti-reverse engineering.

4.2 API_SECURITY_RULES.md
Reguli obligatorii pentru toate endpoint-urile API: headere, rate limiting, validări, răspunsuri.

4.3 ANTI_BOT_SYSTEM.md
Detectare comportament automatizat, blocări device, logging, protecție feed/swipe.

4.4 BUILD_SECURITY.md
Reguli pentru build: eliminare sourcemaps, DevTools, console.log, watermark invizibil.

4.5 URL_SIGNING.md
Protecția media prin URL-uri semnate, expirare, semnături criptografice, integrare CDN.

5. Procese interne (2 documente)
5.1 BUILD_AND_DEPLOY.md
Pipeline complet de build și deploy, staging, producție, rollback, verificări.

5.2 SYSTEM_OPERATIONS.md (opțional)
Reguli pentru mentenanță, monitorizare, alerte, rotație chei.

6. Legal (1 document)
6.1 LEGAL_PROTECTION.md
Protecție juridică împotriva copierii, scraping-ului, clonării aplicației, GDPR, termeni și condiții.

7. Relațiile dintre documente
Documentele sunt independente, dar conectate:

Feed, Swipe, Match, Premium, Profile → depind de API_SECURITY_RULES.md

Pozele → depind de URL_SIGNING.md

Comportamentul utilizatorilor → depinde de ANTI_BOT_SYSTEM.md

Build-ul final → depinde de BUILD_SECURITY.md

Deploy-ul → depinde de BUILD_AND_DEPLOY.md

Protecția legală → depinde de LEGAL_PROTECTION.md

INDEX.md este centrul care le unește.

8. Cum se folosește documentația
Ordinea recomandată pentru un developer nou:

INDEX.md

ARCHITECTURE_OVERVIEW.md

SECURITY_IMPLEMENTATION.md

API_SECURITY_RULES.md

ANTI_BOT_SYSTEM.md

Modulele individuale (Feed, Swipe, Match, Premium, Profile, Video Calls)

BUILD_SECURITY.md

BUILD_AND_DEPLOY.md

URL_SIGNING.md

LEGAL_PROTECTION.md

9. Extensibilitate
Documentația este construită pentru:

scalare în Europa

audit legal

onboarding rapid pentru developeri

integrare cu noi module

microservicii viitoare

protecție împotriva competitorilor