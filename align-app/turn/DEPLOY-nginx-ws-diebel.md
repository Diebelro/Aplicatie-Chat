# Deploy `ws.diebel.ro` pe VPS (Nginx)

Fișierul din repo: **`nginx-ws.diebel.ro.conf`** — conținut identic cu ce pui în  
`/etc/nginx/sites-available/ws.diebel.ro`.

Pe **serverul Linux** (SSH), după ce ai certificatele Let’s Encrypt pentru `ws.diebel.ro`:

Înlocuiește `<cale_repo>` cu calea absolută către folderul unde ai `nginx-ws.diebel.ro.conf` (în repo: `align-app/turn/`).

```bash
sudo cp <cale_repo>/nginx-ws.diebel.ro.conf /etc/nginx/sites-available/ws.diebel.ro
sudo ln -sf /etc/nginx/sites-available/ws.diebel.ro /etc/nginx/sites-enabled/ws.diebel.ro
sudo nginx -t
sudo systemctl restart nginx
```

Exemplu: `sudo cp /home/deploy/align-app/turn/nginx-ws.diebel.ro.conf /etc/nginx/sites-available/ws.diebel.ro`

`nginx -t` trebuie să afișeze **syntax is ok** înainte de restart.

---

**Notă DIEBEL (semnalizare WebRTC):** configurația de mai sus trimite tot traficul către **port 3000**. În playbook-ul apelurilor, procesul de semnalizare rulează de obicei pe **4001** cu path **`/ws`**. Dacă vrei strict serverul Node de signaling, folosește `turn/nginx-ws.example` (proxy către `127.0.0.1:4001` + upgrade WebSocket). Fișierul `nginx-ws.diebel.ro.conf` rămâne **exact** cum ai cerut, fără alte modificări Nginx în repo.
