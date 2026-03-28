# OPS-72H.md
## Operațiuni – Primele 72 de ore după LIVE (MVP)

Scop: stabilitate, reacție rapidă la incidente, fără panică și fără schimbări inutile.

---

## 0. Responsabilitate
- On-call principal: Elvis Floroiu
- Canal alertă: OPS_CRITICAL_WEBHOOK (Slack / Discord)
- Frecvență verificare: la alertă + manual de 2–3 ori/zi

---

## 1. Înainte / imediat după LIVE (T0–T+2h)

### Verificări funcționale (obligatoriu)
- [ ] Login funcționează
- [ ] Trimitere mesaj (dus–întors) funcționează
- [ ] Apel audio/video pornește și se închide corect (dacă e activ)
- [ ] Listă mesaje se încarcă
- [ ] Profil utilizator se încarcă
- [ ] Admin → Bord sistem se încarcă
- [ ] GET /api/health → 200 OK

Dacă ORICARE eșuează → vezi secțiunea **6. Rollback**

---

## 2. Monitorizare automată

### Endpoint-uri
- Monitor extern:
  - GET /api/health
  - Alertă la 503 / timeout

- Pulse operațional:
  - GET /api/cron/ops-pulse?secret=...
  - Interval: 5–15 minute
  - Autentificare obligatorie (Bearer sau secret)

### Webhook critical
- OPS_CRITICAL_WEBHOOK_URL setat în producție
- Cooldown activ (anti-spam)
- Se trimite doar la stare „critical”

---

## 3. Verificări zilnice rapide (2–5 minute)

- [ ] Bord sistem:
  - DB status OK
  - Fără erori critice recente
- [ ] Loguri platformă (Vercel / server):
  - Fără spike-uri evidente
- [ ] Feedback utilizatori (/admin/app-feedback):
  - Rapoarte noi?
  - Probleme recurente?

---

## 4. Cum reacționezi la alertă „CRITICAL”

1. Deschizi mesajul din webhook
2. Accesezi Admin → Bord sistem
3. Verifici:
   - GET /api/health
   - Login
   - Trimitere mesaj simplu
4. Dacă DB e picat:
   - Verifici provider DB
   - NU faci deploy inutil
5. Dacă aplicația e instabilă:
   - Mergi la **Rollback**

---

## 5. Ce NU faci în primele 72h (REGULĂ)

- ❌ Nu adaugi feature-uri
- ❌ Nu faci refactor
- ❌ Nu schimbi schema DB
- ❌ Nu modifici polling / WebRTC
- ❌ Nu faci deploy-uri mari

Principiu: **stabilitate > orice**

---

## 6. Rollback (dacă e grav)

- [ ] Redeploy la ultimul build stabil
- [ ] Verifici că DB schema nu e ruptă
- [ ] Verifici domeniu + HTTPS (certificat valid)
- [ ] Confirmi:
  - Login funcționează
  - Mesajele funcționează
  - /api/health → 200

---

## 7. Acces & backup (o singură dată)

- [ ] Știi unde este DB
- [ ] Știi cine are acces la DB
- [ ] Secretele NU sunt expuse public
- [ ] Backup DB (manual sau provider)

---

## 8. După 72h – decizie

Dacă:
- Alertele sunt rare sau zero
- Fluxul principal (login → chat → apel) e stabil
- Nu există incidente majore

Atunci:
- ✅ Poți adăuga Sentry minimal
- ✅ Poți regla praguri ops
- ✅ Poți începe îmbunătățiri UX

---

## Definiția „GATA” pentru MVP
Aplicația este considerată lansabilă când:
- Login este sigur
- Mesajele sunt stabile
- Apelurile nu lasă resurse deschise
- Moderarea funcționează
- Legal minim este public
- Deploy-ul este reproductibil
- Acest checklist este bifat
