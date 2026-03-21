# Deploy `ws.diebel.ro` pe VPS (Nginx)

**Rapid:** pe server, din folderul `turn`: `sudo bash apply-on-vps.sh` (vezi **`APPLY-ON-VPS.md`**).

---

Fișierul **activ** din repo: **`nginx-ws.diebel.ro.conf.example`** → copiază în  
`/etc/nginx/sites-available/ws.diebel.ro.conf`.

**Nu** folosi **`nginx-ws.diebel.ro.conf`** (fără `.example`) — e deprecat (proxy la 3000). Vezi `docs/VPS-nginx-ws-conflict-FIX.md`.

Pe **serverul Linux** (SSH), după ce ai certificatele Let’s Encrypt pentru `ws.diebel.ro`:

Înlocuiește `<cale_repo>` cu calea absolută către `align-app/turn/`.

```bash
sudo cp <cale_repo>/nginx-ws.diebel.ro.conf.example /etc/nginx/sites-available/ws.diebel.ro.conf
sudo ln -sf /etc/nginx/sites-available/ws.diebel.ro.conf /etc/nginx/sites-enabled/ws.diebel.ro.conf
sudo nginx -t
sudo systemctl reload nginx
```

Exemplu: `sudo cp /srv/aplicatie-chat/align-app/turn/nginx-ws.diebel.ro.conf.example /etc/nginx/sites-available/ws.diebel.ro.conf`

`nginx -t` trebuie să afișeze **syntax is ok** înainte de reload.

---

**Notă:** `nginx-ws.diebel.ro.conf.example` face proxy **`/health`** și **`/ws`** → **`127.0.0.1:4001`** (semnalizare). Restul căilor pe host → 404.
