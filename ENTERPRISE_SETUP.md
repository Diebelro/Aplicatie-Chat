# Setup Enterprise (Prisma + PostgreSQL)

## 1. Variabile de mediu

În `.env` (nu commit):

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
NEXTAUTH_SECRET=un-string-secret-de-min-32-caractere
NEXTAUTH_URL=http://localhost:3000
```

## 2. Creare bază de date

```bash
npm run db:push
```

sau, pentru migrări:

```bash
npm run db:migrate
```

## 3. Comportament

- Când `DATABASE_URL` este setat, **login** și **signup** folosesc Prisma (User, Profile, ProfilePhoto, DeviceFingerprint).
- Login returnează `profileComplete`: dacă `false`, clientul redirecționează la `/completeaza-profilul` (apoi la `/app/profile`).
- NextAuth este configurat la `/api/auth/[...nextauth]` (Credentials provider cu Prisma); poți folosi `getServerSession(authOptions)` în pagini sau API.
- Restul API-urilor (feed, swipe, match, messages, map, premium) pot fi migrate treptat la Prisma folosind `lib/repo-prisma.ts` și `isPrismaAvailable()`.

## 4. Modele Prisma

- **User** – email, passwordHash
- **Profile** – date profil (username, bio, birthDate, gender, etc.), `completedAt` pentru redirect
- **ProfilePhoto** – max 5 poze per profil (order, url)
- **Location** – ultima poziție user (latitude, longitude)
- **Swipe** – (fromUserId, toUserId, liked)
- **Match** – pereche userAId, userBId
- **Message** – fromUserId, toUserId, text, status (SENT/DELIVERED/SEEN)
- **PremiumSubscription**, **Boost**, **DeviceFingerprint**, **RateLimitLog**

UI-ul existent nu a fost modificat; doar logica de date și redirect-urile au fost adăugate/adaptate.
