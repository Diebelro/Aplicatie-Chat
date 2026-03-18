# Ce faci tu (doar pașii pe care eu nu îi pot face)

Am pregătit tot în proiect. Următorii pași se fac doar de tine, din browser și terminal.

---

## Pas 1: Creezi baza de date pe Vercel (2 min)

1. Mergi pe **vercel.com** → te loghezi → deschizi **proiectul** aplicației Align.
2. Sus în proiect: tab **Storage** (sau **Databases**).
3. **Create Database** → alegi **Postgres** (Vercel Postgres).
4. Nume (ex. `align-db`), region (ex. Frankfurt) → **Create**.
5. Când e gata: buton **Connect to Project** → alegi **proiectul tău** → bifezi **Production** → **Add**.
   - Vercel pune automat variabilele (inclusiv `DATABASE_URL`) în proiect. Nu ștergi nimic.

---

## Pas 2: Creezi tabelele în DB (o singură dată)

1. În Vercel: **Settings** → **Environment Variables** → găsești **DATABASE_URL** (sau **POSTGRES_URL**). Click pe **Value** și **Copy** (sau Reveal apoi Copy).
2. Pe PC: în folderul **align-app** creezi (sau deschizi) fișierul **.env**.
3. Pune în .env o singură linie (fără ghilimele):
   ```
   DATABASE_URL=lipesc_aici_connection_string_ul_copiat
   ```
4. În terminal (în folderul **align-app**):
   ```bash
   cd align-app
   npm run db:push
   ```
5. Când se termină fără eroare, tabelele există în baza de date. Poți șterge din .env linia cu DATABASE_URL după ce ai făcut push, dacă vrei (sau o lași pentru viitor).

---

## Pas 3: Redeploy

1. Vercel → **Deployments** → la ultimul deploy: **⋯** → **Redeploy**.
2. Aștepți 1–2 minute. Apoi deschizi **URL-ul live** al proiectului și testezi **Sign up** + **Log in**.

---

## Opțional: NEXTAUTH (dacă vrei sesiuni mai sigure în producție)

În Vercel → **Settings** → **Environment Variables** adaugi (pentru Production):

- **NEXTAUTH_SECRET** – un string lung aleatoriu (min. 32 caractere). Poți genera pe: https://generate-secret.vercel.app
- **NEXTAUTH_URL** – URL-ul live (ex. `https://numele-proiectului.vercel.app`)

Apoi **Redeploy**.

---

După ce faci **Pas 1 + Pas 2 + Pas 3**, aplicația folosește baza de date și conturile rămân salvate.
