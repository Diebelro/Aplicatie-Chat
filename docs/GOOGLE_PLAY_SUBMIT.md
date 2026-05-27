# Google Play — Diebel (ro.diebel.chat) — ghid submit + apel suspendare

## Fișiere upload

| Fișier | Versiune |
|--------|----------|
| `align-android/Diebel-v14.aab` | 1.1.4 (build 14) |

## URL-uri obligatorii (Store listing)

- **Privacy policy:** https://chat.diebel.ro/privacy  
- **Delete account:** https://chat.diebel.ro/delete-account  
- **Terms:** https://chat.diebel.ro/terms  
- **Community rules:** https://chat.diebel.ro/community-rules  

## Data safety (recomandat)

- **Vârstă:** aplicație 18+ (dating/chat adulți)  
- **Reclame:** Nu (release nu afișează AdMob)  
- **Date:** cont, profil, mesaje, apeluri audio/video, locație (dacă utilizatorul o activează), identificatori dispozitiv pentru sesiune  
- **Ștergere cont:** în app (Setări cont) + pagina publică delete-account  

## Content rating

- Completează chestionarul ca **social / dating**, **18+**  
- Activează **Restrict access to minors**  

## Permisiuni sensibile (justificare în review)

| Permisiune | Motiv |
|------------|--------|
| CAMERA, RECORD_AUDIO | Apeluri video/voce |
| POST_NOTIFICATIONS | Apeluri primite / mesaje |
| MANAGE_OWN_CALLS | UI apel VoIP (Telecom) |
| FOREGROUND_SERVICE_* | Apel în curs |

**Nu** folosim READ_PHONE_STATE (eliminat din build 14).

## Text apel suspendare (EN) — copiază în Play Console

```
Subject: Appeal — Account suspension — Diebel (ro.diebel.chat)

We respectfully appeal the suspension of our developer account / app Diebel.

What we fixed since the rejection:
1. Crash on cold start: removed automatic Firebase init with placeholder config; app now starts reliably in a WebView shell loading https://chat.diebel.ro/app
2. Broken functionality: OAuth login works in-app; session cookies persist; WebView lifecycle and error retry added
3. Permissions: removed unused READ_PHONE_STATE; release build has ads disabled (no AdMob in production)
4. Legal compliance: public privacy policy, terms, community rules (18+), and account deletion page:
   - https://chat.diebel.ro/privacy
   - https://chat.diebel.ro/delete-account
5. Age gate on first launch and 18+ validation at signup
6. Video calls: TURN server configured and reachable on turn.diebel.ro:3478

The app is an adults-only (18+) chat and calling service. We do not target minors.

We uploaded build 14 (version 1.1.4) after these fixes and tested login, profile discovery, messaging, and calls.

Thank you for reconsideration.
```

## După acceptarea apelului

1. Production → Create release → upload **Diebel-v14.aab**  
2. Release notes (RO): „Stabilitate, login, apeluri video, conformitate 18+”  
3. Verifică că listing-ul are link privacy + delete-account  
