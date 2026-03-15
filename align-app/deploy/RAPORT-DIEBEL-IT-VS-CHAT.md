# Raport: de ce online apare „IT Diebel” în loc de Aplicația Chat (Align)

## 1. Ce sunt cele două lucruri

| Ce vezi        | Ce este                                                                 |
|----------------|-------------------------------------------------------------------------|
| **IT Diebel**  | Site-ul firmei (diebel.ro / www) – prezentare, servicii, contact etc.  |
| **Aplicația Chat (Align)** | Aplicația din acest proiect – Login, Înregistrare, Mesaje, Matches, profil. Rulează din repo-ul **Aplicatie-Chat** (align-app). |

În proiectul **Aplicatie Chat** (align-app) apare doar „Diebel” ca autor (footer, contact), nu „IT Diebel” ca brand de site. Deci dacă pe ecran apare site-ul IT Diebel (meniu, pagini firma), acel conținut **nu** vine din aplicația de chat.

---

## 2. De ce „online” se deschide IT Diebel

Cauze posibile (pe server / la tine):

### A) Adresa la care intri

- **chat.diebel.ro** → ar trebui să fie **aplicația de chat** (Align).
- **diebel.ro** / **www.diebel.ro** → este **site-ul IT Diebel**.

Dacă deschizi diebel.ro sau www.diebel.ro, e normal să vezi IT Diebel. Soluție: folosește explicit **https://chat.diebel.ro**.

### B) Pe server: Nginx pentru chat.diebel.ro lipsește sau e greșit

Dacă pentru **chat.diebel.ro** nu există un bloc `server` separat care face proxy la aplicația de chat, Nginx poate trimite tot traficul către site-ul principal (IT Diebel). Atunci și chat.diebel.ro afișează IT Diebel.

**Ce trebuie pe server:**

- Un fișier de tip: `/etc/nginx/sites-available/chat.diebel.ro` cu:
  - `server_name chat.diebel.ro;`
  - `location / { proxy_pass http://127.0.0.1:3000; ... }`
- Simbolic activat: `/etc/nginx/sites-enabled/chat.diebel.ro` → pointing la fișierul de mai sus.
- Doar **pentru chat.diebel.ro** să se facă proxy la **portul 3000** (aplicația Next.js Chat). Site-ul IT Diebel trebuie să aibă **alt** `server_name` (ex. diebel.ro) și alt port/root, nu 3000.

### C) Aplicația de chat nu rulează pe 3000

Dacă PM2 nu pornește aplicația (sau a căzut), pe 3000 nu răspunde nimeni. Nginx poate avea eroare sau fallback către alt site (ex. IT Diebel), și tot „IT Diebel” vezi.

**Verificare pe server:**

```bash
pm2 list
ss -tulpn | grep 3000
```

Trebuie să existe un proces (ex. „chat”) care ascultă pe **3000**.

### D) Același server, dar rădăcina e site-ul IT Diebel

Dacă există un singur `server` (fără `server_name` sau cu server default) care servește site-ul IT Diebel, și **chat.diebel.ro** nu are propriul bloc cu `proxy_pass http://127.0.0.1:3000`, atunci chat.diebel.ro va primi același conținut ca site-ul principal → tot IT Diebel.

---

## 3. Ce există în proiectul Aplicatie Chat (align-app)

- **Aplicația** este Align (Login, Înregistrare, /app, mesaje, etc.).
- **Nu** conține rute /ro sau /m care să afișeze site-ul IT Diebel; regula din Cursor spune să nu se deschidă localhost:3000/ro sau /m pentru că **acolo** (în alt context/setup) apare site-ul Diebel IT.
- În cod apare doar „Diebel” (autor) și contact@diebel.ro; nu există logică care să încarce site-ul IT Diebel în aplicația de chat.

Deci: dacă „online” vezi IT Diebel, problema e **unde** intri (URL) și **cum** e configurat serverul (Nginx + ce rulează pe 3000), nu în codul aplicației de chat.

---

## 4. Pași de verificat pe server (rezumat)

1. **URL corect:** intri la **https://chat.diebel.ro** (nu diebel.ro / www).
2. **Nginx:** există `server_name chat.diebel.ro` și `proxy_pass http://127.0.0.1:3000;` doar pentru acel domeniu.
3. **Aplicația:** pe server, în `Aplicatie-Chat/align-app`: `npm run build`, `pm2 start npm --name "chat" -- run start`, procesul „chat” rulează și ascultă pe 3000.
4. **Restart:** după modificări: `sudo systemctl restart nginx`, `pm2 restart chat`.

Dacă toate sunt ok, **chat.diebel.ro** va afișa aplicația de chat (Align), nu IT Diebel.
