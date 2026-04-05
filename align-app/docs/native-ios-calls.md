# Apeluri native iOS (PushKit VoIP + CallKit + WebRTC)

Flux paralel cu web-ul **Align**: apelul critic nu trece prin Safari/WebKit; folosește **APNs VoIP**, **CallKit** și **WebRTC** nativ (SPM `WebRTC`).

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
- `APNS_BUNDLE_ID` — trebuie să coincidă cu **CFBundleIdentifier** din Xcode (ex. `com.align.app`)  
- `APNS_USE_SANDBOX=true` — build-uri **Development** iOS; producție App Store: `false` sau omit  

Migrare DB: `npx prisma migrate deploy` (include `apnsVoipToken`).

## Flux apel

1. iOS pornește `PKPushRegistry` → primește VoIP token → `POST /api/me/push-token`.  
2. Celălalt utilizator → `POST /api/call/ring` → server emite **VoIP push** (wake, chiar dacă app terminat).  
3. `VoipPushManager` primește payload (`roomId`, `callerId`, `callerName`, `audioOnly`, `ts`) → `CXProvider.reportNewIncomingCall` → **ecran sistem** (lock screen, fullscreen, sonerie nativă).  
4. **Accept** → `CXAnswerCallAction` → `WebRtcCallManager` : `ice-config` + `signaling-token` + WebSocket (același protocol ca web) + `RTCPeerConnection`.  
5. **Închide** → cleanup + `CXEndCallAction` / tranzacție CallKit.

## Proiect Xcode

Folder `align-ios/`: rulezi **XcodeGen** (`brew install xcodegen && xcodegen generate`), deschizi `Align.xcodeproj`, setezi **Signing & Capabilities**:

- Push Notifications  
- Background Modes: **Voice over IP**, **Audio**, **Remote notifications**  

`Align/Info.plist`: `ALIGN_API_BASE` (REST, ex. `https://chat.diebel.ro`) și `ALIGN_SIGNALING_WS_BASE` (WSS VPS, ex. `wss://ws.diebel.ro`) — **hosturi diferite**, la fel ca pe Vercel. Verificare: `curl -sS https://chat.diebel.ro/api/native-config`.

`Align.entitlements`: `aps-environment` = `development` sau `production` după tipul build-ului (trebuie să corespundă cu certificatul APNs).

## Reguli

- Fără polling ca trigger principal pe client iOS pentru incoming.  
- Fără Web Audio / PWA pentru sirenă.  
- Pornește pe **dispozitiv fizic**; PushKit/CallKit au suport limitat pe simulator.

## SFU (opțional)

P2P rămâne în `WebRtcCallManager`; pentru scalare: LiveKit / mediasoup + token scurt — înlocuiești stratul ICE/semnalizare păstrând CallKit + PushKit pentru deschiderea apelului.
