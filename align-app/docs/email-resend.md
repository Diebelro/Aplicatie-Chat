# Email (Resend) – checklist

## Variabile

| Variabilă | Rol |
|-----------|-----|
| `RESEND_API_KEY` | Cheie din Resend → API Keys |
| `RESEND_FROM_EMAIL` | Opțional. Implicit în cod: `Align <contact@diebel.ro>` |
| **`PUBLIC_APP_URL`** | **Prioritar** pentru link-uri în email (server). Ex. `https://chat.diebel.ro` |
| `NEXT_PUBLIC_APP_URL` | Fallback pentru email dacă lipsește `PUBLIC_APP_URL`; folosit și în client |

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

- **Reset parolă:** `POST /api/auth/forgot-password` → Resend + link cu `NEXT_PUBLIC_APP_URL`
- **Verificare după signup:** la creare cont (Prisma) se trimite link către `/verify-email?token=...`
- **Confirmare:** `POST /api/auth/verify-email` `{ "token": "..." }`
- **Retrimite:** `POST /api/auth/resend-verify` `{ "token": "..." }` (token din linkul vechi, chiar expirat, dacă rândul încă există în DB)
