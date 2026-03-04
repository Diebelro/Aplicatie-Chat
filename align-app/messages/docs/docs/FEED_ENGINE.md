FEED_ENGINE.md
(Document oficial – versiunea 1.0)

1. Rolul modulului de feed
Feed Engine este responsabil pentru generarea listei de utilizatori afișați fiecărui user în aplicație. Este unul dintre cele mai sensibile module, deoarece influențează direct engagement-ul, calitatea experienței și performanța generală. Toată logica rulează exclusiv pe server pentru a preveni manipularea, scraping-ul și reverse engineering-ul.

2. Principii fundamentale
Feed-ul este dinamic, generat la cerere.

Toată logica este server-side.

Nicio regulă de feed nu este expusă în client.

Rezultatele sunt limitate pentru performanță și protecție anti-scraping.

Fiecare cerere necesită headere valide:

x-user-id

x-session-token

x-device-id

Fără headere → 401 Unauthorized.

3. Surse de date
Feed-ul este generat pe baza:

profilului utilizatorului curent

preferințelor de vârstă

preferințelor de distanță

orientării / intereselor

vizibilității celuilalt utilizator

blocărilor reciproce

swipe-urilor anterioare

statusului premium (pentru extinderea razei sau a limitelor)

4. Filtre aplicate în ordine
4.1 Filtru de vizibilitate
Elimină:

utilizatori dezactivați

utilizatori ascunși

conturi raportate sau blocate

4.2 Filtru de preferințe
Aplică:

intervalul de vârstă

preferințele de gen

preferințele de orientare

4.3 Filtru de distanță
Calcul pe server folosind coordonatele salvate.

Limită standard: 50 km.

Premium poate extinde limita (ex: 100–200 km).

4.4 Filtru anti-duplicare
Elimină utilizatorii:

deja swipați

deja văzuți recent

deja în match

4.5 Filtru de calitate
Opțional, pentru viitor:

completitudinea profilului

număr de poze

activitate recentă

5. Ordinea rezultatelor
Feed-ul este ordonat după:

Distanță (cel mai aproape → cel mai departe)

Activitate recentă (cei activi recent au prioritate)

Compatibilitate (în viitor: interese comune, scoruri interne)

Boost / Premium (dacă există boost activ)

6. Limitări și protecție anti-scraping
Pentru fiecare cerere:

limită de rezultate: 20–30 utilizatori

rate limiting strict pe endpoint

device-id obligatoriu

logging pentru cereri suspecte

feed-ul nu poate fi cerut prea des într-un interval scurt

Dacă un user încearcă să „tragă” feed-ul prea rapid:

se loghează eveniment automated_behavior

poate fi blocat temporar

7. Structura endpoint-ului
Endpoint
Code
POST /api/feed
Headere obligatorii
x-user-id

x-session-token

x-device-id

Body (exemplu)
Code
{
  "lat": 52.123,
  "lng": 8.123
}
Răspuns
Lista de utilizatori validați și filtrați, fiecare cu:

id

nume

vârstă

distanță

poze (URL-uri semnate)

interese

bio

status premium (dacă e relevant pentru UI)

8. Logica server-side
Feed-ul este generat în 4 pași:

Preluare user curent  
Validare headere, verificare sesiune, verificare device.

Query DB  
Se extrag utilizatorii eligibili pe baza filtrelor brute (vârstă, gen, distanță).

Filtrare avansată  
Se elimină utilizatorii deja swipați, blocați, ascunși etc.

Sortare și limitare  
Se ordonează după distanță, activitate, compatibilitate și se limitează rezultatele.

9. Optimizări de performanță
Query-uri paginate.

Indexare pe câmpurile critice (vârstă, gen, locație).

Cache scurt (5–10 secunde) pentru utilizatorii foarte activi.

Limitarea numărului de poze returnate.

10. Extensibilitate
Feed Engine este construit pentru a permite:

introducerea unui sistem de recomandări AI

feed-uri tematice (ex: „Nearby”, „New users”, „Trending”)

boost-uri premium

filtre avansate (ex: hobby-uri, stil de viață)

feed-uri dinamice pentru evenimente