BUILD_SECURITY.md
(Document oficial – versiunea 1.0)

1. Scopul regulilor de securitate pentru build
Acest document definește regulile obligatorii pentru procesul de build al aplicației. Obiectivul este să împiedice accesul la codul sursă, la logica internă, la variabile sensibile și la structura aplicației în producție. Build-ul final trebuie să fie opac, imposibil de inspectat și imposibil de decompilat într-o formă utilă.

2. Eliminarea DevTools în producție
DevTools trebuie dezactivate complet în build-ul de producție pentru a preveni:

accesul la React components tree

accesul la state intern

inspectarea request-urilor

manipularea UI

debugging în runtime

Reguli:
disable-react-devtools activ în producție

niciun flag care permite reactivarea lor

verificare automată în pipeline

3. Eliminarea __NEXT_DATA__ după hydration
Next.js injectează un obiect mare în HTML care conține:

props

structura paginii

date interne

rute

uneori chiar date sensibile

Acest obiect trebuie eliminat imediat după hydration.

Reguli:
script dedicat care șterge __NEXT_DATA__

nu se păstrează în DOM

nu se expune în window

4. Eliminarea console.log în producție
Console.log poate expune:

date interne

răspunsuri API

erori sensibile

structura aplicației

Reguli:
toate console.log sunt eliminate automat în build

folosirea unui plugin Babel/Next pentru stripping

console.error păstrat doar pentru erori critice

5. Eliminarea sourcemaps
Sourcemaps permit reconstruirea codului original.
Într-o aplicație premium, acest lucru este inacceptabil.

Reguli:
productionBrowserSourceMaps: false

niciun sourcemap nu este generat

niciun sourcemap nu este încărcat pe server

verificare automată în pipeline

6. Protecția variabilelor ENV
Variabilele ENV sunt împărțite în două categorii:

server-only

client-exposed

Reguli:
niciun ENV sensibil nu ajunge în client

ENV-urile server-only sunt accesibile doar în API routes

ENV-urile client sunt prefixate cu NEXT_PUBLIC_

verificare automată în build pentru a preveni scurgerile

7. Watermark invizibil în build
Fiecare build trebuie să conțină un watermark invizibil:

hash unic generat automat

inserat în codul minificat

imposibil de detectat fără script intern

folosit pentru identificarea build-urilor copiate

Acest mecanism oferă protecție legală și tehnică.

8. Minificare și obfuscare
Codul final trebuie să fie:

minificat

obfuscat

greu de citit

greu de analizat

Reguli:
Terser configurat agresiv

eliminarea comentariilor

eliminarea whitespace-ului

renaming variabile interne

9. Protecția asset-urilor premium
Niciun asset premium nu trebuie să fie:

în /public

accesibil direct

servit fără URL semnat

Reguli:
toate pozele premium → URL semnat

expirare obligatorie

verificare server-side înainte de servire

10. Build hash unic
Fiecare build trebuie să genereze automat:

un hash unic

folosit pentru watermark

folosit pentru debugging intern

folosit pentru identificarea versiunilor

Hash-ul nu este expus în client.

11. Pipeline de verificare
Înainte de deploy, pipeline-ul trebuie să verifice:

DevTools dezactivate

sourcemaps eliminate

console.log eliminate

ENV corect separate

watermark generat

cod minificat

cod obfuscat

Dacă oricare verificare eșuează → build blocat.

12. Extensibilitate
Sistemul de securitate pentru build este construit pentru:

scalare în Europa

audit legal

protecție împotriva competitorilor

protecție împotriva scraping-ului

protecție împotriva reverse engineering-ului