# Diebel Android 36.0.0 — Play Console

## Upload acum

| Fișier | Cale |
|--------|------|
| **AAB (verificare Play)** | `play-store-assets\Diebel-V36-Play-Console.aab` |
| **APK test telefon** | https://chat.diebel.ro/download/diebel.apk |
| **Icon 512** | `play-store-assets\app_icon_512.png` |
| **Feature graphic** | `play-store-assets\feature_graphic.png` |

| Câmp | Valoare |
|------|---------|
| Package | `ro.diebel.chat` |
| Version name | `36.0.0` |
| Version code | `36` |

## Note lansare

- RO: `RELEASE_NOTES_RO.txt`
- EN: `RELEASE_NOTES_EN.txt`

## Înainte de Submit (checklist rapid)

- [ ] Test apel audio + video pe 2 telefoane (cască + difuzor)
- [ ] Test mesaje: câmp scris, atașamente, apel din chat
- [ ] Verifică Setări → Despre: **36.0.0** (build **36**)
- [ ] Play Console → Data safety + Content rating completate
- [ ] Screenshot-uri telefon (login, discover, mesaje, apel)
- [ ] `versionCode` 36 > ultima versiune deja uploadată pe același package

## Health producție

- https://chat.diebel.ro/api/healthz → `ok: true`
- Signaling: `wss://ws.diebel.ro`
- TURN: `turn.diebel.ro`
