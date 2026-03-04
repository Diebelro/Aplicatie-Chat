1. Rolul procesului de build & deploy
Procesul de build și deploy definește pașii oficiali prin care aplicația trece din stadiul de cod în stadiul de produs live. Acest document stabilește regulile, verificările, mediile și pașii necesari pentru a asigura un deploy sigur, stabil, scalabil și conform cu standardele premium ale proiectului.

2. Structura mediilor
Aplicația folosește trei medii distincte:

2.1 Development
rulează local

permite debugging

permite DevTools

folosește ENV-uri locale

nu are protecții stricte

2.2 Staging
replică producția

folosește build de producție

are protecții active

folosește ENV-uri staging

folosește baza de date separată

folosește CDN staging

2.3 Production
build final

protecții maxime

fără DevTools

fără sourcemaps

ENV server-only

CDN live

firewall activ

3. Structura ENV-urilor
ENV-urile sunt împărțite în două categorii:

3.1 ENV server-only
chei API

chei pentru URL signing

chei pentru premium

chei pentru DB

chei pentru CDN

chei pentru anti-bot

Acestea nu ajung niciodată în client.

3.2 ENV client (prefixate cu NEXT_PUBLIC_)
endpoint-uri publice

setări UI

versiune aplicație

4. Pipeline-ul de build
Pipeline-ul de build include următorii pași:

4.1 Install dependencies
Code
npm install
4.2 Validare ENV
verifică lipsa ENV-urilor sensibile în client

verifică existența ENV-urilor obligatorii

verifică formatul corect

4.3 Lint & Typecheck
Code
npm run lint
npm run typecheck
4.4 Build
Code
npm run build
4.5 Verificări de securitate
DevTools dezactivate

sourcemaps eliminate

console.log eliminate

watermark generat

cod minificat

cod obfuscat

4.6 Generare build hash
hash unic pentru versiune

folosit pentru watermark

folosit pentru debugging intern

5. Deploy în staging
Deploy-ul în staging se face automat după build.

5.1 Pași
upload build

restart server staging

migrare DB (dacă este necesar)

verificare endpoint-uri

verificare feed

verificare swipe

verificare premium

verificare URL signing

5.2 Teste obligatorii
login

feed

swipe

match

premium

media (URL semnat)

anti-bot

6. Deploy în producție
Deploy-ul în producție este permis doar după validarea staging-ului.

6.1 Pași
upload build final

restart server

migrare DB (dacă este necesar)

activare CDN

activare firewall

activare rate limiting

verificare endpoint-uri critice

6.2 Reguli
niciun sourcemap

niciun console.log

niciun ENV sensibil în client

watermark activ

build hash generat

7. Rollback
Dacă apare o problemă în producție:

7.1 Rollback automat
se revine la build-ul anterior

se păstrează DB-ul intact

7.2 Rollback manual
se selectează versiunea anterioară

se redeployează

se verifică endpoint-urile

8. Monitorizare după deploy
După fiecare deploy, se monitorizează:

erori API

rate limiting

comportament anti-bot

performanță feed

performanță swipe

performanță DB

CDN

logs

9. Extensibilitate
Procesul de build & deploy este construit pentru:

scalare în Europa

integrare CI/CD

deploy automat pe multiple regiuni

suport pentru microservicii

audit legal

protecție împotriva atacurilor