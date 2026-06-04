# Diebel — fișier pentru Google Play Console

## Încarcă acest fișier (AAB, nu APK)

```
c:\Projects\Aplicatie Chat\play-store-assets\Diebel-PLAY-CONSOLE.aab
```

Copie identică: `align-android\Diebel-PLAY-CONSOLE.aab`

| Câmp Play Console | Valoare |
|-------------------|---------|
| **Package** | `ro.diebel.chat` |
| **Version name** | `1.2.7` |
| **Version code** | `27` |
| **Target SDK** | 35 |
| **Min SDK** | 28 |

## Pași în Play Console

1. https://play.google.com/console → aplicația **Diebel**
2. **Production** (sau **Testing → Internal testing** pentru test) → **Create new release**
3. **App bundles** → **Upload** → selectează **`Diebel-PLAY-CONSOLE.aab`**
4. **Release notes** → text din `RELEASE_NOTES_RO.txt` (sau `RELEASE_NOTES_EN.txt`)
5. **Review and roll out**

## Grafice (dacă lipsesc)

| Asset | Fișier |
|-------|--------|
| Icon 512×512 | `play-store-assets/app_icon_512.png` |
| Feature graphic 1024×500 | `play-store-assets/feature_graphic.png` |

## Important

- Play Console acceptă **.aab**, nu .apk pentru publicare.
- **Nu** crea aplicație nouă — același package `ro.diebel.chat`.
- Version code **27** trebuie să fie mai mare decât orice versiune deja încărcată.
- Dacă contul e încă suspendat, upload-ul merge doar după **appeal acceptat**.

## Test pe telefon (înainte de rollout)

`align-android\Diebel-INSTALARE.apk` — același build ca AAB-ul de mai sus (semnat release).

Transfer: USB, Google Drive sau `adb install -r Diebel-INSTALARE.apk` (nu WhatsApp — poate corupe APK-ul).
