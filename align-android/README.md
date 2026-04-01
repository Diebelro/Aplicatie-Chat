# Align Android — apeluri native

## Cerințe

- Android Studio Koala+ (JDK 17)
- Proiect Firebase cu FCM activat
- `google-services.json` în `app/` (înlocuiește șablonul din repo)

## Configurare

`local.properties` în rădăcina **align-android**:

```properties
sdk.dir=/path/to/Android/sdk
align.apiBaseUrl=https://YOUR_ALIGN_HOST
align.signalingWsUrl=wss://YOUR_WS_HOST/ws
```

Valorile devin `BuildConfig.API_BASE_URL` și `BuildConfig.SIGNALING_WS_BASE`.

## Prima rulare

1. Deschide folderul `align-android` în Android Studio.
2. Sync Gradle.
3. Pornește pe dispozitiv fizic (microfon/cameră; emulator fără Google Play poate eșua la FCM).

## Sesiune și FCM

1. După login în site, copiază din DevTools valoarea cookie **`align_sid`** și **userId**-ul tău.
2. În ecranul principal al aplicației: lipește, **Salvează sesiunea**, apoi **Înregistrează FCM la server**.
3. De pe alt cont, inițiază apel (`/api/call/ring`); acest telefon ar trebui să primească UI nativ de apel.

## Documentație flux detaliat

Vezi [`../align-app/docs/native-android-calls.md`](../align-app/docs/native-android-calls.md).

## Pachet și magazin

Schimbă `applicationId` în `app/build.gradle.kts` dacă publici sub alt nume. Pentru Play, urmează și politica **foreground service**, notificări și DATA SAFETY pentru FCM + apeluri.
