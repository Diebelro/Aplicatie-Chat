# De ce preview-ul arată „alb / neformatat”

## Ce vezi

- **Banner roșu** „Site în lucru…” – se vede corect (are stil inline).
- **„Se încarcă…”** – textul apare, dar pe fundal alb.
- **Restul paginii** – alb, butoane/linkuri neformatate, RO/EN/DE și footer cu © Diebel.

## Cauza

**Fișierul de CSS (Tailwind + `globals.css`) nu se încarcă** în mediu de preview.

- Clasele din HTML (`bg-dark-900`, `text-dark-500` etc.) sunt prezente, dar fără fișierul CSS compilat nu au efect.
- Rezultat: browserul folosește stilurile implicite (fundal alb, text negru).

Se întâmplă de obicei când:

1. **Preview într-un iframe** (ex. Cursor, Vercel Preview) – URL-ul pentru `/_next/static/css/...` e greșit sau blocat.
2. **Build incomplet sau eșuat** – nu s-a rulat `npm run build` / `npm run dev` sau build-ul a căzut.
3. **Alt domeniu/origin** – aplicația e deservită de un URL, iar requesturile pentru CSS merg la alt host și primesc 404 sau sunt blocate.

## Ce s-a făcut în cod

În **`app/layout.tsx`** pe `<body>` s-a adăugat un **fallback inline**:

- `backgroundColor: "var(--bg, #0f1419)"`
- `color: "var(--text, #e7e9ea)"`

Dacă `globals.css` nu se încarcă, `--bg` și `--text` nu există, deci se folosesc culorile din fallback (#0f1419, #e7e9ea). Pagina va avea măcar fundal închis și text deschis, nu alb cu negru.

## Ce poți verifica tu

1. **Tab-ul Network (F12)**  
   - Reîncarcă pagina.  
   - Caută requesturi către `/_next/static/css/...` sau `*.css`.  
   - Dacă sunt **404** sau **failed** → CSS-ul nu se încarcă; trebuie rezolvat URL-ul / build-ul / origin-ul.

2. **Rulare locală**  
   - `npm run dev` apoi deschide `http://localhost:3000`.  
   - Dacă local arată bine și în preview nu → problema e la mediu (iframe / URL / deploy).

3. **Preview Vercel**  
   - Verifică că deploy-ul s-a terminat cu succes.  
   - Deschide direct URL-ul de preview în **același tab** (nu în iframe), ca să excluzi probleme de iframe.

4. **„Se încarcă…”**  
   - Vine din **app layout** când `loading === true` (se citește userul din localStorage și se face `/api/me`).  
   - Dacă ești neautentificat, după un scurt delay ar trebui redirect la `/login`.  
   - Dacă rămâi blocat pe „Se încarcă…” → fie `/api/me` nu răspunde, fie nu există user în localStorage; verifică Network pentru `/api/me` și consola pentru erori.

## Rezumat

- Afișul „alb / neformatat” se datorează **lipsă încărcare CSS** în preview, nu unei erori de logică a mesajelor sau a layout-ului.
- Fallback-ul pe `body` reduce problema (fundal închis, text deschis); pentru restul stilurilor trebuie asigurată încărcarea corectă a CSS-ului (build + URL corect în preview).
