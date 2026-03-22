# Iconițe PWA / Google Play

Pune aici două fișiere PNG (fundal opac, logo centrat; pentru `maskable` lasă margini safe ~20%):

- `icon-192.png` — 192×192 px  
- `icon-512.png` — 512×512 px (același fișier e referit și ca `maskable` în manifest până faci o variantă dedicată)

Fără ele, manifestul returnează 404 la iconițe; PWABuilder poate genera și iconițe dintr-un logo dacă le încarci acolo.
