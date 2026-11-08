
# /departamente — verificare înainte de „gata"

Context: regulile complete sunt în `~/.claude/CLAUDE.md` (secțiunea 13 = tabelul departamentelor).

## Pași

1. **Stabilește ce s-a modificat**: `git diff --name-only` (sau lista fișierelor atinse în sesiune) și ce domenii are aplicația (are plăți? apeluri? Android? conturi? email?). Departamentele pentru domenii pe care aplicația NU le are se marchează „N/A" și NU se rulează.
2. **Alege departamentele relevante** pentru fișierele atinse:
   - UI atins → Mobil (390px) + Desktop (1280px) + Butoane & stări + Dubluri
   - texte/i18n atinse → Limbi
   - email atins → Email (un email de test real)
   - chat/notificări atinse → Mesaje
   - WebRTC atins → Apeluri (test real pe două dispozitive; dacă nu se poate: NECONFIRMAT)
   - auth/API atins → Conturi & securitate (ownership, rate limit, rol)
   - schema/DB/scripturi atinse → Date (backup prezent, count înainte/după)
   - Stripe atins → Plăți (webhook → plan)
   - Android atins → Android (APK pe telefon; dacă nu se poate: NECONFIRMAT)
   - orice deploy → Deploy (200 live, versiune corectă)
   - întotdeauna → Cod (`npx tsc --noEmit`, lint, teste)
3. **Rulează verificările efectiv**, nu prin citirea codului:
   - Mobil/Desktop: pornește app-ul local (port liber, nu al altui proiect), Playwright cu viewport 390×844 (isMobile) și 1280×800; pentru fiecare pagină atinsă: captură + `document.documentElement.scrollWidth <= clientWidth` + lista elementelor care depășesc marginea dreaptă + numărul de căutări/selectoare de limbă/footere/cookie bannere vizibile (trebuie ≤1). Pentru pagini cu login/admin: simulează sesiunea DOAR în browser (route mock pe `/api/auth/me`) și blochează orice POST ca să nu scrii în DB. Uită-te la capturi.
   - Butoane: click pe fiecare buton nou/modificat; trebuie să producă o schimbare vizibilă.
   - Limbi: schimbă limba și verifică pagina; script care compară cheile i18n între limbi.
   - Email: trimite un email de test real către adresa proprietarului; raportează SENT/FAILED fără secrete.
   - Cod: `npx tsc --noEmit`, `npx eslint <fișiere>`, testele unitare.
4. **Product Design & Development — PENULTIMUL departament, automat la audit complet, înainte de R&D.** Dacă auditul e complet: după ce TOATE departamentele QA au verdict, rulează automat `/product` (skill-ul `product-design`, fără ca Elvis să-l ceară și fără să aștepți să-ți spună ce lipsește). Întrebarea obligatorie: „Dacă acest produs ar fi al meu și ar trebui să-l fac să crească, ce îi lipsește?” Analizează nu doar codul, ci și piața/concurența, pe toate axele din skill (funcții lipsă, adopție, creștere, onboarding, conversie, retenție, monetizare, achiziție, advertiseri/publisheri, terți, automatizări, UX/UI, mobil/desktop, diferențiere, distribuție, produse Diebel, ce are un produs matur). Fișă în 8 puncte per idee (problema, soluția, beneficiu utilizator, beneficiu business, prioritate, cost/complexitate, risc, recomandare ACUM / URMĂTORUL / MAI TÂRZIU / NU MERITĂ) și secțiunea „PROPUNERI CARE NECESITĂ APROBAREA LUI ELVIS”. NU implementa nimic din propuneri; întâi demonstrezi valoarea, Elvis decide. R&D (pasul 5) verifică apoi dacă există tehnologii noi care implementează mai bine recomandările Product. La task-uri mici: N/A (task mic).
5. **R&D / Innovation / Technology Radar — ULTIMUL departament, automat la audit complet.** Dacă auditul e complet („toate departamentele", livrare, verificare cap-coadă): după ce TOATE departamentele de mai sus sunt terminate și au verdict, rulează automat `/rd-radar` (skill-ul `rd-radar`, fără ca proprietarul să-l ceară separat): identifică stack-ul, caută noutățile relevante, scrie fișa per tehnologie și clasifică ADOPT / TRIAL / ASSESS / HOLD. NU implementa, NU instala, NU actualiza și NU modifica nimic; ADOPT/TRIAL se prezintă proprietarului pentru aprobare. Fără raportul R&D nu ai voie să spui „GATA". La task-uri mici (un fix) R&D se marchează „N/A (task mic)".
6. **Raport final**, scurt, în acest format (Product Design e penultima linie, R&D ultima; ambele vin DUPĂ ce toate celelalte sunt terminate):

```
DEPARTAMENTE — <proiect> — <data>
Mobil ............ PASS (5 pagini, 0 depășiri) / FAIL: <pagină: ce> / N/A
Desktop .......... PASS / FAIL / N/A
Butoane & stări .. PASS / FAIL
Dubluri .......... PASS / FAIL
Limbi ............ PASS / FAIL / N/A
Email ............ SENT / FAILED / N/A
Mesaje ........... PASS / NECONFIRMAT / N/A
Apeluri .......... NECONFIRMAT (necesită 2 dispozitive) / N/A
Conturi & secur .. PASS / FAIL / N/A
Date ............. PASS (backup: <cale>, users 2→2) / FAIL
Plăți ............ PASS / NECONFIRMAT / N/A
Android .......... NECONFIRMAT / N/A
Deploy ........... PASS (200, build <id>) / N/A (nu s-a făcut deploy)
Cod .............. tsc 0 / lint 0/0 / teste 106/106
Product Design .. RAPORTAT: <n> propuneri (ACUM <n> / URMĂTORUL <n> / MAI TÂRZIU <n> / NU MERITĂ <n>), nimic implementat, așteaptă aprobarea lui Elvis / N/A (task mic)
R&D / Radar ...... RAPORTAT: ADOPT <n> / TRIAL <n> / ASSESS <n> / HOLD <n> (nimic implementat; detalii în raportul radar) / N/A (task mic)
Modificat: <fișiere>   Verificat doar: <ce>   Rămâne manual: <ce>   Așteaptă aprobarea lui Elvis: <propuneri Product + ADOPT/TRIAL R&D>
```

Ordine obligatorie: toate departamentele QA → Product Design & Development → R&D / Technology Radar → abia apoi „GATA".

Reguli: PASS doar cu dovadă reală. Niciodată PASS pentru ceva neverificat. Nu modifica nimic în timpul verificării; dacă găsești defect, listează-l cu fișier+linie și repară-l DUPĂ raport, apoi rulează din nou departamentul respectiv.
