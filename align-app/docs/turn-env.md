# TURN — variabile de mediu (local & Vercel)

Mesajul runtime **`FATAL: TURN IS REQUIRED – CALLS WILL NOT WORK`** vine din `align-app/instrumentation.ts`, care apelează `runTurnEnvStartupCheck()` din `lib/webrtc/startupTurnCheck.ts`. Acel check (nelogat aici) cere prezența valorilor pentru:

| Variabilă | Rol |
|-----------|-----|
| `NEXT_PUBLIC_TURN_URLS` | Listă de URI-uri TURN (`turn:` / `turns:`), JSON array sau separate prin virgulă — vezi `validateTurnUrlsForIceConfig` în `lib/webrtc/turnEnv.ts`. |
| `TURN_REALM` | Trebuie să coincidă cu `realm=` din coturn. |
| `TURN_STATIC_SECRET` | Același secret ca `static-auth-secret` din coturn (doar server). |

`GET /api/call/ice-config` folosește aceleași nume (`TURN_REALM`, `TURN_STATIC_SECRET`, `NEXT_PUBLIC_TURN_URLS`).

**Notă:** o linie `TURN_URLS=...` în `.env.local` este utilă doar ca reminder operațional; **aplicația nu citește `TURN_URLS` pentru ICE** — variabila care oprește FATAL-ul pentru URL-uri este **`NEXT_PUBLIC_TURN_URLS`**.

## Local

- Fișier: **`align-app/.env.local`** (deja ignorat de git — vezi `.gitignore` în root și `align-app/.env.local`).
- Înlocuiește placeholder-ele cu valorile reale de la coturn / DNS (fără a le comite).

Validare fără a afișa secrete:

```bash
npm run check:turn-env
```

Pentru **tot** pachetul minim „producție” (DB, NextAuth, semnalizare, TURN, `EXPECTED_DB_ENV=prod`):

```bash
npm run check:online-env
```

## Vercel (manual)

1. **Project Settings → Environment Variables**
2. Adaugă **`NEXT_PUBLIC_TURN_URLS`**, **`TURN_REALM`**, **`TURN_STATIC_SECRET`** pentru **Preview** și **Production** (și **Development** dacă folosești preview local legat de Vercel).
3. **Redeploy** proiectul după salvare (variabilele noi nu se aplică mereu la deploy-uri vechi).

### Monorepo

În setările proiectului Vercel, verifică **Root Directory** = **`align-app`**. Dacă rămâne rădăcina monorepo-ului, build-ul poate eșua sau poate ignora `align-app/.env` așteptat.

## Debug deploy (logs)

Exemplu cu un deployment existent:

```bash
npx vercel inspect dpl_744RDicaiUnWprskHQEphj1wUWCD --logs
```

Opțional, așteaptă finalul stream-ului:

```bash
npx vercel inspect dpl_744RDicaiUnWprskHQEphj1wUWCD --logs --wait
```

Înlocuiește ID-ul cu cel din dashboard-ul Vercel (Deployments → deployment → URL / id).
