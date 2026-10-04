# Apeluri primite pe iOS (PushKit VoIP + CallKit)

Aplicația iOS (`align-ios/`) este un shell **WKWebView** peste `chat.diebel.ro`, la fel ca
aplicația Android. Apelul propriu-zis rulează în WebView, cu același stack WebRTC testat în
producție. Nativ rămâne doar partea pe care web-ul nu o poate face: **trezirea aplicației și
ecranul de apel al sistemului**.

> Notă istorică: a existat un experiment cu WebRTC nativ (SPM `stasel/WebRTC`) și un ecran de apel
> propriu. A fost eliminat — dubla implementare a stackului de apel nu se justifica, iar varianta
> nativă era incompletă. Vezi `align-ios/README.md`.

## Backend (deja în repo)

| Componentă | Rol |
|------------|-----|
| `UserPushDevice.apnsVoipToken` | Token PushKit (hex) per dispozitiv |
| `POST /api/me/push-token` | Body `{ "apnsVoipToken": "...", "platform": "ios" }` |
| `lib/apnsVoipPush.ts` | Trimite la APNs cu `apns-push-type: voip`, topic `{bundleId}.voip` |
| `POST /api/call/ring` | După pending incoming: FCM (Android) + **VoIP** (iOS) |

## Variabile de mediu (server)

- `APNS_KEY_ID` — Key ID din Apple Developer
- `APNS_TEAM_ID` — Team ID
- `APNS_PRIVATE_KEY` — conținut fișier `.p8` (newlines ca `\n`)
- `APNS_BUNDLE_ID` — trebuie să coincidă cu **PRODUCT_BUNDLE_IDENTIFIER** din
  `align-ios/project.yml`, adică **`ro.diebel.chatapp`**
- `APNS_USE_SANDBOX=true` — build-uri **Development** din Xcode; producție App Store: omite

Migrare DB: `npx prisma migrate deploy` (include `apnsVoipToken`).

## Flux apel primit

1. La pornire, `VoipPushManager` cere token PushKit.
2. Tokenul este trimis la `/api/me/push-token` **din WebView** (`WebScripts.registerVoipToken`),
   ca să folosească automat cookie-ul de sesiune — fără duplicare a autentificării în nativ.
3. Celălalt utilizator apelează → `POST /api/call/ring` → server emite **VoIP push**
   (trezește aplicația chiar dacă e închisă complet).
4. `VoipPushManager` primește payload-ul (`roomId`, `callerId`, `callerName`, `audioOnly`) →
   `CXProvider.reportNewIncomingCall` → **ecran de apel al sistemului** (lock screen, sonerie nativă).
5. **Răspunde** → `CXAnswerCallAction` → notificarea `.diebelOpenCall` → WebView-ul încarcă
   `/app/call/{roomId}`.
6. Când web-ul iese din ruta de apel, `updateCallChrome` apelează `endActiveCall()` și închide
   și ecranul de sistem.

**Obligatoriu (Apple):** fiecare push VoIP primit trebuie raportat la CallKit, altfel iOS oprește
aplicația. Payload-urile invalide sunt raportate și încheiate imediat
(`reportAndImmediatelyEnd`).

## Reguli

- Fără polling ca trigger principal pentru apeluri primite pe iOS.
- `aps-environment` din `Diebel/Diebel.entitlements` trebuie să corespundă tipului de build
  (Xcode îl comută la `production` pentru Archive/App Store).
- Testează pe **dispozitiv fizic**; PushKit/CallKit nu funcționează complet pe simulator.
