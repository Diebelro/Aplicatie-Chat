
# /rd-radar — R&D / Innovation / Technology Radar

Proactiv. Nu așteaptă bug. Nu înlocuiește departamentele QA.

## Reguli dure

1. **Nu instala și nu modifica automat nimic** în aplicație, dependențe, infra sau config.
2. Orice **ADOPT** sau **TRIAL** se prezintă întâi proprietarului; implementare doar după aprobare explicită.
3. Nu recomanda tehnologie doar pentru că e nouă.
4. Funcționează pentru **orice proiect Diebel** din workspace-ul curent.
5. Departamentele QA rămân neschimbate.

## Pași

1. Identifică proiectul și stack-ul curent.
2. Citește ce folosim deja.
3. Caută noutăți relevante domeniului.
4. Ia propunerile din raportul Product Design & Development (rulat imediat înainte) și, pentru fiecare, verifică dacă există tehnologii sau metode noi care le pot implementa mai bine / mai ieftin / mai sigur. Scrie-le ca intrări pe radar legate de propunerea Product.
5. Pentru fiecare candidată: fișă + clasificare ADOPT | TRIAL | ASSESS | HOLD.

Ordinea în auditul complet: departamente QA → Product Design → R&D (ultimul) → abia apoi „GATA”. R&D descoperă singur oportunitățile, nu așteaptă idei de la Elvis.

## Fișă obligatorie (per tehnologie)

- ce problemă rezolvă; ce avem acum; dacă e realmente mai bună
- performanță; securitate și privacy; UX/UI; mobil; SEO; accesibilitate
- scalabilitate; stabilitate; costuri; compatibilitate; mentenanță
- impact asupra codului; vendor lock-in; beneficiu utilizator/business
- **clasificare**: ADOPT | TRIAL | ASSESS | HOLD

Pentru ADOPT/TRIAL prezintă în chat: ce avem acum, ce e nou, avantaj, dezavantaje/riscuri, securitate, performanță, cost, compatibilitate, impact cod, beneficiu user/business.

## Raport

`C:\Users\conta\Diebel-Departamente\rapoarte\rd-radar\<proiect>-YYYY-MM-DD.md`

Periodic: `/loop 7d /rd-radar`
