ANTI_BOT_SYSTEM.md
(Document oficial – versiunea 1.0)

1. Rolul sistemului anti‑bot
Sistemul anti‑bot protejează aplicația împotriva comportamentului automatizat, scraping‑ului, fraudelor și abuzurilor. Este unul dintre cele mai sensibile module, deoarece afectează direct calitatea utilizatorilor, siguranța platformei și integritatea datelor. Toată logica rulează exclusiv pe server și este imposibil de ocolit din client.

2. Principii fundamentale
Fiecare acțiune critică (feed, swipe, match, premium) este monitorizată.

Device‑ul este tratat ca identitate tehnică primară.

Comportamentul este analizat în timp real.

Evenimentele suspecte sunt logate și pot declanșa blocări.

Nicio regulă anti‑bot nu este expusă în client.

Sistemul este calibrat pentru a nu afecta utilizatorii reali.

3. Identitatea device‑ului
Fiecare device are un identificator unic:

x-device-id (obligatoriu în toate request‑urile)

generat la prima instalare

salvat în DB

folosit pentru:

rate limiting

detectare comportament

blocări

audit

Dacă device-id lipsește → 401 Unauthorized.

4. Tipuri de comportament detectat
4.1 Fast swipe
Detectează swipe-uri imposibil de rapide pentru un om:

intervale sub 150–250 ms

pattern-uri repetate

lipsa variației naturale

Eveniment logat: fast_swipe.

4.2 Automated behavior
Detectează pattern-uri non‑umane:

swipe-uri la intervale identice

feed refresh la intervale fixe

cereri simultane

cereri în paralel de pe același device

Eveniment logat: automated_behavior.

4.3 Rate limit abuse
Depășirea limitelor:

prea multe swipe-uri

prea multe feed refresh-uri

prea multe cereri premium

Eveniment logat: rate_limit_swipe.

4.4 Device spoofing
Detectează:

device-id schimbat prea des

device-id duplicat pe conturi multiple

device-id invalid

Eveniment logat: device_spoofing.

5. Sistemul de blocare
5.1 Blocare temporară
Aplicată pentru:

fast swipe repetat

rate limit abuzat

comportament automatizat ușor

Durată: 5–30 minute.

Răspuns API: 403 Forbidden.

5.2 Blocare permanentă
Aplicată pentru:

comportament automatizat sever

device spoofing

încercări repetate de fraudă

scraping agresiv

Durată: nelimitată.

Răspuns API: 403 Forbidden.

5.3 Deblocare
Poate fi făcută doar manual din admin.

6. Logging și audit
Toate evenimentele anti‑bot sunt logate în:

Code
lib/deviceBlock.ts
Fiecare log conține:

userId

deviceId

IP

endpoint

tipul evenimentului

timestamp

detalii tehnice

Aceste loguri sunt folosite pentru:

analiză

detectare pattern-uri

audit legal

îmbunătățirea sistemului

7. Pipeline-ul anti‑bot (la fiecare request)
Validare headere  
userId, session-token, device-id.

Rate limiting  
IP, userId, deviceId, endpoint.

Analiză comportament  
viteza, pattern-uri, repetitivitate.

Verificare device  
blocat / neblocat.

Logare evenimente suspecte  
fast_swipe, automated_behavior etc.

Aplicare sancțiuni  
blocare temporară sau permanentă.

8. Protecție feed
Feed-ul este una dintre cele mai vizate zone de scraping.

Protecții:

limită de rezultate (20–30)

rate limiting strict

device-id obligatoriu

feed refresh limitat

logging pentru cereri suspecte

9. Protecție swipe
Swipe Engine este protejat prin:

verificare viteza swipe-urilor

detectare pattern-uri automate

limită de swipe-uri pe minut

verificare duplicare

logging complet

10. Protecție premium
Premium Engine este protejat împotriva:

abuzului de rewarded ads

activări repetate

token-uri false

manipulare request-uri

11. Extensibilitate
Sistemul anti‑bot este construit pentru:

integrare cu modele AI de detectare comportament

scoring intern de risc

blocări inteligente

integrare cu firewall extern

protecție la nivel de CDN