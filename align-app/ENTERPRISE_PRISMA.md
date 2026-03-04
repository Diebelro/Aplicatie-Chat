# Enterprise Prisma – Proiectul 1

Documentație pentru implementarea backend enterprise cu **Prisma** și **PostgreSQL**. Nu modifică UI, CSS, layout sau harta.

---

## 1. Funcții Prisma (`lib/repo-prisma.ts`)

Toate funcțiile sunt exportate și folosite de API-uri când `DATABASE_URL` este setat.

### Feed
| Funcție | Descriere |
|--------|------------|
| `prismaGetFeedCandidates(userId, filters)` | Returnează candidați neswipați cu filtre: vârstă, gen, distanță, țară, oraș, online, nume |
| `prismaHasUserSwiped(userId, targetId)` | Verifică dacă userul a dat deja swipe la target |

### Swipe & Match
| Funcție | Descriere |
|--------|------------|
| `prismaHasSwiped(fromId, toId)` | Verifică dacă există swipe între cei doi |
| `prismaAddSwipe(fromId, toId, liked)` | Înregistrează swipe (like/pass) |
| `prismaIsMutualMatch(a, b)` | Verifică match mutual (amândoi au dat like) |
| `prismaAddMatch(userAId, userBId)` | Creează înregistrare Match |
| `prismaGetMutualMatchPartnerIds(userId)` | Set de id-uri parteneri cu match mutual |

### Mesaje
| Funcție | Descriere |
|--------|------------|
| `prismaGetMessagesBetween(userId1, userId2)` | Mesaje între doi useri, cu status SENT/DELIVERED/SEEN |
| `prismaAddMessage(fromId, toId, text)` | Adaugă mesaj (status SENT) |
| `prismaUpdateMessageStatus(messageId, status)` | Actualizează status: SENT, DELIVERED, SEEN |
| `prismaMarkConversationAsRead(meId, otherId)` | Marchează mesajele de la otherId către meId ca SEEN |
| `prismaGetUnreadFrom(meId, otherId)` | Număr mesaje necitite de la otherId către meId |
| `prismaGetConversations(userId)` | Listă conversații cu ultimul mesaj |

### Profil
| Funcție | Descriere |
|--------|------------|
| `prismaUpdateProfile(userId, data)` | Actualizează câmpuri Profile |
| `prismaUpsertProfilePhotos(userId, photoUrls)` | Setează poze profil (max 5) |
| `prismaSetProfileCompleted(userId)` | Setează `completedAt` pe profil |
| `prismaProfileCompleted(userId)` | Returnează dacă profilul e complet |
| `prismaUpdateUserEmail(userId, email)` | Actualizează email pe User |

### Locație
| Funcție | Descriere |
|--------|------------|
| `prismaUpsertLocation(userId, lat, lng)` | Creează/actualizează Location |
| `prismaDeleteLocation(userId)` | Șterge locația userului |
| `prismaGetMyLocation(userId)` | Returnează `{ lat, lng }` sau null |
| `prismaGetVisibleUsersForMap(meId)` | Useri vizibili pe hartă (showDistance + lastActive) |

### Premium
| Funcție | Descriere |
|--------|------------|
| `prismaActivatePremiumDemo(userId, planId, currentPeriodEnd?)` | Activează premium (fără plată reală) |
| `prismaIsPremium(userId)` | Verifică dacă userul are premium activ |

### Rate limit
| Funcție | Descriere |
|--------|------------|
| `prismaLogRateLimit({ identifier, endpoint, count, windowStart })` | Înregistrează în RateLimitLog la 429 |

### Helper
| Funcție | Descriere |
|--------|------------|
| `findUserOrPrisma(userId)` | Returnează User din Prisma sau din store; null → rutele răspund 404 |
| `isPrismaAvailable()` | `true` dacă `DATABASE_URL` este setat |

---

## 2. API-uri

