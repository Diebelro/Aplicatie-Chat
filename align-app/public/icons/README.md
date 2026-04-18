# Iconițe PWA / Google Play

Generare din **culori + path SVG (inimă)** în `scripts/generate-pwa-icons.mjs`:

```bash
npm run icons:pwa
```

**Ieșiri:**

| Fișier | Rol |
|--------|-----|
| `icon-192-any.png`, `icon-512-any.png` | `purpose: "any"` — tab-uri, favicon-like, pătrat |
| `icon-192-maskable.png`, `icon-512-maskable.png` | `purpose: "maskable"` — launcher Android (zonă sigură) |
| `icon-192.png`, `icon-512.png` | Alias = copie a variantelor **any** (linkuri vechi / unelte) |

Manifest: `public/manifest.json` listează explicit cele 4 intrări + `purpose` separat.
