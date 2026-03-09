# Nginx: chat.diebel.ro

Pe **serverul Linux** (unde rulează nginx), fă următoarele.

## 1. Deschide fișierul

```bash
sudo nano /etc/nginx/sites-available/chat.diebel.ro
```

## 2. Înlocuiește blocul `location /` existent cu:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Salvează: `Ctrl+O`, Enter, apoi `Ctrl+X`.

## 3. Testează și repornește nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

Dacă `nginx -t` afișează "syntax is ok", configurația e validă.
