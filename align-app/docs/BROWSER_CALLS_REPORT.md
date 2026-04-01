# Raport: apeluri în browser (Align / Next.js WebRTC)

Acest document descrie ce este rezonabil de obținut în **Chrome, Edge și Firefox** și ce **nu** promitem. Comportamentul **nu** este echivalent cu aplicații native de mesagerie sau cu „apel sistem”.

## Ce am implementat

1. **Service Worker** (`public/sw.js`): activare simplă, fără cache agresiv; gestionează evenimentele `push` și `notificationclick`. **Nu** rulează WebRTC, **nu** accesează microfon/cameră.
2. **Web Push (VAPID)**: serverul trimite payload JSON la apel intrare (inclusiv `callerId`, `callerName`, `roomId`, `callType` / `audioOnly`, `openUrl`). Abonamentele sunt stocate în DB; clientul se înregistrează din `ServiceWorkerAndPush`.
3. **Flux apel din notificare**: notificarea deschide `/app/call/{roomId}?from=push&…`. **Abia după** „Atinge pentru a răspunde” (gest) rulează accept pe server și se montează `CallUI` (implicit: `getUserMedia` și WebRTC după acel pas).
4. **Poll pentru incoming**: dacă Web Push e marcat ca „primar” (abonare reușită în sesiune), overlay-ul „Nu răspunde automat prin poll rapid”; reîmprospătare la focus / vizibilitate / online. Fără push configurat, rămâne poll-ul de rezervă (mai des când fila e vizibilă).
5. **Autoplay audio remot**: `HTMLAudioElement.play()` este tratat cu `catch`; dacă pleacă, afișăm instrucțiune de atingere pe ecran și reluăm redarea după gest.

## Ce funcționează rezonabil în browser

- **Notificare** că primești un apel, când utilizatorul a permis notificările și serverul are VAPID configurat.
- **Deschiderea paginii de apel** la click pe notificare (în limitele browserului: tab nou sau focalizare, conform `clients.openWindow` / `focus`).
- **Conectare WebRTC după gest explicit** (buton răspunde sau echivalent pe pagina `from=push`).
- **Redare sunet după politicile browserului**, de obicei după unul sau mai multe gesturi ale utilizatorului.

## Ce nu funcționează sau nu este garantat

- **Apel „în fundal” ca la telefon**: fără acțiunea utilizatorului (click pe notificare, deschidere tab), nu există un canal garantat „mereu treaz”. Task-uri lungi în fundal sau WebRTC în service worker **nu** sunt folosite (și nu sunt o soluție sustenabilă).
- **Sonerie 100% fiabilă fără interacțiune**: politicile de autoplay blochează adesea audio-ul până la un gest; notificarea sistem poate suna sau vibra după setările OS/browser, dar **nu** promitem același lucru ca o sonerie nativă.
- **Livrare push instantanee**: depinde de rețea, de economisire baterie, de restricții producător (Android WebView, iOS Safari — iOS are suport limitat pentru Web Push pe aplicații web; testează pe fiecare țintă).
- **Un singur tab vs. duplicate**: click pe notificare poate deschide un tab nou chiar dacă aplicația e deja deschisă; este un compromis pentru compatibilitate și URL corect.
- **Paritate cu WhatsApp / aplicații native**: **nu** revendicăm acest lucru; browserul rămâne o platformă constrânsă de securitate și de lifecycle al paginii.

## Variabile de mediu relevante

Vezi `.env.example`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (sau `VAPID_CONTACT`).

## Concluzie

Soluția este **onestă din punct de vedere tehnic**: maximizează stabilitatea în limitele reale ale browserului (push, gest pentru media, fără „hack-uri” de autoplay și fără WebRTC în worker). Pentru experiență apropiată de telefon, **Android/iOS nativ** rămân căile recomandate acolo unde produsul le suportă.
