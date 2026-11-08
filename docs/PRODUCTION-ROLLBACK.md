# Production rollback (Chat Diebel pe Hetzner)

Producția este containerul Docker `align-app-app-1` pe `178.104.2.31` (nginx → 127.0.0.1:3002). Baza de date **nu** se restaurează automat; vezi secțiunea separată.

## 1. Rollback aplicație (imagine anterioară)

Fiecare deploy (`npm run deploy:hetzner`) etichetează imaginea veche ca `diebel-app:rollback` și face rollback singur dacă health check-ul pică. Manual:

```bash
ssh root@178.104.2.31 "bash /root/Aplicatie-Chat/align-app/deploy/hetzner-rollback.sh"
```

Verificare: `curl -s https://chat.diebel.ro/api/health` → `status: "ok"` și `commit.short` al versiunii vechi.

## 2. Restaurare bază de date (doar cu aprobare)

Dump-uri: `/root/backups/chat-deploy-<TS>/diebel_chat.dump` (la fiecare deploy) și `/root/backups/db/diebel_chat-<data>.dump` (zilnic 03:15).

```bash
docker exec -i align-app-postgres-1 pg_restore -U diebel -d diebel_chat --clean --if-exists < /root/backups/chat-deploy-<TS>/diebel_chat.dump
```

Upload-uri: `tar -C $(docker volume inspect align-app_chat_uploads --format '{{.Mountpoint}}') -xzf /root/backups/chat-deploy-<TS>/chat_uploads.tar.gz`

## 3. Rollback de cod (git)

Checkpoint-urile `scripts/checkpoint.ps1` creează tag-uri `prod-baseline-YYYY-MM-DD`. Pentru a reveni la un tag și a-l pune live:

```powershell
cd "C:\Projects\Aplicatie Chat"
git checkout prod-baseline-2026-11-08
cd align-app
npm run deploy:hetzner
```
