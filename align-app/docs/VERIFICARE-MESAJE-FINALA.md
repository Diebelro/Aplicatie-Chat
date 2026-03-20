# Verificare finală – Zona mesaje (închidere zi)

## 1. POST /api/me/read

**Confirmare:**
- **Când se apelează:** La deschiderea conversației în `app/app/chat/[id]/page.tsx` – în `useEffect` la mount (după `fetchOther`), cu `body: JSON.stringify({ otherId })`, și la fiecare tick de polling (~400 ms) prin `markRead()`.
- **Răspuns 200:** Handler-ul returnează `NextResponse.json({ ok: true })` după `prismaMarkConversationAsRead(userId, otherId)` (Prisma) sau după `setConversationRead` + `markConversationMessagesAsRead` (store).
- **SEEN în DB:** `prismaMarkConversationAsRead` execută `prisma.message.updateMany` cu `where: { fromUserId: otherId, toUserId: meId, seenAt: null }`, `data: { status: "SEEN", seenAt: new Date() }` – deci toate mesajele necitite de la `otherId` către `userId` sunt marcate SEEN.

**Cum poți verifica manual:**  
Deschizi o conversație, în Network (F12) vezi `POST /api/me/read` cu status 200. În DB, mesajele de la celălalt către tine au `status = 'SEEN'` și `seenAt` setat.

---

## 2. GET /api/messages

**Confirmare:**
- **Forma răspunsului:**  
  `{ messages, areFriends, matchId, currentUserId }`  
  (Nu există cheie `list` – array-ul este sub cheia **`messages`**.)
- **Fiecare element din `messages`:**  
  `id`, `fromId`, `toId`, `text`, `at`, **`status`** (string: `"SENT"` | `"SEEN"`), **`seenAt`** (ISO string sau `null`), `attachmentUrl`, `attachmentContentType`.
- **Ordine pe server:** Mai întâi `prismaMarkConversationAsRead(userId, withId)`, apoi `prismaGetMessagesBetween(userId, withId)`, apoi mapare cu `status` și `seenAt` explicite.

**Cum poți verifica manual:**  
În Network, la `GET /api/messages?with=...` răspunsul JSON conține `currentUserId` și `messages`; fiecare mesaj are `status` și `seenAt`.

---

## 3. GIF: A trimite → 1 bifă; B deschide → 2 bife în 0–3 s

**Nu se poate genera GIF din cod.** Mai jos e un **checklist** pentru înregistrare (ex. OBS, Loom, ShareX):

1. **Dispozitiv A (expeditor):** Deschide conversația cu B, trimite un mesaj.
2. **Verificare pe A:** Mesajul tău arată **1 bifă** (Trimis) imediat.
3. **Dispozitiv B (destinatar):** Deschide conversația cu A (în maxim 2–3 secunde).
4. **Verificare pe A:** În 0–3 secunde (polling 400 ms), la mesajul tău apar **2 bife albastre** (Citit).
5. Opțional: pe B, la mesajele primite de la A, nu se afișează bife (bifele sunt doar pe mesajele expeditorului).

**Sugestie:** Înregistrare 10–15 s: A trimite → 1 bifă → B deschide chat → 2 bife pe A. Export ca GIF sau scurt clip.

---

## 4. Badge „Mesaj primit”

**Comportament confirmat:**
- **Unde apare:** Pe lista de **Mesaje** (`/app/messages`) – coloana „necitite” și text „X necitite”; pe **Profiluri** (`/app/profiles`) – starea de card „Mesaj primit” (culore distinctă); în **header/footer** – badge-ul cu `totalUnread` pe linkul „Mesaje”.
- **Când dispare pentru o conversație:** Când **tu** deschizi acea conversație: se apelează `POST /api/me/read` cu `otherId` = acel utilizator → mesajele de la el către tine sunt marcate SEEN → serverul raportează 0 necitite pentru acea conversație.
- **Actualizare în UI:**
  - **Lista Mesaje:** Ascultă evenimentul `align:conversation-read` și face refetch la conversații → `unreadCount` se actualizează, deci badge-ul per conversație dispare doar pentru conversația deschisă.
  - **Profiluri:** Ascultă `align:conversation-read` și refetch profiluri → cardul „Mesaj primit” dispare pentru acel utilizator.
  - **Layout (badge total în header/footer):** După modificarea de azi, layout-ul ascultă **`align:conversation-read`** și apelează **`fetchUnread()`** imediat – deci badge-ul total (Mesaje) scade imediat când deschizi o conversație, fără să aștepți următorul interval de 1 s.

**Modificare făcută azi:** În `app/app/layout.tsx` s-a adăugat listener `align:conversation-read` care apelează `fetchUnread()`, astfel că badge-ul total se actualizează imediat la deschiderea conversației.

---

## 5. Footer (Mesaje / Matches / Descoperă) și input chat pe mobil

**Verificare:**
- **Footer (bottom nav):** Este în `app/app/layout.tsx`, vizibil doar pe mobil (`md:hidden`), `fixed bottom-0`, cu `paddingBottom: max(0.5rem, env(safe-area-inset-bottom))` și `paddingTop: 0.5rem`. Înălțime efectivă ~56px + padding.
- **Spațiu sub conținut pe mobil:** `<main>` are **`pb-24`** (96px) pe mobile, astfel încât conținutul (inclusiv formularul de mesaje) rămâne deasupra barei fixe. Inputul de chat este în interiorul acestui `main`, deci **nu este acoperit** de footer.
- **Formular chat:** Are `pb-[env(safe-area-inset-bottom,0)]` pentru safe area pe dispozitive cu notch/home indicator.

**Concluzie:** Footer-ul nu acoperă inputul; layout-ul este stabil pe mobil datorită `pb-24` pe `main` și safe-area pe form. Nu s-au făcut modificări în footer în această sesiune.

---

## Modificare efectuată azi (finalizare)

- **app/app/layout.tsx:** Listener pentru `align:conversation-read` care apelează `fetchUnread()` – badge-ul „Mesaje” (total necitite) se actualizează imediat când utilizatorul deschide o conversație.

---

## Semnătură verificare

| Punct | Status | Notă |
|-------|--------|------|
| 1. POST /api/me/read | ✅ Confirmat | Apel la deschidere + polling; 200; updateMany SEEN în DB. |
| 2. GET /api/messages | ✅ Confirmat | Răspuns: `messages`, `currentUserId`; fiecare mesaj: `status`, `seenAt`. |
| 3. GIF 1 bifă → 2 bife | 📋 Checklist | Nu se poate genera GIF; s-a furnizat checklist pentru înregistrare. |
| 4. Badge „Mesaj primit” | ✅ Îmbunătățit | Dispare pentru conversația citită; layout actualizează totalUnread la `align:conversation-read`. |
| 5. Footer + input mobil | ✅ Confirmat | main pb-24; input neacoperit; footer stabil. |

**Ziua pentru zona de mesaje se consideră închisă** după ce rulezi manual checklist-ul de la punctul 3 (GIF) și validezi pe device real că bifele și badge-urile se comportă conform descrierii.
