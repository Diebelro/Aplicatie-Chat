SWIPE_ENGINE.md
(Document oficial – versiunea 1.0)

1. Rolul modulului de swipe
Swipe Engine gestionează toate interacțiunile critice dintre utilizatori: like, dislike, super‑like (dacă există), verificarea comportamentului, validarea identității și declanșarea match‑urilor. Este unul dintre cele mai sensibile module, deoarece poate fi abuzat de boți, scripturi sau utilizatori rău intenționați. Toată logica rulează exclusiv pe server.

2. Principii fundamentale
Fiecare swipe este un eveniment atomic procesat pe server.

Nicio validare importantă nu se face în client.

Fiecare cerere necesită headere valide:

x-user-id

x-session-token

x-device-id

Fără headere → 401 Unauthorized.

Rate limiting strict pentru a preveni abuzul.

Logging complet pentru comportament suspect.

3. Tipuri de swipe
Left swipe — respingere.

Right swipe — interes.

Super‑like (opțional) — interes puternic, poate crește șansele de match.

Undo (premium) — revenire asupra ultimului swipe.

Fiecare tip de swipe are reguli separate, dar toate trec prin același pipeline de validare.

4. Pipeline-ul complet al unui swipe
4.1 Validare headere
Serverul verifică:

user-id valid

session-token valid

device-id valid

Dacă oricare lipsește → 401 Unauthorized.

4.2 Rate limiting
Se aplică limite pe:

IP

userId

deviceId

endpoint

Depășirea limitelor → 429 Too Many Requests.

4.3 Detectare comportament automatizat
Se verifică:

viteza swipe-urilor (intervale imposibil de rapide)

pattern-uri repetitive

cereri simultane de pe același device

cereri din locații imposibile

Dacă se detectează comportament suspect:

se loghează eveniment fast_swipe sau automated_behavior

device-ul poate fi blocat temporar → 403 Forbidden

4.4 Validare utilizator target
Serverul verifică dacă utilizatorul swipat:

există

este vizibil

nu este blocat

nu este deja swipat

nu este deja în match

4.5 Salvarea swipe-ului
Swipe-ul este salvat în baza de date cu:

userId

targetId

tipul swipe-ului

timestamp

deviceId

4.6 Verificare match
Dacă target-ul a dat deja right swipe:

se creează un match atomic

se returnează match: true

Dacă nu:

se returnează match: false

5. Structura endpoint-ului
Endpoint
Code
POST /api/swipe
Headere obligatorii
x-user-id

x-session-token

x-device-id

Body (exemplu)
Code
{
  "targetId": "abc123",
  "type": "right"
}
Răspuns (exemplu)
Code
{
  "success": true,
  "match": false
}
6. Protecție anti‑bot
Sistemul anti‑bot este integrat direct în Swipe Engine.

Evenimente detectate
fast_swipe — swipe-uri prea rapide

rate_limit_swipe — depășirea limitelor

blocked_device_access — device blocat

automated_behavior — pattern-uri non-umane

Acțiuni posibile
logare eveniment

blocare temporară device

blocare permanentă device

răspuns 403 Forbidden

Logging
Toate evenimentele sunt salvate în:

Code
lib/deviceBlock.ts
7. Reguli premium
Utilizatorii premium pot avea:

undo swipe

super‑like-uri suplimentare

limită mai mare de swipe-uri pe zi

prioritate în match-uri

Toate regulile premium sunt validate pe server.

8. Optimizări de performanță
Query-uri indexate pentru swipe-uri și match-uri.

Limitarea swipe-urilor procesate simultan.

Reducerea payload-ului în răspuns.

Logging asincron pentru evenimente suspecte.

9. Extensibilitate
Swipe Engine este construit pentru a permite:

introducerea unui sistem de scoring intern

swipe-uri contextuale (ex: pe interese comune)

swipe-uri pentru evenimente sau grupuri

integrare cu recomandări AI

boost-uri premium care cresc vizibilitatea