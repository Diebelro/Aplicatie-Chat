# Diebel Android — Versiune 1.0.0 (început nou)

| Ce | Fișier |
|----|--------|
| **Test pe telefon** | `align-android\Diebel-V1.0.0-TELEFON.apk` |
| **Play Console** (după test OK) | `play-store-assets\Diebel-V1.0.0-Play-Console.aab` |

Build:

```bat
cd align-android
gradlew exportReleaseArtifacts
```

În app: **Setări → Despre** arată **1.0.0**.

**Notă Play:** dacă ai încărcat deja versiunea 27 în consolă, la publicare viitoare `versionCode` trebuie **mai mare decât 27** (nu poți reveni la 1 pe același package).
