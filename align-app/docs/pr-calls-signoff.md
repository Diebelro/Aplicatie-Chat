# PR sign-off — Voice/Video producție (copy în descrierea PR)

Înlocuiește placeholder-ele după ce rulezi pașii din `docs/hetzner-production-playbook.md`.

---

## Demo

- **Link video:** _URL (Loom / Drive / etc.)_
- Conținut minim: două browsere în apel P2P; secvență scurtă cu **UDP blocat** către `turn.diebel.ro:3478` și apel încă funcțional (fallback TCP/TLS).

---

## DNS + TLS

- [ ] `turn.diebel.ro` A → IP Hetzner — confirmat (`nslookup` / screenshot)
- [ ] `ws.diebel.ro` A → IP Hetzner — confirmat
- [ ] Certificate Let’s Encrypt valide pentru **ambele** hosturi (fără erori în browser / `curl -v`)

---

## Health signaling

```text
curl -sI "https://ws.diebel.ro/health?ping=1"
```

Lipește aici output-ul (status **200**). Opțional:

```bash
curl -s "https://ws.diebel.ro/health?ping=1"
# așteptat: ok
```

---

## TURN / relay (test UDP blocat)

- Metodă: _ex. firewall OS outbound UDP către IP-ul TURN sau port 3478 UDP blocat_
- În `chrome://webrtc-internals` (sau echivalent): candidați **relay** vizibili, apel stabil
- Notițe: _

---

## Long-call ~20 min

- Rezultat: _OK / probleme (jitter, drop)_
- getStats / webrtc-internals: _

---

## Vercel

- [ ] **Production** — toate variabilele din `docs/calls.md` / playbook secțiunea F
- [ ] **Preview** — aceleași variabile (sau notă dacă Preview nu testează apeluri)

---

## API (manual / autentificat)

- [ ] `GET /api/call/ice-config` — `ttl: 600`, credențiale prezente, fără secret static în JSON
- [ ] `GET /api/call/signaling-token` — `expiresInMs: 600000`, token prezent

---

**Semnătură:** _nume / dată_
