API_SECURITY_RULES.md
(Document oficial – versiunea 1.0)

1. Rolul regulilor de securitate API
Acest document definește regulile obligatorii pentru toate endpoint‑urile API din aplicație. Scopul este să asigure că fiecare request este autentic, valid, sigur și imposibil de abuzat. Regulile sunt aplicate global, indiferent de modul (feed, swipe, match, premium, media).

2. Headere obligatorii pentru orice request
Fiecare endpoint API trebuie să respingă automat orice cerere care nu conține următoarele headere:

x-user-id — identifică utilizatorul logat

x-session-token — validează sesiunea activă

x-device-id — identifică device-ul fizic

Reguli:
lipsa oricărui header → 401 Unauthorized

valori invalide → 401 Unauthorized

device-id duplicat pe mai multe conturi → logare eveniment suspect

Aceste headere sunt fundamentul securității API.

3. Rate limiting global
Fiecare endpoint are rate limiting aplicat pe:

IP

userId

deviceId

endpoint

Praguri recomandate:
cereri normale: 10–20/sec

endpoint-uri critice (swipe, feed): 1–3/sec

endpoint-uri premium: 1/5 sec

Depășirea limitelor → 429 Too Many Requests.

4. Validarea sesiunii
La fiecare request:

serverul verifică dacă session-token este valid

verifică dacă aparține userId-ului din header

verifică dacă nu este expirat

verifică dacă nu a fost invalidat manual

Dacă oricare verificare eșuează → 401 Unauthorized.

5. Validarea device-ului
Device-ul este verificat pentru:

unicitate

comportament suspect

blocări anterioare

pattern-uri automate

Dacă device-ul este blocat → 403 Forbidden.

6. Reguli pentru body-ul request-ului
Body-ul trebuie să fie JSON valid.

Parametrii suplimentari sau necunoscuți sunt ignorați.

Parametrii lipsă → 400 Bad Request.

Nicio valoare nu este preluată direct în query-uri fără validare.

7. Reguli pentru răspunsuri
Toate răspunsurile API trebuie să respecte:

format JSON

fără informații sensibile

fără stack traces în producție

fără detalii interne despre erori

Structură recomandată:
Code
{
  "success": true/false,
  "error": null | "error_code",
  "data": { ... }
}
8. Reguli pentru endpoint-uri critice
8.1 /api/feed
rate limiting strict

verificare locație

verificare premium

limită de rezultate

8.2 /api/swipe
verificare viteza swipe-urilor

verificare duplicare

verificare blocări

logging pentru evenimente suspecte

8.3 /api/match
match creat doar dacă există reciprocitate

tranzacție atomică

verificare blocări

8.4 /api/media
servește doar URL-uri semnate

expirare obligatorie

fără acces direct la /public

9. Reguli anti‑scraping
API-ul trebuie să detecteze și să blocheze:

cereri prea rapide

cereri repetate identic

cereri din scripturi

cereri fără device-id valid

cereri din IP-uri suspecte

Acțiuni:

logare eveniment

blocare temporară device

blocare permanentă device

răspuns 403

10. Logging și audit
Fiecare endpoint trebuie să logheze:

userId

deviceId

IP

endpoint

timestamp

succes / eșec

motivul eșecului

Evenimente suspecte sunt trimise în:

Code
lib/deviceBlock.ts
11. Extensibilitate
Regulile API sunt construite pentru:

integrare cu noi module

scalare în Europa

audit legal

protecție împotriva atacurilor automate

compatibilitate cu microservicii viitoare