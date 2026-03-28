# Nginx: chat.diebel.ro

## Fișier recomandat

Folosește **`nginx-chat.diebel.ro.conf`** din acest folder — include **HTTPS**, **redirect de la :80** și headerele necesare pentru Next.js / NextAuth.

## Pași pe server (Linux)

1. **Certificat SSL** (dacă nu există):

   ```bash
   sudo certbot certonly --nginx -d chat.diebel.ro
   ```

   Sau adaptează căile `ssl_certificate` din config dacă certificatul e altundeva.

2. **Instalează site-ul Nginx:**

   ```bash
   sudo cp /calea/repo/align-app/deploy/nginx-chat.diebel.ro.conf /etc/nginx/sites-available/chat.diebel.ro
   sudo ln -sf /etc/nginx/sites-available/chat.diebel.ro /etc/nginx/sites-enabled/
   ```

3. **Testează și reîncarcă:**

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Asigură-te că Next.js rulează pe port 3000** (`npm run start` în `align-app`). Verificare:

   ```bash
   curl -sI http://127.0.0.1:3000/api/health
   ```

## 502 Bad Gateway?

Vezi **`FIX-502-CHAT-DIEBEL.md`** — de obicei procesul Next e oprit sau blocul `443` nu are `proxy_pass` corect.

## Doar HTTP (fără TLS) — doar test local

Pentru laborator poți folosi doar `location /` cu `proxy_pass http://127.0.0.1:3000` pe `listen 80` (vezi istoricul git sau comentarii din `nginx-chat.diebel.ro.conf`). În producție folosește mereu HTTPS.
