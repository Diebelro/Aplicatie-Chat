# Align iOS — apeluri native (iOS 15+)

## Pregătire

1. macOS + Xcode 15+  
2. `brew install xcodegen`  
3. În `align-ios/`: `xcodegen generate`  
4. Deschide `Align.xcodeproj`  

## Apple Developer

- Identifiers: App ID cu **Push Notifications**  
- Key: **Apple Push Notifications service (APNs)** (fișier `.p8`) — folosit pe server în `APNS_*` env  
- Provisioning profile cu aceleași capabilități  
- În Xcode → Signing & Capabilities: **Push Notifications**, **Background Modes** (VoIP, Audio, Remote notifications)  

## Configurare URL

Editează `Align/Info.plist`:

- `ALIGN_API_BASE` — REST: același host ca `NEXT_PUBLIC_APP_URL` (ex. **`https://chat.diebel.ro`**, fără slash final).
- `ALIGN_SIGNALING_WS_BASE` — WebSocket: același ca `NEXT_PUBLIC_SIGNALING_WS_URL` pe Vercel (ex. **`wss://ws.diebel.ro`**; poți omite `/ws`, codul îl adaugă).

**Nu** folosi domeniul Vercel/Next pentru semnalizare — WS rulează pe VPS. Verificare: `curl -sS https://chat.diebel.ro/api/native-config`.

## Flux dev sesiune

1. Login în site; din cookie `align_sid` + `userId` le salvezi în ecranul SwiftUI.  
2. La primire token PushKit, aplicația îl trimite automat la `/api/me/push-token` dacă sesiunea e setată.  
3. Testează apel din web sau alt client către acest user.  

## Documentație

[`../align-app/docs/native-ios-calls.md`](../align-app/docs/native-ios-calls.md)

## Note WebRTC

Dependență SPM: [stasel/WebRTC](https://github.com/stasel/WebRTC). Dacă simboluri delegate diferă între versiuni, ajustează `WebRtcCallManager.swift` în Xcode (erorile de compilare indică protocolul exact).
