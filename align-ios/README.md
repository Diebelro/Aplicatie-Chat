# Diebel Chat — aplicația iOS

Shell nativ iOS pentru `chat.diebel.ro`, echivalentul aplicației Android din `align-android`.

**Nu este doar un „site într-o fereastră":** are ecran de apel nativ (CallKit), apeluri primite prin
push VoIP chiar cu aplicația închisă, geolocație nativă (CoreLocation) și permisiuni native de
cameră/microfon. Acest lucru contează enorm pentru aprobarea Apple — vezi secțiunea „Riscuri".

---

## ATENȚIE: ai nevoie de un Mac

**iOS nu se poate compila pe Windows.** Nu există nicio metodă oficială. Îți trebuie:

| Ce | Cost | Obligatoriu |
|---|---|---|
| Mac cu macOS recent + Xcode 15+ | de la ~500 € un Mac mini folosit | DA |
| Apple Developer Program | **99 $/an** | DA |
| iPhone fizic pentru testat apeluri | — | Da (PushKit nu merge pe simulator) |

**Alternativă fără Mac propriu:** servicii de „Mac în cloud" plătite la oră
(MacinCloud, Scaleway Mac mini, AWS EC2 Mac) sau build în cloud cu **Codemagic** / **Xcode Cloud**.
Tot ai nevoie de contul Apple Developer de 99 $/an.

---

## Pasul 1 — Generează proiectul Xcode (pe Mac)

```bash
brew install xcodegen
cd align-ios
xcodegen generate
open Diebel.xcodeproj
```

## Pasul 2 — Semnare și capabilități (în Xcode)

1. Selectează target-ul **Diebel** → tab **Signing & Capabilities**
2. Bifează **Automatically manage signing**, alege **Team**-ul tău
3. Verifică **Bundle Identifier**: `ro.diebel.chatapp`
4. Apasă **+ Capability** și adaugă:
   - **Push Notifications**
   - **Background Modes** → bifează **Voice over IP** și **Audio, AirPlay, and Picture in Picture**

## Pasul 3 — Cheia APNs pentru apeluri (o singură dată)

Serverul trimite deja push VoIP (`align-app/lib/apnsVoipPush.ts`). Trebuie doar cheia:

1. [developer.apple.com](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Keys** → **+**
2. Nume: `Diebel APNs`, bifează **Apple Push Notifications service (APNs)** → Continue → Register
3. **Descarcă fișierul `.p8`** (se descarcă o singură dată!) și notează **Key ID** + **Team ID**
4. Pe VPS, în `align-app/.env.production`, adaugă:

```env
APNS_KEY_ID=cheia_ta
APNS_TEAM_ID=team_id_ul_tau
APNS_BUNDLE_ID=ro.diebel.chatapp
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...conținutul .p8 cu \n...\n-----END PRIVATE KEY-----"
```

`APNS_BUNDLE_ID` **trebuie** să fie identic cu Bundle Identifier-ul din Xcode
(serverul trimite pe topicul `ro.diebel.chatapp.voip`).

Pentru build-uri de test din Xcode adaugă și `APNS_USE_SANDBOX=true`; scoate-l pentru App Store.

## Pasul 4 — Testează pe iPhone real

Conectează iPhone-ul, alege-l ca destinație, apasă ▶. Verifică:

- [ ] Se încarcă `/app`, login-ul merge, sesiunea se păstrează după închidere
- [ ] Apel audio și video (cere cameră + microfon o singură dată)
- [ ] Harta și „persoane din apropiere" cer locația și afișează distanțe
- [ ] Trimitere poză din conversație (galerie + cameră)
- [ ] Cu aplicația **închisă complet**, un apel primit deschide ecranul iOS de apel
- [ ] Trage în jos pentru reîmprospătare; modul avion → ecran de eroare + „Reîncearcă"

## Pasul 5 — Trimite în App Store

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**
   - Platform: iOS, Bundle ID: `ro.diebel.chatapp`, nume: **Diebel Chat**
2. În Xcode: meniul **Product → Archive** → **Distribute App** → **App Store Connect** → Upload
3. Completează în App Store Connect:
   - **Age Rating: 18+** (aplicație de dating — obligatoriu)
   - **Privacy Policy URL:** `https://chat.diebel.ro/privacy`
   - **Account deletion URL:** `https://chat.diebel.ro/delete-account`
   - **App Privacy** — aceleași date ca la Google Play (nume, email, locație, mesaje, poze)
   - Capturi de ecran pentru iPhone 6.7" și 6.5"
   - **Cont de test** pentru recenzori (obligatoriu — altfel respingere automată)

---

## Riscuri reale la aprobarea Apple

Sunt mai stricți decât Google. Trei lucruri te pot bloca:

**1. Guideline 4.2 — Minimum Functionality.** Apple respinge aplicațiile care sunt doar un site
împachetat. De asta am adăugat CallKit, push VoIP, geolocație nativă și permisiuni native.
Când completezi „Notes for Review", scrie explicit ceva de genul:

> The app provides native iOS integration: incoming calls use CallKit and PushKit VoIP so users
> receive calls when the app is closed, location uses CoreLocation, and camera/microphone use
> native iOS permissions for WebRTC calls.

**2. Guideline 4.8 — Sign in with Apple.** Dacă oferi login cu Google/Facebook, **ești obligat**
să oferi și „Sign in with Apple". Verifică pe `chat.diebel.ro/login` că butonul Apple există și
funcționează, altfel respingere sigură.

**3. Guideline 1.2 — User Generated Content.** Pentru dating, Apple cere: filtrare conținut
ofensator, mecanism de raportare, blocare utilizatori și răspuns în 24h la sesizări. Aplicația are
deja raportare și blocare — menționează-le în „Notes for Review".

Așteaptă-te la 1–2 respingeri până se calibrează. Nu e neobișnuit.

---

## Structura proiectului

```
align-ios/
├── project.yml                    # XcodeGen — generează Diebel.xcodeproj
└── Diebel/
    ├── Info.plist                 # Permisiuni, background modes, scenă
    ├── Diebel.entitlements        # aps-environment
    ├── App/                       # AppDelegate + SceneDelegate
    ├── Config/AppConfig.swift     # URL-uri, allowlist domenii, versiune UI
    ├── Web/                       # WKWebView, scripturi injectate, bridge locație
    ├── Call/                      # CallKit + rutare audio
    ├── Push/                      # PushKit VoIP
    └── Assets.xcassets            # Iconița 1024 (generată, fără alpha)
```

## Sincronizare cu aplicația web

- `AppConfig.uiBuild` trebuie să rămână egal cu `align-app/lib/uiBuildVersion.ts`
  (acum **54**). Când bumpezi acolo, bumpează și aici.
- Iconița se regenerează cu: `cd align-app && node scripts/make-ios-icon.mjs`
- Serverul recunoaște shell-ul iOS după UA-ul `DiebelIOS/...`
  (`/api/profiles`, `/api/feed`, `lib/navigateApp.ts`).