Toate rutele folosesc Prisma când `DATABASE_URL` este setat. La eroare Prisma răspund cu **500** (fără fallback la store).

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/api/me` | GET | Citire profil (findUserOrPrisma, prismaUpdateLastActive) |
| `/api/me` | POST | Salvare poziție (prismaUpsertLocation) |
| `/api/me` | PATCH | Actualizare profil + poze (max 5), prismaSetProfileCompleted când complet |
| `/api/feed` | GET | prismaGetFeedCandidates, filtre, sortare, ads; la 429 prismaLogRateLimit |
| `/api/swipe` | POST | prismaAddSwipe, prismaIsMutualMatch, prismaAddMatch; răspuns NO_MATCH / MATCH_CREATED |
| `/api/messages` | GET | prismaGetMessagesBetween (cu status), prismaUpdateLastActive |
| `/api/messages` | POST | prismaAddMessage |
| `/api/conversations` | GET | prismaGetConversations, prismaGetUnreadFrom |
| `/api/me/read` | POST | prismaMarkConversationAsRead |
| `/api/matches` | GET | prismaGetMutualMatches |
| `/api/me/location` | POST | prismaUpsertLocation / prismaDeleteLocation |
| `/api/map` | GET | prismaGetMyLocation, prismaGetVisibleUsersForMap |
| `/api/subscription/create` | POST | prismaActivatePremiumDemo |
| `/api/me/premium` | GET | prismaIsPremium |
| `/api/me/settings` | GET/PATCH | Citire/actualizare setări (show_distance, show_online etc.) |
| `/api/me/password` | PATCH | prismaGetPasswordHash, prismaUpdatePassword |
| `/api/users/[id]` | GET | findUserOrPrisma |
| `/api/call/incoming` | GET | Placeholder (findUserOrPrisma) |

---

## 3. Fluxuri complete

### Autentificare
- **sessionAuth.getAuthenticatedUserId(request)** – citește doar `userId` din cookie `align_sid` sau header `x-user-id`. Nu verifică store-ul.
- Userii existenți doar în Prisma sunt acceptați.
- Rutele folosesc `findUserOrPrisma(userId)` și răspund cu **404** când userul nu există.

### Redirect-uri
- **Profil incomplet** → `/completeaza-profilul` (după login când `profileComplete === false`).
- **Completează profilul** → pagina `/completeaza-profilul` redirecționează la `/app/profile`.
- **După completare** → utilizatorul merge la `/descopera` (din app).
- **După login** → `profileComplete ? "/app" : "/completeaza-profilul"` (în `app/login/page.tsx`).

### Mesaje – status
- **SENT** – la creare (prismaAddMessage).
- **DELIVERED** – setat prin prismaUpdateMessageStatus (opțional, la livrare).
- **SEEN** – la prismaMarkConversationAsRead (mesajele de la partener către mine sunt marcate SEEN).

### Swipe & Match
1. POST `/api/swipe` cu `{ toId, liked }`.
2. prismaHasSwiped → dacă deja swipat, răspuns `already: true`.
3. prismaAddSwipe(userId, toId, liked).
4. Dacă `liked === true`, prismaIsMutualMatch → dacă da, prismaAddMatch.
5. Răspuns: `status: "NO_MATCH"` sau `status: "MATCH_CREATED"`.

---

## 4. PostgreSQL

### Configurare
1. În **.env** (copiază din `.env.example`):
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/align"
   ```
2. Sincronizare schema:
   ```bash
   npm run db:push
   ```
   sau, pentru migrări versionate:
   ```bash
   npm run db:migrate
   ```

### Modele principale
- **User** – email, passwordHash, relații: profile, locations, swipes, matches, messages, premiumSubscriptions.
- **Profile** – userId (unique), name, username, bio, birthDate, gender, completedAt, lastActiveAt, showDistance, showOnline, etc., photos.
- **ProfilePhoto** – profileId, url, order (max 5 per profil).
- **Location** – userId (unique), latitude, longitude.
- **Swipe** – fromUserId, toUserId, liked (unique per pereche).
- **Match** – userAId, userBId (unique per pereche).
- **Message** – fromUserId, toUserId, text, status (SENT/DELIVERED/SEEN), deliveredAt, seenAt.
- **PremiumSubscription** – userId, planId, status, currentPeriodEnd.
- **RateLimitLog** – identifier, endpoint, count, windowStart.

---

## 5. Cum se rulează proiectul

```bash
# Instalare dependențe
npm install

# Setează DATABASE_URL în .env, apoi:
npm run db:push

# (Opțional) Seed date demo (idempotent: 10 useri demo, profiluri complete, poze, swipe-uri, match-uri, mesaje, locații, premium pentru 2 useri)
npm run db:seed

# Development
npm run dev
```

Aplicația rulează pe `http://localhost:3000` (sau portul configurat). Fără `DATABASE_URL`, API-urile folosesc fallback în memorie (store).

---

## 6. Cum se testează end-to-end

