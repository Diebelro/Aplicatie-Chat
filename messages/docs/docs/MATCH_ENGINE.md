MATCH_ENGINE.md
(Document oficial – versiunea 1.0)

1. Rolul modulului de match
Match Engine este responsabil pentru confirmarea conexiunilor reciproce dintre utilizatori. Este un modul critic pentru experiența aplicației, deoarece definește momentul în care doi utilizatori pot începe o conversație. Toată logica rulează exclusiv pe server pentru a preveni manipularea, falsificarea match‑urilor sau accesul neautorizat.

2. Principii fundamentale
Match‑ul este un eveniment atomic, creat doar dacă:

utilizatorul A a dat right swipe utilizatorului B

utilizatorul B a dat right swipe utilizatorului A

Nicio altă acțiune nu poate crea un match.

Reguli fundamentale:

Nicio logică de match nu este expusă în client.

Match‑urile nu pot fi create manual.

Fiecare match este verificat pentru duplicare.

Fiecare cerere necesită headere valide:

x-user-id

x-session-token

x-device-id

3. Pipeline-ul complet al unui match
3.1 Validare headere
Serverul verifică identitatea utilizatorului și device-ul.
Fără headere → 401 Unauthorized.

3.2 Verificare swipe anterior
Când un utilizator dă right swipe:

serverul verifică dacă celălalt utilizator a dat deja right swipe

dacă nu, swipe-ul este doar salvat

dacă da, se trece la crearea match-ului

3.3 Creare match atomică
Match-ul este creat într-o tranzacție atomică:

se verifică încă o dată dacă match-ul nu există deja

se creează în DB o intrare unică

se marchează ambele swipe-uri ca „matched”

3.4 Returnarea rezultatului
Serverul răspunde cu:

Code
{
  "match": true,
  "matchId": "...",
  "user": { ...profilul celuilalt utilizator... }
}
Dacă nu este match:

Code
{
  "match": false
}
4. Structura endpoint-ului
Endpoint
Match-ul nu are endpoint separat.
Este declanșat automat în:

Code
POST /api/swipe
Când un right swipe este procesat, serverul verifică dacă există reciprocitate.

5. Reguli de integritate
5.1 Fără duplicare
Înainte de a crea un match, serverul verifică:

dacă există deja un match între cei doi utilizatori

dacă există swipe-uri contradictorii

dacă unul dintre utilizatori a blocat pe celălalt

5.2 Fără match-uri false
Match-ul nu poate fi creat dacă:

unul dintre utilizatori este dezactivat

unul dintre utilizatori este ascuns

unul dintre utilizatori este blocat

unul dintre utilizatori a fost raportat pentru abuz

5.3 Fără match-uri automate
Nicio acțiune client-side nu poate forța un match.

6. Notificări și UX
După crearea match-ului:

serverul poate trimite notificări push (în viitor)

UI-ul afișează cardul de match

conversația poate fi inițiată imediat

7. Protecție anti‑bot
Match Engine este protejat prin:

validare device-id

rate limiting

verificare comportament automatizat

logging în lib/deviceBlock.ts

Dacă un bot încearcă să genereze match-uri false:

evenimentul este logat

device-ul poate fi blocat

cererea este respinsă cu 403 Forbidden

8. Optimizări de performanță
Indexare pe userId, targetId, matchId

Tranzacții atomice pentru consistență

Query-uri optimizate pentru verificarea reciprocității

Limitarea numărului de match-uri returnate în feed

9. Extensibilitate
Match Engine este construit pentru a permite:

introducerea unui sistem de compatibilitate (scor intern)

match-uri contextuale (ex: interese comune)

match-uri pentru evenimente sau grupuri

match-uri cu boost premium

integrare cu recomandări AI