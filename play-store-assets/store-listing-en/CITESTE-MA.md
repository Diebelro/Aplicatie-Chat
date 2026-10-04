# Diebel — Store listing EN (en-US)

Copiază textele în Play Console → **Store listing** → **Default – English (United States)**.

## Texte (copy-paste)

| Câmp Play Console | Fișier |
|-------------------|--------|
| App name | `01-app-name.txt` |
| Short description (max 80) | `02-short-description.txt` |
| Full description | `03-full-description.txt` |

## Grafice — de unde le iei

| Câmp Play Console | Folder | Fișier de upload |
|-------------------|--------|------------------|
| **App icon** 512×512 | `04-app-icon/` | `UPLOAD-THIS-app-icon-512.png` |
| **Feature graphic** 1024×500 | `05-feature-graphic/` | `UPLOAD-THIS-feature-graphic-1024x500.png` |
| **Phone screenshots** (2–8, min 4 recomandat) | `06-phone-screenshots/` | `01` … `04` (generate automat) + adaugă tu din telefon mesaje/apel |
| Tablet 7" (opțional) | `07-tablet-7inch-optional/` | gol — poți refolosi screenshot-urile telefon |
| Tablet 10" (opțional) | `08-tablet-10inch-optional/` | gol |
| Chromebook (opțional) | `09-chromebook-optional/` | gol |
| Video YouTube (opțional) | `10-video-optional/` | lasă gol |

## Screenshot-uri telefon — ce ai acum

Automat (1080×1920) din site live:
- `01-landing-home.png` — pagina principală
- `02-login.png` — autentificare
- `03-signup.png` — înregistrare
- `04-download.png` — download APK

**Recomandat:** fă 2–4 poze **din telefon cu app instalată** (logat):
- lista mesaje / chat
- discover / profiluri
- ecran apel sau setări

Pune-le în același folder `06-phone-screenshots/` ca `05-messages.png`, `06-discover.png`, etc.

## Refacere screenshot-uri web

```bash
cd align-app
node scripts/capture-play-store-screenshots.mjs
```

## AAB upload

`play-store-assets/Diebel-V39-Play-Console.aab`
