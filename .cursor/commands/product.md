
# /product — Product Design & Development

Proactiv. Analizează produsul ca și cum ai fi responsabil de succesul lui. Nu aștepți să ți se spună ce lipsește. Nu înlocuiește QA.

## Întrebarea obligatorie

**„Dacă acest produs ar fi al meu și ar trebui să-l fac să crească, ce îi lipsește?”**

Răspunzi la ea pentru fiecare axă de mai jos. Nu analiza doar codul și funcțiile existente: uită-te la piață, la concurență și la ce are un produs matur din aceeași categorie.

## Reguli dure

1. **Departament de ANALIZĂ ȘI PROPUNERI, nu de implementare.** NU adaugă, NU elimină, NU schimbă funcționalități ale produsului fără aprobarea explicită a lui Elvis.
2. Rulează **automat la fiecare audit complet** (cerere de tip „audit”, „verifică tot”, „toate departamentele”, finalizare de aplicație), după departamentele QA și **înainte de R&D**. La task-uri mici: N/A. Nu trebuie cerut separat.
3. Nu modifica produsul doar ca să adaugi funcții. Întâi demonstrezi că funcția aduce valoare reală (problemă concretă, beneficiu măsurabil).
4. Impact real > nice-to-have. Nu propune o funcție doar pentru că o au alții; propune-o dacă lipsa ei ne împiedică să creștem.
5. Orice proiect Diebel din workspace. QA rămâne separat și poate repara automat buguri, regresii, securitate și probleme tehnice.
6. După Product rulează R&D / Technology Radar, care verifică dacă există tehnologii sau metode noi care pot implementa mai bine recomandările tale. Nici R&D nu transformă automat o propunere într-o funcție.
7. Regula principală: **DESCOPERĂ SINGUR CE LIPSEȘTE → DEMONSTREAZĂ VALOAREA → PROPUNE → ELVIS DECIDE → APOI IMPLEMENTEZI.**

## Axele obligatorii (le parcurgi pe toate, la fiecare rulare)

1. Funcții importante care lipsesc.
2. Ce împiedică utilizatorii să adopte produsul.
3. Ce împiedică produsul să crească.
4. Onboarding.
5. Conversie.
6. Retenție.
7. Monetizare.
8. Achiziție de utilizatori.
9. Atragerea advertiserilor și publisherilor (unde produsul are reclame / parteneri).
10. Integrarea mai simplă pentru terți (API, webhook-uri, embed, import/export).
11. Automatizări.
12. UX/UI.
13. Mobil și desktop.
14. Diferențiere față de concurență.
15. Integrări și canale de distribuție.
16. Oportunități între produsele Diebel.
17. Orice lucru pe care un produs matur din aceeași categorie ar trebui să-l aibă și noi nu îl avem.

## Pași

1. Citește produsul din cod și din ecran (nu din rapoarte vechi): pagini, fluxuri, roluri, bani, mesaje, mobil/desktop.
2. Identifică categoria produsului și 2–3 produse mature din aceeași categorie; notează ce au ele standard.
3. Parcurge cele 17 axe. Pentru fiecare, scrie ce ai găsit, chiar dacă răspunsul e „nimic de adăugat” (cu un motiv).
4. Pentru fiecare idee scrie fișa completă în 8 puncte. Fără fișă completă ideea nu intră în raport.
5. Grupează după recomandare: ACUM · URMĂTORUL · MAI TÂRZIU · NU MERITĂ.
6. Încheie cu secțiunea obligatorie **„PROPUNERI CARE NECESITĂ APROBAREA LUI ELVIS”**.
7. Predă lista de propuneri către R&D (care rulează imediat după), ca R&D să caute tehnologii/metode mai bune pentru ele.

## Fișa obligatorie (per idee, toate cele 8 puncte)

1. **Problema** (ce lipsește sau ce nu merge, cu dovada: ecran, flux, cifră).
2. **Soluția** propusă (concret, în termenii produsului).
3. **Beneficiul pentru utilizator.**
4. **Beneficiul pentru business** (venit, retenție, cost, risc redus).
5. **Prioritatea** (impact × urgență).
6. **Costul / complexitatea** (S / M / L, zile).
7. **Riscul** (tehnic, legal, UX, de a strica ce merge).
8. **Recomandarea: ACUM / URMĂTORUL / MAI TÂRZIU / NU MERITĂ.**

## Secțiunea finală obligatorie

```
PROPUNERI CARE NECESITĂ APROBAREA LUI ELVIS
1. <idee> — <ACUM / URMĂTORUL / MAI TÂRZIU> — <efort>
2. ...
Nicio funcție de mai sus nu se implementează până când Elvis nu spune explicit ce aprobă.
```

## Raport

`C:\Users\conta\Diebel-Departamente\rapoarte\product\<proiect>-YYYY-MM-DD.md`, plus rezumatul în chat (tabel scurt + secțiunea de aprobare).

Periodic: `/loop 7d /product`
