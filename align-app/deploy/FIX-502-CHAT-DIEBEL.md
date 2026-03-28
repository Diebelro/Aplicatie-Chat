# Remediere 502 pe `chat.diebel.ro`

**502 Bad Gateway** înseamnă: Nginx (sau alt proxy) rulează, dar **nu primește răspuns OK** de la aplicația Next.js din spate.

Codul `align-app` compilează; problema e **pe server** (proces oprit, port greșit, config SSL fără `proxy_pass`).

---

## Verificare rapidă (pe VPS, SSH)

### 1) Next.js ascultă pe 3000?

Producția folosește `npm run start` → **`next start --port 3000`** (vezi `package.json`).

```bash
curl -sI http://127.0.0.1:3000/api/health
```

- **Așteptat:** `HTTP/1.1 200` și JSON cu `"ok":true`.
- **Connection refused** → Next **nu rulează** sau e pe **alt port** → vezi pașii 2–3.

### 2) Pornește aplicația (manual, test)

```bash
cd /calea/către/align-app   # ex. /srv/aplicatie-chat/align-app
export NODE_ENV=production
npm run build   # dacă nu ai deja .next
npm run start
```

Lasă terminalul deschis și retestează `curl -sI http://127.0.0.1:3000/api/health`.

### 3) Pornește cu systemd (recomandat)

Copiază și adaptează `deploy/systemd/align-chat.service.example` în `/etc/systemd/system/align-chat.service`, apoi:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now align-chat
sudo systemctl status align-chat
```

### 4) Nginx: același port ca `proxy_pass`

În site-ul pentru `chat.diebel.ro`, `proxy_pass` trebuie să ducă la **același port** pe care ascultă `next start` (implicit **3000**).

Verifică:

```bash
sudo nginx -t
sudo grep -r proxy_pass /etc/nginx/sites-enabled/
```

Folosește fișierul **`deploy/nginx-chat.diebel.ro.conf`** (include HTTPS + headere pentru Next/Auth).

**Greșeală frecventă:** Certbot a creat bloc `listen 443 ssl` dar **fără** `location / { proxy_pass ... }` → tot 502 pe HTTPS.

### 5) Variabile de mediu pe producție

Pe același host unde rulează app-ul, în `.env` sau systemd `Environment=`:

| Variabilă | Valoare (exemplu) |
|-----------|-------------------|
| `NEXTAUTH_URL` | `https://chat.diebel.ro` |
| `NEXT_PUBLIC_APP_URL` | `https://chat.diebel.ro` |
| `PUBLIC_APP_URL` | `https://chat.diebel.ro` |
| `DATABASE_URL` | URL Neon / Postgres |

Dacă folosești **`https://www.chat.diebel.ro`** în browser, pune **acel** URL peste tot (sau redirecționează `www` → fără `www` în Nginx).

După schimbare: `sudo systemctl restart align-chat` (sau echivalent).

---

## Dacă hostezi pe Vercel (nu VPS)

502 pe domeniu custom apare când **ultimul deploy a eșuat** sau proiectul e misconfigurat.

1. Vercel → Project → **Deployments** → ultimul deploy **Ready**?
2. **Settings → Domains** → `chat.diebel.ro` verificat (DNS corect).
3. **Root Directory** = `align-app` dacă repo-ul e monorepo.
4. Env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `PUBLIC_APP_URL` (același URL public).

Test: deschide `https://TU-DOMENIU.vercel.app/api/health` — dacă merge dar domeniul nu, e **DNS / domeniu**.

---

## După ce dispare 502

1. `https://chat.diebel.ro/api/health` → 200.
2. Reset parolă: link din email trebuie să folosească **același** host ca în env (`PUBLIC_APP_URL`).
