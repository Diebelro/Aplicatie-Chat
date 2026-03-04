URL_SIGNING.md
(Document oficial – versiunea 1.0)

1. Rolul URL signing
URL signing protejează toate resursele media premium (poze, video, fișiere) împotriva accesului neautorizat. În loc să expui direct fișierele, serverul generează URL-uri temporare, semnate criptografic, care expiră automat. Astfel:

nimeni nu poate accesa pozele fără permisiune

nimeni nu poate copia linkul și să-l folosească ulterior

scraping-ul devine inutil

CDN-ul poate servi fișierele fără a expune locația reală

Este standardul folosit de platforme precum Instagram, Tinder, OnlyFans, Google Cloud, AWS S3.

2. Principii fundamentale
Nicio poză premium nu este servită din /public.

Toate resursele premium sunt accesibile doar prin URL-uri semnate.

Fiecare URL are:

semnătură criptografică

timestamp de expirare

userId pentru care a fost generat

deviceId pentru care a fost generat (opțional, recomandat)

URL-ul nu poate fi modificat fără a deveni invalid.

Expirarea este obligatorie (30–120 secunde).

3. Structura unui URL semnat
Un URL semnat arată astfel:

Code
https://cdn.site.com/media/abc123.jpg?expires=1700000000&signature=9f8a7c6d...
Conține:

path-ul fișierului

timestamp de expirare

semnătura generată cu HMAC-SHA256

parametri suplimentari (userId, deviceId)

4. Cum se generează semnătura
Semnătura este generată pe server folosind:

secret key (ENV server-only)

path-ul fișierului

timestamp-ul de expirare

userId

deviceId

Formula generală:

Code
signature = HMAC_SHA256(secret, path + expires + userId + deviceId)
Rezultatul este un hash imposibil de falsificat.

5. Pipeline-ul complet de generare a URL-ului
5.1 Pasul 1 — Validare acces
Serverul verifică:

userId valid

session-token valid

deviceId valid

userul are dreptul să vadă poza (ex: nu este blocat)

5.2 Pasul 2 — Calcul expirare
Exemplu: 60 secunde.

Code
expires = now + 60
5.3 Pasul 3 — Generare semnătură
Serverul generează hash-ul criptografic.

5.4 Pasul 4 — Construire URL final
Serverul returnează URL-ul complet semnat.

6. Validarea URL-ului la acces
Când CDN-ul sau serverul primește cererea:

extrage expires

verifică dacă a expirat

recalculează semnătura

compară cu semnătura din URL

dacă nu se potrivește → 403 Forbidden

dacă expiră → 403 Forbidden

Nicio altă verificare nu este necesară.

7. Protecție împotriva atacurilor
7.1 Copiere link
Linkul expiră în 60 secunde → inutilizabil.

7.2 Modificare parametri
Orice modificare invalidează semnătura.

7.3 Acces fără semnătură
→ 403 Forbidden.

7.4 Acces după expirare
→ 403 Forbidden.

7.5 Scraping
Scraperul nu poate genera semnături valide.

8. Integrare cu CDN
CDN-ul servește fișierele doar dacă semnătura este validă.

Avantaje:

viteză mare

cost redus

securitate maximă

serverul tău nu servește direct fișiere

9. Reguli pentru poze premium
niciun fișier premium în /public

niciun URL permanent

niciun link direct

toate pozele trec prin URL signing

expirare scurtă

semnătură unică per cerere

10. Extensibilitate
Sistemul permite:

watermark dinamic

URL-uri semnate pentru video

acces diferențiat premium/non-premium

semnături per device

semnături per IP

semnături per sesiune