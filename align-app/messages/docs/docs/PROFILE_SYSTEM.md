PROFILE_SYSTEM.md
(Document oficial – versiunea 1.0)

1. Rolul sistemului de profil
Sistemul de profil gestionează toate informațiile personale ale utilizatorilor: poze, bio, interese, preferințe, vizibilitate, setări și status. Este un modul critic pentru calitatea feed-ului, siguranța utilizatorilor și funcționarea corectă a întregii aplicații.

2. Principii fundamentale
Toate validările importante sunt făcute pe server.

Nicio poză premium nu este servită direct — doar prin URL-uri semnate.

Profilul trebuie să fie complet, coerent și valid înainte de a apărea în feed.

Orice modificare de profil este logată.

Orice câmp sensibil este protejat prin reguli stricte.

3. Structura profilului utilizatorului
Profilul conține următoarele câmpuri:

id

nume

vârstă

gen

orientare

bio

interese

poze (URL-uri semnate)

locație (lat, lng)

vizibilitate

premium (status)

ultima activitate

preferințe (vârstă, distanță, gen)

4. Validarea profilului
Serverul validează:

4.1 Poze
minim 1 poză

maxim 6 poze

fiecare poză trebuie să fie validă

fiecare poză este servită prin URL semnat

nicio poză nu este stocată în /public

4.2 Bio
lungime minimă (ex: 10 caractere)

lungime maximă (ex: 500 caractere)

fără conținut ilegal, ofensator sau sexual explicit

4.3 Interese
listă validă

fără spam

fără duplicări

4.4 Preferințe
interval de vârstă valid

distanță validă

gen/orientare validă

4.5 Vizibilitate
userul poate fi ascuns

userul poate fi dezactivat

userul poate fi blocat de alții

5. Reguli pentru poze
Pozele sunt cea mai sensibilă parte a profilului.

5.1 Upload
upload doar prin endpoint securizat

validare tip fișier

validare dimensiune

validare rezoluție

5.2 Stocare
pozele sunt stocate în storage securizat (CDN / bucket)

niciodată în /public

5.3 Servire
doar prin URL semnat

expirare obligatorie

verificare acces înainte de generare

6. Vizibilitate și apariție în feed
Un utilizator apare în feed doar dacă:

are profil complet

are poze valide

nu este ascuns

nu este dezactivat

nu este blocat

nu a fost raportat

nu a fost deja swipat

nu este în match

7. Actualizarea profilului
Orice modificare trece prin:

validare server-side

salvare atomică în DB

logare eveniment

invalidare cache feed (dacă este necesar)

8. Protecție anti‑abuz
Sistemul de profil include protecții împotriva:

pozelor false

pozelor furate

conturilor duplicate

modificărilor excesive

comportamentului suspect

8.1 Măsuri tehnice
rate limiting pe update profil

verificare device-id

verificare IP

verificare pattern-uri suspecte

8.2 Măsuri legale
interdicția de a folosi poze care nu îți aparțin

interdicția de a crea conturi false

interdicția de a încărca conținut ilegal

9. Integrare cu alte module
Profilul este folosit de:

Feed Engine (filtre + sortare)

Swipe Engine (validare target)

Match Engine (validare reciprocitate)

Premium Engine (funcții premium)

Anti‑Bot System (comportament suspect)

URL Signing (poze)

10. Extensibilitate
Sistemul permite:

badge-uri premium

verificare identitate (ID verification)

poze verificate

profiluri tematice

interese avansate

profiluri pentru evenimente