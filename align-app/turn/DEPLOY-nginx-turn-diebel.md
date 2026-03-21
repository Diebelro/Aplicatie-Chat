# Deploy `turn.diebel.ro` pe VPS (Nginx)

**Rapid:** din folderul `turn` pe server: `sudo bash apply-on-vps.sh` (instalează și `ws` corect; vezi **`APPLY-ON-VPS.md`**).

---

Fișier în repo: **`nginx-turn.diebel.ro.conf`** — copiază conținutul în  
`/etc/nginx/sites-available/turn.diebel.ro` pe serverul Linux (SSH + `sudo`).

Înlocuiește `<cale_repo>` cu calea absolută către folderul unde ai `nginx-turn.diebel.ro.conf` (în repo: `align-app/turn/`).

```bash
sudo cp <cale_repo>/nginx-turn.diebel.ro.conf /etc/nginx/sites-available/turn.diebel.ro
sudo ln -sf /etc/nginx/sites-available/turn.diebel.ro /etc/nginx/sites-enabled/turn.diebel.ro
sudo nginx -t
sudo systemctl restart nginx
```

Exemplu: `sudo cp /home/deploy/align-app/turn/nginx-turn.diebel.ro.conf /etc/nginx/sites-available/turn.diebel.ro`

`nginx -t` trebuie să treacă înainte de restart.

---

## Note importante

1. **Același certificat ca la `ws.diebel.ro`** — OK dacă Let’s Encrypt a emis un certificat care include **ambele** nume (SAN: `ws.diebel.ro` + `turn.diebel.ro`). Căile `ssl_certificate` / `ssl_certificate_key` pot indica spre `live/ws.diebel.ro/`.
2. **`proxy_pass`** trebuie să ducă spre **portul pe care ascultă aplicația** din spate. În config e **3001**; dacă app-ul rulează pe alt port, editează doar acea linie în `sites-available/turn.diebel.ro`.
3. După **`nginx -t` OK** + **`systemctl restart nginx`**, `https://turn.diebel.ro` ar trebui să răspundă peste TLS (redirect 80→443 inclus).

> **WebRTC TURN (coturn)** folosește în mod normal **3478/5349** direct pe server, nu prin acest vhost HTTP. Vhost-ul `turn.diebel.ro` din Nginx e pentru **trafic HTTPS/HTTP** către procesul de pe `127.0.0.1:3001` — nu înlocuiește porturile STUN/TURN ale coturn.

---

## Verificare rapidă („verifica turn”)

Pe o mașină cu acces la internet (sau de pe VPS):

```bash
curl -sI http://turn.diebel.ro
# așteptat: 301 Location: https://turn.diebel.ro/...

curl -sI https://turn.diebel.ro
# așteptat: 200 (sau ce returnează app-ul din spate), fără erori certificat în browser

openssl s_client -connect turn.diebel.ro:443 -servername turn.diebel.ro </dev/null 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
# verifică că SAN include turn.diebel.ro
```

Configurația din repo rămâne cea cerută; alte fișiere Nginx din proiect nu au fost modificate aici.
