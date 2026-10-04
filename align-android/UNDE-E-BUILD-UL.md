# Diebel Android — Versiune 45.0.0 (versionCode 45)

| Ce | Fișier |
|----|--------|
| **Test pe telefon (WhatsApp)** | `align-android\Diebel-Instalare.apk` (sau `Diebel-V45-INSTALARE-TELEFON.apk`) |
| **Test direct (browser)** | https://chat.diebel.ro/download/diebel.apk |
| **Play Console** (după test OK) | `play-store-assets\Diebel-V45-Play-Console.aab` |

Build:

```bat
cd align-android
gradlew exportReleaseArtifacts
```

În app: **Setări → Despre** arată **45.0.0** (build **45**).

**Apeluri în fundal (v45):** FCM → notificare tip apel + ecran full-screen + sonerie nativă (ca WhatsApp), plus Telecom self-managed când e disponibil.
