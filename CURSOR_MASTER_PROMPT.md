# MASTER PROMPT – Verificare și reparare completă (Login, Admin, Sesiuni)

**Rulează tot ce urmează fără să întrebi nimic, fără să te oprești, fără să ceri clarificări. Repară automat orice problemă găsești.**

---

## 1. OBIECTIV

Verifică **întregul proiect** (align-app) și repară **tot** ce ține de: **login**, **admin**, **sesiuni**, **rute**, **layout-uri**, **protecție admin**. Asigură-te că aplicația folosește **autentificare proprie** (nu NextAuth dacă nu e folosit în cod) și că fluxul login → sesiune → admin funcționează corect.

---

## 2. CE TREBUIE VERIFICAT ȘI REPARAT

### 2.1 Login și autentificare

- [ ] Există pagina de **login** (ex: `app/login/page.tsx` sau echivalent).
- [ ] Login trimite credențiale către un API (ex: `POST /api/auth/login` sau `POST /api/login`).
- [ ] După login reușit: **sesiunea este creată** (cookie sau token) și **userul este salvat** (localStorage/sessionStorage sau cookie).
- [ ] Răspunsul de la login include **user** (id, email, **role**, **isBanned** dacă există în model).
- [ ] Dacă `user.isBanned === true` → **redirect la o pagină „Cont blocat”** (ex: `/cont-blocat`), nu în aplicație.
- [ ] Repară orice rută de login inexistentă, API lipsă sau logică greșită.

### 2.2 Sesiuni

- [ ] Există un mecanism de **sesiune** (ex: cookie `align_session_token` sau header `x-session-token` + `x-user-id`).
- [ ] API-urile protejate verifică sesiunea (ex: `getAuthenticatedUserId(request)` sau middleware).
- [ ] La request-uri din app (ex: `/api/me`, `/api/messages`) se trimit header-ele de auth (ex: `getAuthHeaders()`: x-user-id, x-session-token, x-device-id).
- [ ] Repară orice API care ar trebui să verifice sesiunea dar nu o face, sau unde header-ele lipsesc.

### 2.3 Rol ADMIN și protecție admin

- [ ] Modelul **User** (Prisma sau store) are câmpul **role** (ex: `USER` | `ADMIN` | `SUPERADMIN`).
- [ ] La login, **role** este inclus în obiectul user returnat și salvat.
- [ ] **Toate rutele sub `/admin`** (inclusiv `/admin`, `/admin/users`, `/admin/reports`, `/admin/logs`, `/admin/setup`, `/admin/conversations`) sunt protejate astfel:
  - **`/admin/setup`**: accesibil **fără** să fii admin (pentru configurarea primului admin).
  - **Orice altă rută `/admin/*`**: doar dacă `role === "ADMIN"` sau `role === "SUPERADMIN"`. Altfel → **redirect** la `/admin/setup` (sau la `/` dacă setup nu e necesar).
- [ ] Layout-ul pentru `/admin` (`app/admin/layout.tsx`):
  - Verifică sesiunea (ex: `/api/me`).
  - Verifică `role === "ADMIN" || "SUPERADMIN"`; dacă nu → redirect `/admin/setup`.
  - Pentru pathname `/admin/setup` → afișează doar `children` (fără bara de navigare admin).
- [ ] Repară orice pagină admin care nu verifică rolul sau care permite acces fără admin.

### 2.4 Redirect-uri

- [ ] **Neautentificat** pe `/app/*` → redirect la **`/login`**.
- [ ] **User cu isBanned** (din storage sau `/api/me`) → redirect la **`/cont-blocat`**.
- [ ] **User fără rol admin** pe `/admin/*` (exclus `/admin/setup`) → redirect la **`/admin/setup`**.
- [ ] După **login reușit** → redirect la `/app` sau la pagina de completat profil, conform logicii existente.
- [ ] Repară orice redirect greșit sau lipsă.

### 2.5 Pagini admin obligatorii

