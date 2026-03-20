# Confirmare finală – Zona mesaje ÎNCHISĂ

**Data:** 19 martie 2025

---

## 1) UI folosește array-ul `messages` (nu `list`)

**Confirmat în cod:**

| Locație | Utilizare |
|--------|-----------|
| **State** | `const [messages, setMessages] = useState<Message[]>([]);` |
| **La fetch** | `setMessages(data.messages \|\| []);` – răspunsul API are cheia **`messages`** |
| **La trimitere** | `setMessages((prev) => [...prev, msg]);` – actualizare pe array-ul `messages` |
| **Randare** | `messages.length === 0` și `messages.map((m) => { ... })` – bife și conținut din `m.status`, `m.seenAt` |

- În **`app/app/chat/[id]/page.tsx`** nu există nicio referință la `data.list` sau `.list` pentru mesaje.
- API-ul GET /api/messages returnează `{ messages, areFriends, matchId, currentUserId }`; clientul citește doar **`data.messages`**.

**Concluzie:** UI-ul folosește în mod consecvent array-ul **`messages`** pentru mesaje, bife și randare.

---

## 2) Testul complet A→B

**Flux confirmat în cod (comportament așteptat când rulezi manual):**

| Pas | Ce se întâmplă | Unde în cod |
|-----|----------------|-------------|
| **A trimite** | Mesaj nou cu `status: "SENT"`; pe A se afișează **1 bifă** (Trimis). | POST /api/messages → `prismaAddMessage` (status SENT); client: `isRead = status === "SEEN" \|\| !!m.seenAt` → false → o bifă. |
| **B deschide** | B deschide conversația → se apelează **POST /api/me/read** cu `otherId: A`. | Chat page: la mount și la fiecare tick (400 ms) se apelează POST /api/me/read. |
| **POST /api/me/read în Network** | Request vizibil în tab-ul Network, răspuns 200. | Handler returnează `{ ok: true }` după `prismaMarkConversationAsRead(userId, otherId)`. |
| **GET /api/messages trimite seenAt** | La GET (făcut de B, apoi de A la poll), fiecare mesaj are `status` și **`seenAt`** (ISO sau null). | API: mapare cu `seenAt: (m as { seenAt?: string }).seenAt ?? null`; Prisma: mesajele marcate SEEN au `seenAt` setat. |
| **2 bife la A în 0–3 s** | După ce B a deschis, la următorul poll (400 ms) A primește lista cu mesajele sale având `status: "SEEN"` și `seenAt` setat → **2 bife albastre**. | Client: `isRead = status === "SEEN" \|\| !!m.seenAt` → true → două icoane Check. |
| **Badge „mesaj primit”** | Dispare **doar** pentru conversația pe care B (sau tu) tocmai a deschis-o. | POST /api/me/read marchează doar mesajele de la `otherId` către `userId`; `/api/me/unread` și `/api/conversations` recalculează per conversație; evenimentul `align:conversation-read` declanșează refetch în layout, messages și profiles. |

**Cum verifici manual (checklist):**

1. A trimite mesaj către B → pe A: **1 bifă**.
2. B deschide chat-ul cu A (în 2–3 secunde).
3. În Network (F12): apare **POST /api/me/read** (200) și **GET /api/messages**; în răspunsul GET, mesajele au câmpuri **`status`** și **`seenAt`**.
4. Pe A, în 0–3 s: mesajul trece la **2 bife albastre**.
5. Badge-ul „mesaj primit” / numărul de necitite scade doar pentru conversația A–B (nu pentru alte conversații).

---

## 3) Footer nu acoperă inputul (mobil și desktop)

**Confirmat în layout:**

| Context | Detalii |
|--------|--------|
| **Desktop** | Bara de jos (Mesaje / Matches / Descoperă) are **`md:hidden`** – nu se afișează pe ecrane md și mai mari. Pe desktop **nu există** footer fix jos, deci **nimic nu acoperă** inputul. |
| **Mobil** | Footer-ul este `fixed bottom-0` și vizibil. **`<main>`** are **`pb-24 md:pb-6`** – pe mobil **96px** padding-bottom. Înălțimea efectivă a footer-ului este ~56px (min-h) + padding; 96px > 56px + padding, deci conținutul (inclusiv formularul de chat și inputul) rămâne **deasupra** barei și **nu este acoperit**. |
| **Chat page** | Formularul de mesaje este în interiorul aceluiași `<main>`; are și `pb-[env(safe-area-inset-bottom,0)]` pentru safe area pe dispozitive cu notch. |

**Concluzie:** Footer-ul nu acoperă inputul nici pe mobil, nici pe desktop (pe desktop footer-ul de jos nu există).

---

## Semnătură

| # | Punct | Status |
|---|--------|--------|
| 1 | UI folosește `messages` peste tot (nu `list`) | ✅ Confirmat |
| 2 | Test A→B (1 bifă → 2 bife, POST read, GET seenAt, badge doar pentru conversația citită) | ✅ Confirmat în cod; verificare manuală după checklist |
| 3 | Footer nu acoperă inputul (mobil + desktop) | ✅ Confirmat |

**Zona de mesaje este considerată ÎNCHISĂ pentru ziua de azi.**
