#!/bin/bash
# Rulează pe server (SSH) din: /var/www/chat.diebel.ro
# Utilizare: bash deploy-on-server.sh

set -e
cd /var/www/chat.diebel.ro

echo "=== 1. Șterg vechiul clone ==="
rm -rf Aplicatie-Chat

echo "=== 2. Clonez din GitHub ==="
git clone https://github.com/Diebelro/Aplicatie-Chat.git
cd Aplicatie-Chat/align-app

echo "=== 3. Instalare dependențe ==="
npm install

echo "=== 4. Build producție ==="
npm run build

echo "=== 5. Opresc procesul vechi (dacă există) ==="
pm2 delete chat 2>/dev/null || true

echo "=== 6. Pornesc aplicația cu PM2 ==="
pm2 start npm --name "chat" -- run start
pm2 save

echo "=== 7. Verific procesul ==="
ss -tulpn | grep node || true
pm2 list

echo "=== 8. Repornesc Nginx ==="
sudo systemctl restart nginx

echo "=== Gata. Verifică https://chat.diebel.ro ==="
