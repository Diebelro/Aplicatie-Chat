# Apeluri native Android (FCM + ConnectionService + WebRTC)

Arhitectură paralelă cu aplicația web **Align** (`align-app`): chat rămâne în Next.js; **apelul critic** pe Android rulează nativ (fără WebView WebRTC ca sursă unică de adevăr).

## Componente

| Parte | Locație |
|--------|---------|
| Proiect Android | `align-android/` (Kotlin, Android Studio) |
| Push server-side | `lib/fcmCallPush.ts` — trimis din `POST /api/call/ring` |
| Înregistrare token | `POST /api/me/push-token`, `DELETE /api/me/push-token` |
| Persistență token | Prisma `UserPushDevice` |

## Flux (producție)

1. Utilizatorul se autentifică în Align (web sau shell viitor cu WebView); clientul nativ salvează **`x-session-token`** + **`x-user-id`** (echivalent cookie `align_sid` + id utilizator).
2. Aplicația Android obține token **FCM** și îl trimite la `POST /api/me/push-token`.
3. Când apelantul apelează `POST /api/call/ring`, backend-ul:
   - persistă `PendingIncomingCall` (ca înainte);
   - trimite mesaj **data-only**, `android.priority: high`, cu `type=incoming_call`, `roomId`, `callerId`, `callerName`, `audioOnly`, `ts`.
4. `FirebaseMessagingService` primește datele **cu procesul mort sau ecran oprit** (în limitele politicii Google); pornește **`TelecomManager.addNewIncomingCall`** → **`AlignConnectionService`** → **`AlignConnection`** (sonerie/nivel sistem).
5. La **Răspunde**, se deschide `CallActivity`, care pornește **`WebRtcCallSession`**: `GET /api/call/ice-config`, `GET /api/call/signaling-token`, WebSocket pe același protocol ca `useWebRtcCall.ts`, `PeerConnection` nativ (bibliotecă WebRTC, nu WebView).

## Variabile de mediu (Vercel / server)

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (newline-uri ca `\n` în string)

Fără acestea, `POST /api/call/ring` continuă să funcționeze pentru web (polling `/api/call/incoming`); **FCM nu trimite nimic**.

## Migrare DB

```bash
cd align-app
npx prisma migrate deploy
```

## Configurare Android

**Critic:** `align.apiBaseUrl` (REST) și `align.signalingWsUrl` (WebSocket) sunt **două hosturi diferite** în producție DIEBEL: `https://chat.diebel.ro` vs `wss://ws.diebel.ro`. Dacă pui ambele pe domeniul Vercel, WebSocket **nu** merge. Verificare: `curl -sS https://chat.diebel.ro/api/native-config`.

1. Firebase Console: adaugă aplicație Android cu pachet **`ro.diebel.chat`**, descarcă `google-services.json` înlocuind `align-android/app/google-services.json`.
2. `align-android/local.properties` (nu comita) — vezi `local.properties.example`:

```properties
sdk.dir=C:\\Users\\...\\AppData\\Local\\Android\\Sdk
align.apiBaseUrl=https://chat.diebel.ro/
align.signalingWsUrl=wss://ws.diebel.ro
```

3. **Rebuild Release** după orice schimbare de URL (BuildConfig).

4. Build în Android Studio (Gradle 8.9).

## SFU (opțional, recomandat la scară)

P2P rămâne în `WebRtcCallSession`; pentru conferințe mari înlocuiești straturile ICE + semnalizare cu **LiveKit** sau **mediasoup**: backend emite token scurt de acces, clientul se conectează la room SFU. Semnalizarea custom Align poate rămâne pentru „ring” + coordonare, sau poți muta totul pe serverul SFU.

## Reguli respectate

- Fără workaround-uri de autoplay în browser pentru sirenă critică.
- Fără Web Audio ca singură sirenă pe Android nativ.
- Fără dependență de service worker ca trigger principal pentru apel.
