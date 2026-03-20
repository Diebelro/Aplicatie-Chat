# Fix: `ws.diebel.ro` arată 404 Next / conflict Nginx

## Simptom

- `curl https://ws.diebel.ro/health` returnează **HTML** (Next/Vercel), nu **`ok`**
- `nginx -t` afișează: **`conflicting server name "ws.diebel.ro" … ignored`**

## Cauză

Două fișiere Nginx definesc același **`server_name ws.diebel.ro`**. Nginx păstrează **primul** și **ignoră** al doilea (de obicei configul corect cu `/health` → 4001).

Configul vechi din repo **`turn/nginx-ws.diebel.ro.conf`** face `location /` → **3000** (Next) — **nu** îl folosi pentru semnalizare.

## Ce faci pe VPS (copy-paste)

### 1) Vezi ce fișiere folosesc `ws.diebel.ro`

```bash
grep -l "ws\.diebel\.ro" /etc/nginx/sites-available/* 2>/dev/null
ls -la /etc/nginx/sites-enabled/
```

### 2) Dezactivează **toate** symlink-urile care țin de `ws` (apoi pui unul singur corect)

```bash
sudo rm -f /etc/nginx/sites-enabled/ws.diebel.ro.conf
sudo rm -f /etc/nginx/sites-enabled/nginx-ws.diebel.ro.conf
```

*(Dacă `ls sites-enabled` arată **alt** nume cu diebel/ws, șterge și pe acela: `sudo rm -f /etc/nginx/sites-enabled/NUME`)*

### 3) Instalează **doar** exemplul corect (din repo pe server)

```bash
sudo cp /srv/aplicatie-chat/align-app/turn/nginx-ws.diebel.ro.conf.example /etc/nginx/sites-available/ws.diebel.ro.conf
sudo ln -sf /etc/nginx/sites-available/ws.diebel.ro.conf /etc/nginx/sites-enabled/ws.diebel.ro.conf
```

### 4) Verifică că **nu** mai există alt `server_name ws.diebel.ro` în `sites-enabled`

```bash
grep -r "server_name.*ws\.diebel\.ro" /etc/nginx/sites-enabled/
```

Ar trebui să apară **doar** în `ws.diebel.ro.conf` (sau de două ori în același fișier pentru blocurile 80/443 — e OK).

### 5) Test și reload

```bash
sudo nginx -t
```

**Fără** linia `conflicting server name "ws.diebel.ro"`.

```bash
sudo systemctl reload nginx
curl -sS https://ws.diebel.ro/health
```

→ **`ok`**

## Cloudflare

Dacă `ws` e **proxied** (nor portocaliu) către Vercel, vei vedea tot Next. Pune **`ws`** pe **DNS only** (gri) → IP **178.104.2.31** (VPS).

## Script automat de diagnostic (opțional)

După `git pull` pe VPS:

```bash
bash /srv/aplicatie-chat/align-app/scripts/diagnose-nginx-ws-conflict.sh
```
