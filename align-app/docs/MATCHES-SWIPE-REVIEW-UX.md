# Matches & swipe review — decizie UX (final release cycle)

## Motor (neschimbat)

- `GET /api/swipes/review-queue`
- `POST /api/swipe`
- Rută UI: `/app/review-swipes?focus=<userId>` (mută user-ul focusat primul; salvare doar la reapăsare Like / Pass).

Fără API noi, fără schimbări Prisma pentru acest flux.

## Puncte de intrare (aprobat)

| Unde | Rol |
|------|-----|
| **Potriviri** — buton pe card (Vote + „Like / pass”) | intrare principală, contextuală |
| **Descoperă** — CTA după match | același URL cu `focus`, util imediat post-match |

**Fără** link global în navbar (desktop / mobil) către recenzare — redundant.

## Ciclu ulterior (doar idee, neimplementat)

Înlocuirea navigării către `/app/review-swipes` cu panel/modal în Potriviri, **păstrând aceleași endpoint-uri** — doar după decizie de produs separată.
