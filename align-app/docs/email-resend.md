# Email (Resend) – checklist

## Variabile

| Variabilă | Rol |
|-----------|-----|
| `RESEND_API_KEY` | Cheie din Resend → API Keys |
| `RESEND_FROM_EMAIL` | Opțional. Implicit în cod: `Align <contact@diebel.ro>` |
| **`EMAIL_PUBLIC_APP_URL`** | Opțional. Doar pentru linkuri din email (override). Ex. `https://chat.diebel.ro` |
| **`PUBLIC_APP_URL`** | După cel de mai sus: bază pentru link-uri în email. Ex. `https://chat.diebel.ro` |
| `NEXT_PUBLIC_APP_URL` | Fallback; folosit și în client. În **production**, dacă rezultatul e `https://diebel.ro`, `getPublicAppUrl()` îl schimbă în `https://chat.diebel.ro` (cert apex). |

**Reset parolă fără site public (doar `npm run dev`):** după „Trimite link”, dacă contul există în DB, API returnează `devResetLink` (localhost) și pagina „Ai uitat parola?” îl afișează — linkul din email poate duce la `https://diebel.ro` și nu se deschide până nu e deploy. În producție câmpul `devResetLink` nu există.

## Domeniu Resend

1. Resend → **Domains** → `diebel.ro`
2. DNS la **Hetzner** (TXT `resend._domainkey`, MX + TXT `send`, etc.)
3. **Verify** până status **Verified**. Fără asta, `from` cu `@diebel.ro` → 403.

## Test din app

Oprește `npm run dev` dacă `prisma generate` dă EPERM, apoi:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

**Email de test (doar dev):**

```bash
curl -X POST http://localhost:3005/api/dev/resend-test -H "Content-Type: application/json" -d "{\"to\":\"emailul-tau@exemplu.com\"}"
```

## Fluxuri

- **Reset parolă:** `POST /api/auth/forgot-password` → Resend + link cu `getPublicAppUrl()` (`EMAIL_PUBLIC_APP_URL` → `PUBLIC_APP_URL` → `NEXT_PUBLIC_APP_URL`)
- **Verificare după signup:** la creare cont (Prisma) se trimite link către `/verify-email?token=...`
- **Confirmare:** `POST /api/auth/verify-email` `{ "token": "..." }`
- **Retrimite:** `POST /api/auth/resend-verify` `{ "token": "..." }` (token din linkul vechi, chiar expirat, dacă rândul încă există în DB)