- [ ] **`/admin`** – dashboard cu linkuri.
- [ ] **`/admin/setup`** – formular pentru primul admin (email + parolă cont existent).
- [ ] **`/admin/users`** – listă useri (cu search după email/id).
- [ ] **`/admin/users/[id]`** – detalii user (Ban/Unban, Șterge, Acordă Premium).
- [ ] **`/admin/reports`** – listă rapoarte.
- [ ] **`/admin/logs`** – loguri acțiuni admin.
- [ ] **`/admin/conversations`** – input pentru id conversație.
- [ ] **`/admin/conversations/[id]`** – vizualizare mesaje.
- Creează orice pagină sau rută API lipsă; repară link-urile din layout și dashboard.

### 2.6 API-uri admin

- [ ] **GET `/api/admin/setup-status`** – returnează `{ canSetup: boolean }` (true dacă nu există niciun ADMIN/SUPERADMIN).
- [ ] **POST `/api/admin/setup`** – body `{ email, password }`; verifică contul, setează rol ADMIN (doar dacă canSetup).
- [ ] **GET `/api/admin/users`** – listă useri (protejat admin).
- [ ] **GET/DELETE `/api/admin/users/[id]`** – detalii user / ștergere user (protejat admin).
- [ ] **POST `/api/admin/users/[id]/ban`** – BAN/UNBAN (protejat admin).
- [ ] **POST `/api/admin/users/[id]/premium`** – acordă Premium (protejat admin).
- [ ] **GET `/api/admin/reports`** – listă rapoarte (protejat admin).
- [ ] **GET `/api/admin/logs`** – listă loguri (protejat admin).
- [ ] **GET `/api/admin/conversations/[id]`** – mesaje conversație (protejat admin).
- [ ] **DELETE `/api/admin/messages/[id]`** – șterge mesaj (protejat admin).
- Repară sau creează orice rută API lipsă; asigură-te că toate verifică rolul ADMIN/SUPERADMIN (exclus setup).

### 2.7 API-uri auth și sesiune

- [ ] **POST `/api/auth/login`** (sau echivalent) – login cu email/parolă; returnează user (cu role, isBanned), session token, device id; setează cookie sesiune.
- [ ] **GET `/api/me`** – returnează userul curent (din cookie/sesiune); include **role** și **isBanned**.
- [ ] Middleware sau `getAuthenticatedUserId` folosit consistent la rutele protejate.
- Repară orice inconsistență între login, /api/me și cum se citește userul în frontend.

### 2.8 Layout-uri

- [ ] **Layout principal** (`app/layout.tsx`) – nu blochează rutele auth/admin.
- [ ] **Layout `/app`** (ex: `app/app/layout.tsx`) – verifică user din storage sau `/api/me`; dacă lipsă → redirect `/login`; dacă isBanned → redirect `/cont-blocat`.
- [ ] **Layout `/admin`** – comportament descris la 2.3 și 2.4.
- Repară orice layout care nu face verificările necesare.

---

## 3. REGULI DE EXECUȚIE

1. **Nu întreba** – ia decizii rezonabile pe baza codului existent (convenții, nume rute, tipuri).
2. **Nu te opri** – parcurge toate punctele; dacă ceva e ambiguu, alege varianta care respectă specificația de mai sus.
3. **Repară automat** – orice lipsă (pagină, rută API, verificare rol, redirect) trebuie creată sau corectată.
4. **Păstrează** – stilul și structura proiectului (Next.js App Router, Prisma dacă e folosit, getAuthHeaders/getAuthenticatedUserId dacă există).
5. **Nu schimba** – la cerere explicită – stack-ul (ex: nu înlocui auth-ul propriu cu NextAuth dacă proiectul nu folosește NextAuth).
6. După modificări: verifică că nu introduci erori de lint sau TypeScript; corectează-le dacă apar.

---

## 4. REZUMAT FINAL

După ce ai terminat, rezumă pe scurt:
- Ce ai verificat (login, sesiuni, admin, redirect-uri, pagini, API-uri).
- Ce ai reparat sau creat (listează fișierele sau zonele modificate).
- Dacă mai există limitări sau dependențe (ex: „Primul admin se configurează la /admin/setup după ce există cel puțin un cont la /signup”).

**Execută tot acum.**
