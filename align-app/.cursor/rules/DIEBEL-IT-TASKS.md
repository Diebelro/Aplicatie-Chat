# Regulă finală – Align App (Diebel IT)

Execută task-urile în ordine, fără clarificări, fără omisiuni. Nu modifica altceva în afara celor specificate.

---

## 1. CONFIGURARE BAZĂ DE DATE (OBLIGATORIU)

- Fișierul `.env` există; conține `DATABASE_URL=postgresql://user:parola@localhost:5432/align` (ajustează user/parola dacă e cazul).
- Rulează: `npx prisma db push` (sau `npx prisma migrate dev` dacă există migrări).
- Opțional: `npm run db:seed`.

## 2. CREAREA PRIMULUI ADMIN (OBLIGATORIU)

1. Cont normal la `/signup` (email + parolă).
2. Mergi la `/admin/setup`, introdu același email și parolă → contul devine admin.
3. După setup: `/admin/setup` devine inaccesibil (mesaj „Admin deja configurat”); `/admin` și rutele admin sunt accesibile doar pentru admin.

## 3. LOGIN / SESIUNI / REDIRECTURI (VERIFICARE)

- `/login` → redirect corect după autentificare (la `/app` sau `/completeaza-profilul`).
- `/app` → redirect la `/login` dacă userul nu e logat; la `/cont-blocat` dacă `isBanned`.
- `/admin` → acces doar pentru `role === "ADMIN"` sau `"SUPERADMIN"`; altfel redirect la `/admin/setup`.
- `/api/me` → returnează userul logat (cu `role`, `isBanned`).
- Middleware: permite acces fără auth doar la `/api/admin/setup-status` și `/api/admin/setup` (și celelalte rute publice listate).
- Validare sesiune: cookie `align_sid` sau header-e `x-session-token` + `x-user-id`; dacă lipsește cookie, se verifică `x-session-token`; dacă lipsesc ambele → neautentificat.

## 4. CONFIGURARE CONTACT (OBLIGATORIU PENTRU DIEBEL IT)

- Secțiunea Contact conține: `<section id="contact">`, `<input id="contact-subject" type="text" />`, `<textarea id="contact-message">`.
- Formularul trimite către `contact@diebel.ro` (fallback: `action="mailto:contact@diebel.ro"` cu `method="POST"` și `encType="text/plain"`).

## 5. INTEGRARE „DETALII LA CERERE” (OBLIGATORIU)

- În **CardUltra**: buton cu text „Detalii la cerere”, clasa `cu-details`, `onClick={() => handleDetailsRequest(title)}`.
- Import: `import { handleDetailsRequest } from "@/utils/handleDetailsRequest";`
- Fișierul `utils/handleDetailsRequest.ts`: setează `#contact-subject` la „Detalii la cerere – {context}”, scroll la `#contact`, focus pe `#contact-message`.

## 6. TESTARE COMPLETĂ (OBLIGATORIU)

Testează: Login → redirect; Signup; `/app` protejat; `/admin` protejat; `/admin/setup` doar înainte de primul admin; `/cont-blocat`; „Detalii la cerere” (scroll + autofill + focus); formular contact → mailto contact@diebel.ro; middleware blochează API-urile neautorizate; `/api/me` returnează userul corect.

## 7. REGULĂ FINALĂ PENTRU CURSOR

Execută toate task-urile de mai sus în ordine, fără să ceri clarificări, fără să omiți nimic, fără să modifici altceva în afara celor specificate. Continuă până la finalizarea completă.
