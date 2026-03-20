# Semnalizare pe VPS — copy-paste (ws.diebel.ro / port 4001)

Eu (în Cursor) **nu pot** intra pe serverul tău. În repo am pus scriptul care automatizează **npm ci**, **.env.signaling**, **systemd**. Tu rulezi comenzile de mai jos pe **SSH (VPS)**.

## 0) O singură dată — cod pe server

Dacă **nu** ai încă repo-ul:

```bash
sudo mkdir -p /srv/aplicatie-chat
sudo chown "$USER:$USER" /srv/aplicatie-chat
cd /srv/aplicatie-chat
git clone https://github.com/Diebelro/Aplicatie-Chat.git .
```

Apoi **actualizează** mereu înainte de install:

```bash
cd /srv/aplicatie-chat && git pull
cd align-app
```

## 1) Instalare automată (din repo)

```bash
cd /srv/aplicatie-chat/align-app
bash scripts/install-signaling-vps.sh
```

- Creează **`.env.signaling`** din exemplu dacă lipsește.
- Deschide și **schimbă secretul** (min 16 caractere, **același** ca `SIGNALING_TOKEN_SECRET` sau `NEXTAUTH_SECRET` pe **Vercel**):

```bash
nano /srv/aplicatie-chat/align-app/.env.signaling
```

## 2) Systemd + pornire (sudo)

```bash
cd /srv/aplicatie-chat/align-app
bash scripts/install-signaling-vps.sh /srv/aplicatie-chat/align-app --install-systemd
```

Scriptul: generează `/etc/systemd/system/call-signaling.service` cu căile corecte, setează owner **www-data** pe tot `align-app` (dacă folosești același folder și pentru altceva, verifică manual).

Verificare:

```bash
curl -sS http://127.0.0.1:4001/health
```

→ trebuie **`ok`**. Dacă nu: `journalctl -u call-signaling -n 40 --no-pager`

Dacă `https://ws.diebel.ro/health` arată **404 Next** sau `nginx -t` zice **conflicting server name**: → **[VPS-nginx-ws-conflict-FIX.md](./VPS-nginx-ws-conflict-FIX.md)**

## 3) Nginx (TLS + `/health` + `/ws`)

```bash
sudo cp /srv/aplicatie-chat/align-app/turn/nginx-ws.diebel.ro.conf.example /etc/nginx/sites-available/ws.diebel.ro.conf
sudo ln -sf /etc/nginx/sites-available/ws.diebel.ro.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Certificat Let’s Encrypt pentru **`ws.diebel.ro`** trebuie deja emis (căile din exemplu: `/etc/letsencrypt/live/ws.diebel.ro/...`).

## 4) Test din lume

```bash
curl -sS https://ws.diebel.ro/health
```

→ **`ok`**.

## 5) Vercel (nu pe VPS)

`NEXT_PUBLIC_SIGNALING_WS_URL=wss://ws.diebel.ro` (sau `wss://ws.diebel.ro/ws` — clientul normalizează).

---

Detalii extra: [DEPLOY-signaling-on-vps.md](./DEPLOY-signaling-on-vps.md)
