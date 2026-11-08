# Deploy Chat Diebel — Hetzner (producție)

Producția rulează pe serverul Hetzner `178.104.2.31`, nu pe Vercel:

```
Internet → nginx (80/443, Let's Encrypt)
   chat.diebel.ro → 127.0.0.1:3002 → container Docker align-app-app-1 (Next.js standalone)
   ws.diebel.ro   → 127.0.0.1:4001 → call-signaling.service (systemd)
   turn.diebel.ro → coturn (3478)
Postgres: container align-app-postgres-1 (DB diebel_chat, volum align-app_postgres_data)
Upload-uri chat: volum align-app_chat_uploads (CHAT_LOCAL_UPLOAD=true)
Sursă pe server: /root/Aplicatie-Chat/align-app  (+ .env.production, docker-compose.override.yml)
```

## Deploy (o singură comandă, de pe PC)

```bash
cd align-app
npm run deploy:hetzner
```

Ce face (`scripts/deploy-hetzner.sh` → `deploy/hetzner-deploy.sh` pe server):

1. `tsc --noEmit` local.
2. Sincronizează sursa pe server (fără `node_modules`, `.next`, `.env*`, override).
3. Pe server: **backup** în `/root/backups/chat-deploy-<TS>/` (dump DB `pg_dump -Fc`, upload-uri, `.env.production`) + imaginea curentă etichetată `diebel-app:rollback`.
4. `docker compose build app` cu `BUILD_COMMIT_SHA` = commit local + marcaj dată (apare în `/api/health`).
5. `docker compose up -d app`, apoi health check: `127.0.0.1:3002/api/health`, `https://chat.diebel.ro/api/health`, `https://chat.diebel.ro/` toate 200.
6. La eșec: **rollback automat** la `diebel-app:rollback`.
7. Compară numărul de useri / mesaje / poze înainte și după.

## Rollback manual

```bash
ssh root@178.104.2.31 "bash /root/Aplicatie-Chat/align-app/deploy/hetzner-rollback.sh"
```

Restaurare DB (doar cu aprobarea proprietarului):

```bash
docker exec -i align-app-postgres-1 pg_restore -U diebel -d diebel_chat --clean --if-exists < /root/backups/chat-deploy-<TS>/diebel_chat.dump
```

## Backup automat

Dump zilnic la 03:15 în `/root/backups/db/diebel_chat-<data>.dump` și upload-uri în `/root/backups/uploads/`.

## Variabile

Toate în `/root/Aplicatie-Chat/align-app/.env.production` (nu în git). Lista și explicațiile: `.env.example`.
Pentru apeluri native Android prin FCM sunt necesare `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account din Firebase Console → proiect `chat-diebel`).
