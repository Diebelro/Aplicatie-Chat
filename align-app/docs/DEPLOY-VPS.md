# Deploy Diebel pe VPS (Hetzner / Linux) — fără Vercel

Stack: **Next.js** (`chat.diebel.ro`) + **server signaling WebSocket** (`ws.diebel.ro`)
rulate în **Docker**, în spatele lui **Caddy** (HTTPS automat). **coturn** rămâne separat
(`turn.diebel.ro`). Baza de date **Postgres (Neon)** e externă — nu se schimbă.

```
Internet ──▶ Caddy (80/443, TLS automat)
                ├── chat.diebel.ro ──▶ app:3000        (Next.js)
                └── ws.diebel.ro   ──▶ signaling:4001  (WebRTC /ws)
            coturn (3478/5349)  ── separat pe VPS
            Postgres ── Neon (extern)
```

---

## 1. DNS (la registrarul / panoul tău)

Pune ambele subdomenii pe IP-ul VPS-ului:

| Tip | Nume              | Valoare        |
|-----|-------------------|----------------|
| A   | `chat.diebel.ro`  | `IP_VPS`       |
| A   | `ws.diebel.ro`    | `IP_VPS`       |
| A   | `turn.diebel.ro`  | `IP_VPS`       |

Verifică: `nslookup chat.diebel.ro` → trebuie să arate IP-ul VPS-ului.

---

## 2. Pe VPS: instalează Docker (o singură dată)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # apoi delogare/relogare
docker compose version          # verifică plugin-ul compose
```

Deschide porturile în firewall (dacă ai `ufw`):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478          # coturn (dacă rulează pe acest VPS)
sudo ufw allow 5349/tcp
```

---

## 3. Adu codul pe VPS

```bash
git clone https://github.com/Diebelro/Aplicatie-Chat.git
cd Aplicatie-Chat/align-app
```

(La actualizări ulterioare: `git pull` în acest folder.)

---

## 4. Configurează variabilele de mediu

```bash
cp .env.production.example .env.production
nano .env.production
```

Completează cel puțin:
- `NEXTAUTH_SECRET` → `openssl rand -base64 48`
- `DATABASE_URL` + `DIRECT_URL` (din Neon)
- `SIGNALING_TOKEN_SECRET` (poate fi același ca `NEXTAUTH_SECRET`)
- `TURN_STATIC_SECRET` / `TURN_AUTH_SECRET` (identic cu `static-auth-secret` din coturn)
- `RESEND_API_KEY`, cheile VAPID, Firebase (dacă le folosești)

Editează și `Caddyfile` → schimbă `email contact@diebel.ro` cu emailul tău.

---

## 5. Pornește

Două scenarii:

### A) Server gol, all-in-one cu Caddy (HTTPS automat)

```bash
docker compose --profile standalone up -d --build
```

Caddy obține automat certificatele pentru `chat.diebel.ro` și `ws.diebel.ro`.

### B) Server care are DEJA nginx (ex. acest VPS) — recomandat aici

Pornește **doar aplicația** (nginx existent face proxy spre ea). Caddy și signaling
NU pornesc (sunt sub profilul `standalone`), ca să nu fure porturile 80/443:

```bash
docker compose up -d --build          # pornește doar `app`
```

Apoi în nginx, pe vhost-ul `chat.diebel.ro`, `proxy_pass http://127.0.0.1:<PORT>;`
unde `<PORT>` e cel publicat de `docker-compose.override.yml` (ex. 3002).

> ⚠️ Pe un server cu nginx, NU rula `--profile standalone` — Caddy ar intra în
> conflict pe 80/443 și ai primi `ERR_SSL_PROTOCOL_ERROR`.

Verifică:

```bash
docker compose ps
curl -I https://chat.diebel.ro/api/health   # 200 OK
```

---

## 6. Migrează schema bazei de date (o singură dată / la schimbări de schemă)

Rulează din interiorul containerului app (are `DATABASE_URL`/`DIRECT_URL`):

```bash
docker compose run --rm --entrypoint sh app -c "npx prisma migrate deploy"
# sau, dacă nu folosești migrări versionate:
# docker compose run --rm --entrypoint sh app -c "npx prisma db push"
```

> Notă: imaginea runtime e minimă. Dacă `prisma` CLI nu e prezent în runtime,
> rulează migrarea de pe mașina ta locală (cu același `.env.production`):
> `npx dotenv -e .env.production -- prisma migrate deploy`.

---

## 7. Actualizări (deploy nou)

```bash
cd Aplicatie-Chat/align-app
git pull
docker compose up -d --build
docker image prune -f
```

---

## 8. Comenzi utile

```bash
docker compose logs -f app           # log aplicație
docker compose logs -f signaling     # log semnalizare WebRTC
docker compose restart app           # restart rapid
docker compose down                  # oprește tot
```

---

## Ce s-a schimbat față de Vercel

- `vercel.json` **eliminat**.
- `next.config.js`: `output: "standalone"` (server Node autonom pentru Docker).
- Pozele din chat se salvează pe disc în volumul `chat_uploads` (`CHAT_LOCAL_UPLOAD=true`),
  nu pe Vercel Blob. Pachetul `@vercel/blob` rămâne în cod, dar nu e folosit dacă nu
  setezi `BLOB_READ_WRITE_TOKEN`.
- Baza de date Neon și coturn **nu se schimbă** (nu sunt Vercel).
- Domeniul rămâne `chat.diebel.ro` → aplicația Android (care încarcă `chat.diebel.ro/app`)
  funcționează fără modificări odată ce DNS-ul arată spre VPS și HTTPS e activ.
```