1. **Signup** – POST `/api/auth/signup` cu email, parolă, username → cont creat în Prisma.
2. **Login** – POST `/api/auth/login` → răspuns cu user + `profileComplete`; redirect conform regulilor.
3. **Completare profil** – PATCH `/api/me` cu nume, birthDate, gender, photos (max 5) → la completare se apelează prismaSetProfileCompleted.
4. **Feed** – GET `/api/feed` cu header `x-user-id` → candidați neswipați, filtre, ads.
5. **Swipe** – POST `/api/swipe` cu `toId`, `liked` → NO_MATCH sau MATCH_CREATED.
6. **Match-uri** – GET `/api/matches` → lista parteneri cu match mutual.
7. **Mesaje** – POST `/api/messages` (toId, text); GET `/api/messages?with=<id>` → mesaje cu status.
8. **Conversații** – GET `/api/conversations` → conversații + unread; POST `/api/me/read` cu otherId pentru marcare citit.
9. **Locație** – POST `/api/me/location` (latitude, longitude, location_enabled); GET `/api/map` → poziția mea + useri vizibili.
10. **Premium** – POST `/api/subscription/create` cu planId (monthly/yearly/lifetime) → prismaActivatePremiumDemo; GET `/api/me/premium` → prismaIsPremium.
11. **Rate limit** – multe cereri către același endpoint → 429 și prismaLogRateLimit.
12. **Setări** – GET/PATCH `/api/me/settings` (show_distance, show_online, etc.).
13. **Parolă** – PATCH `/api/me/password` cu oldPassword, newPassword → prismaGetPasswordHash, prismaUpdatePassword.

Folosește un client HTTP (Postman, curl) sau UI-ul aplicației cu sesiune (cookie sau x-user-id).

---

## 7. Cum se extinde proiectul

- **Noi câmpuri** – adaugă în `prisma/schema.prisma`, apoi `npm run db:push` sau migrare.
- **Noi API-uri** – creează rute în `app/api/...`; folosește `findUserOrPrisma` pentru auth și funcțiile din `lib/repo-prisma.ts` pentru date.
- **Noi funcții Prisma** – implementează în `lib/repo-prisma.ts` și expune prin API; păstrează pattern-ul de eroare (500 când Prisma e disponibil și apare excepție).
- **Rate limit** – la 429 apelează `prismaLogRateLimit` pentru audit.

---

## 8. Seed – date demo

Scriptul **prisma/seed.ts** este idempotent: poate fi rulat de mai multe ori (șterge întâi userii demo, apoi recreează).

Conține:
- **10 useri** – email `demo1@align.local` … `demo10@align.local`, parolă `Parola123`
- **Profiluri complete** – nume, username, bio, birthDate, gender, țară, oraș, `completedAt` setat
- **Poze** – între 2 și 5 per profil (URL-uri placeholder picsum.photos)
- **Locații** – coordonate în România (București, Cluj, Timișoara etc.)
- **Swipe-uri** – like-uri între useri
- **Match-uri** – 4 perechi mutual match (ex.: demo1–demo2, demo2–demo3, demo3–demo4, demo5–demo6)
- **Mesaje** – câteva conversații cu status SENT/DELIVERED/SEEN
- **Premium** – 2 useri (demo1: lifetime, demo2: yearly)
- **lastActiveAt** – 6 useri recent activi (5 min), 4 mai vechi (2 h)

Rulare:
```bash
npm run db:seed
# sau
npx prisma db seed
```

---

## 9. Troubleshooting

| Problemă | Soluție |
|----------|---------|
| `Environment variable not found: DATABASE_URL` | Setează în `.env`: `DATABASE_URL="postgresql://user:password@localhost:5432/align"` |
| `EPERM: operation not permitted` (Windows, la `prisma generate`) | Închide alte procese care folosesc proiectul (IDE, terminale, server Next); rulează din nou `npm run postinstall` sau `npx prisma generate` |
| 404 la API după login | Asigură-te că `findUserOrPrisma` găsește userul (cont creat cu Prisma/signup); verifică că header-ul `x-user-id` sau cookie-ul de sesiune este trimis |
| 500 la API cu Prisma | Verifică că PostgreSQL rulează și că schema este sincronizată (`npm run db:push`); verifică logurile serverului pentru excepții Prisma |
| Seed eșuează | Verifică că baza de date există și că `DATABASE_URL` este corect; rulează `npm run db:push` înainte de `npm run db:seed` |

---

*Document actualizat pentru Proiectul 1 – implementare enterprise Prisma + PostgreSQL.*
