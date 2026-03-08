# Video Calls (Jitsi Integration)

## 1. Overview
Platforma suportă apeluri video 1:1 folosind Jitsi Meet integrat prin iframe. Implementarea este simplă pentru dezvoltare, dar permite scalare enterprise prin instanțe proprii Jitsi.

## 2. Apeluri video 1:1 (implicit: server public)
În modul implicit, aplicația folosește serverul public:

meet.jit.si

Flux utilizator:
- În chat, utilizatorul apasă "Video".
- Se deschide instant apelul într-un iframe Jitsi.
- Opțional, utilizatorul poate trimite linkul în conversație prin "Trimite link în chat".

## 3. Configurare domeniu propriu (producție)
Pentru instanță Jitsi self-hosted, setează în `.env`:

NEXT_PUBLIC_JITSI_DOMAIN=meet.taudomeniu.ro

Apoi rulezi propria instanță Jitsi, formată din:
- JVB (Jitsi Video Bridge)
- Prosody (XMPP server)
- Jicofo (Focus component)
- TURN server (coturn) pentru NAT traversal și stabilitate pe mobil

Recomandare: folosește Docker + docker-compose pentru instalare rapidă.

## 4. TURN Server (coturn)
TURN este necesar pentru:
- utilizatori în rețele restrictive
- mobil (iOS/Android)
- conexiuni NAT simetrice
- stabilitate la volum mare

Setări recomandate:
- TLS obligatoriu
- porturi 443 și 5349
- autentificare long-term

## 5. Pași următori pentru scalare
1. Bază de date — înlocuiește `lib/store.ts` cu PostgreSQL/MongoDB (ex. Prisma).
2. Autentificare reală — NextAuth sau Supabase Auth pentru parole și sesiuni sigure.
3. Chat real — Socket.io, WebSockets sau provider extern (ex. Stream Chat).
4. Mobile — PWA sau React Native pentru aplicație mobilă.
5. Monetizare — super like, boost, vezi cine te-a dat like, acces premium.

## 6. Scalare apel video (ex. 5000 utilizatori simultan)
Pentru volum mare:
- rulezi mai multe JVB-uri în paralel
- folosești Octo pentru distribuție geografică
- activezi TURN obligatoriu pentru mobil
- load balancer în fața instanțelor Jitsi
- monitorizare cu Prometheus + Grafana
- autoscaling pe CPU load
- separi traficul media de traficul de semnalizare

## 7. Recomandări de producție
- HTTPS obligatoriu
- WebRTC optimizat pentru mobil
- limitare bitrate pentru stabilitate
- configurare firewall pentru UDP
- logging centralizat (ELK sau Grafana Loki)

## 8. Extensibilitate
Sistemul permite:
- apeluri video de grup
- screen sharing
- recording server-side
- moderare
- integrare cu WebRTC stats pentru anti-abuz
- integrare cu sistemul de premium (ex. apel video doar pentru utilizatori premium)
