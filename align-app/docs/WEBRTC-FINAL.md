# WebRTC — checklist final (aplicație vs infrastructură)

Acest document delimitează clar ce poți verifica **din aplicația Next.js pe Vercel** și ce rămâne **pe servere** (VPS, coturn, rețea).

## 1) Ce înseamnă „gata” / „nu gata”

### ✅ Aplicația este gata (`readyFromApp: true`)

Endpoint: **`GET /api/webrtc-ready-check`** (cu sesiune logată) sau scriptul:

```bash
cd align-app
VERIFY_WEBRTC_COOKIE="…" npm run verify:webrtc:final
```

Când răspunsul are:

- `readyFromApp: true`
- `summary: "APP_READY_WAITING_FOR_VPS"`

înseamnă că, **în Vercel/Next**, sunt îndeplinite verificările de mai jos (fără a expune secrete):

- utilizator autentificat;
- `NEXT_PUBLIC_SIGNALING_WS_URL` setat (client poate ști unde e WebSocket-ul);
- WebRTC nu e dezactivat explicit prin `NEXT_PUBLIC_WEBRTC_ENABLED`;
- `TURN_STATIC_SECRET` și `TURN_AUTH_SECRET` prezente;
- logica internă echivalentă cu **signaling-token** și **ice-config** reușește;
- în `NEXT_PUBLIC_TURN_URLS` există **cel puțin un STUN și un TURN** (detectate din prefixele `stun:` / `turn:` / `turns:`).

**Mesajul din script:** `✅ WEBRTC READY (WAITING FOR VPS / COTURN)`.

### ❌ Aplicația nu este gata (`readyFromApp: false`)

`summary` este **`APP_NOT_READY`**. Câmpul **`missingFromApp`** conține coduri concrete, de exemplu:

| Cod | Interpretare rapidă |
|-----|---------------------|
| `NOT_AUTHENTICATED` | Lipsește sesiunea — rulează check-ul din browser logat sau pune `VERIFY_WEBRTC_COOKIE`. |
| `MISSING_NEXT_PUBLIC_SIGNALING_WS_URL` | Variabila publică pentru WSS lipsește pe Vercel + **redeploy**. |
| `NEXT_PUBLIC_WEBRTC_DISABLED` | Feature oprit explicit în env. |
| `MISSING_TURN_STATIC_SECRET` / `MISSING_TURN_AUTH_SECRET` | Secret lipsă (ICE vs semnalizare); setează ambele (pot fi aceeași valoare ca la coturn, vezi `.env.example`). |
| `SIGNALING_TOKEN:…` | Secrete/token semnalizare invalide sau user inexistent în DB. |
| `ICE_CONFIG:…` | `NEXT_PUBLIC_TURN_URLS`, `TURN_REALM` sau config ICE invalidă. |
| `MISSING_STUN_IN_URLS` / `MISSING_TURN_IN_URLS` | Array-ul public trebuie să includă explicit STUN și TURN. |
| `RATE_LIMITED` | Prea multe cereri — reîncearcă după un minut. |

**Mesajul din script:** `❌ WEBRTC NOT READY` + lista `missingFromApp`.

---

## 2) Ce **NU** verifică aplicația

Chiar dacă **`readyFromApp: true`**, următoarele **nu** sunt testate de Next/Vercel:

- dacă procesul **`call-signaling-server.mjs`** rulează pe VPS;
- dacă **coturn** este pornit și corect legat de `TURN_STATIC_SECRET` / `TURN_REALM`;
- **firewall** / reguli de securitate (UDP/TCP TURN, porturi proxy WSS);
- **DNS** / certificate TLS pentru `wss://` și domeniile din `NEXT_PUBLIC_TURN_URLS`;
- calitatea apelului (NAT, relay, bandwidth).

Răspunsul API include mereu **`requiresExternalInfra: true`** și **`externalInfraChecklist`** ca memento scurt.

---

## 3) Ce ai de făcut ulterior pe VPS (doar listă)

După ce aplicația raportează **READY (waiting for VPS)**:

1. **Pornești serverul de semnalizare** (`server/call-signaling-server.mjs` sau serviciu systemd) cu același secret ca `SIGNALING_TOKEN_SECRET` / `NEXTAUTH_SECRET` ca în Vercel.
2. **Pornești coturn** cu `static-auth-secret` / realm aliniate la `TURN_STATIC_SECRET` și `TURN_REALM`.
3. **Verifici porturile** (proxy WSS către semnalizare, TURN UDP/TCP/TLS conform doc-ului tău de deploy) și TLS pentru `NEXT_PUBLIC_SIGNALING_WS_URL`.

Detalii operaționale: `docs/calls.md`, `docs/webrtc-signaling-vercel.md`, `docs/hetzner-production-playbook.md`.

---

## 4) Alte endpoint-uri / scripturi

| Unealtă | Rol |
|---------|-----|
| `GET /api/webrtc-full-check` | Agregator pas-cu-pas (semnalizare, ICE, secrete); vezi `DEPLOY-ONLINE.md`. |
| `GET /api/webrtc-ready-check` | **Verdict unic** app-side: `APP_READY_WAITING_FOR_VPS` vs `APP_NOT_READY`. |
| `npm run verify:webrtc:final` | Rulează ready-check din CLI cu cookie. |
| `npm run verify:webrtc` | Full-check (mesaje diferite). |

Întotdeauna: **fără să expui token-ul WS sau parolele** — JSON-urile sunt sanitizate.
