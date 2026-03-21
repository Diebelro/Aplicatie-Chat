# Ce face scriptul / ce faci tu

## Ce am pregătit în repo (automat, local)

- **`apply-on-vps.sh`** — pe server, copiază configurile Nginx în locul corect, scoate symlink-urile care provoacă **conflict `ws.diebel.ro`**, rulează **`nginx -t`** și **`reload`**.

Important: pentru **`ws.diebel.ro`** folosește **`nginx-ws.diebel.ro.conf.example`** (semnalizare pe **4001**). Fișierul **`nginx-ws.diebel.ro.conf`** din repo e marcat **DEPRECATED** (trimitea tot la 3000).

## Ce rămâne pentru tine (pe VPS, o dată sau după fiecare schimbare de config)

### 1. Urcă folderul `turn` pe server (WinSCP e ok)

Asigură-te că pe server ai același conținut ca în repo, inclusiv:

- `apply-on-vps.sh`
- `nginx-turn.diebel.ro.conf`
- `nginx-ws.diebel.ro.conf.example`
- `call-signaling.service.example` (sau `call-signaling.service` editat de tine)

Exemplu destinație: `/root/turn/` sau `/srv/aplicatie-chat/align-app/turn/`.

### 2. SSH pe VPS și rulează

```bash
cd /calea/catre/turn
sudo bash apply-on-vps.sh
```

### 3. (Opțional) Instalare serviciu semnalizare Node

Doar dacă ai deja codul aplicației pe server (`call-signaling-server.mjs`) și calea din unit e corectă:

```bash
cd /calea/catre/turn
sudo INSTALL_SYSTEMD=1 bash apply-on-vps.sh
```

Apoi verifică / editează **`/etc/systemd/system/call-signaling.service`** (în special **`WorkingDirectory`**) și creează **`align-app/.env.signaling`** cu `SIGNALING_TOKEN_SECRET` (vezi comentariile din `.example`).

### 4. Ce nu poate face scriptul în locul tău

- **Certificate Let’s Encrypt** pentru `ws.diebel.ro` / `turn.diebel.ro` (certbot sau echivalent).
- **DNS** (A record către IP-ul VPS).
- **coturn** (firewall 3478/5349, `install-coturn.sh` rulat manual dacă îl folosești).
- **Variabile pe Vercel** (`NEXT_PUBLIC_SIGNALING_WS_URL`, secrete TURN, etc.).
- **Repo aplicație** pe `/srv/...` dacă vrei semnalizare locală — trebuie să existe înainte de `systemctl start call-signaling`.

---

Rezumat: **tu** urci fișierele + **SSH** + **`sudo bash apply-on-vps.sh`**. Restul (DNS, TLS, DB, Vercel) rămân în conturile tale.
