# Diebel — brand icon (mini guidelines)

## Concept

- Single **speech bubble**: one closed path (rounded body + tail), centered on the tile — not stacked rectangles.
- Flat geometry only: **no gradients**, **no drop shadows**, **no text inside the mark**, no secondary shapes.

## Colors (full-color lockup)

| Role        | Hex       |
|------------|-----------|
| Tile / bg  | `#0F172A` |
| Chat bubble | `#FFFFFF` |

## Alternative marks (grid-strict explorations)

Shared radius system: **R96** (launcher tile + inner tile), **R48** (pill / arc family), **R36 / R32-class** (stem), accent **#3B82F6** only where noted.

| File (assets + `/public/brand/`) | Concept |
|----------------------------------|-----------|
| `diebel-mark-signal.svg` | Dot + two annulus arcs (circle boolean). |
| `diebel-mark-d-monogram.svg` | White rounded square minus stem + bowl (mask). |
| `diebel-mark-link.svg` | Two overlapping rounded rects (interlock read). |

PNG previews from `npm run icons:export`: `*-512.png`, `*-192.png` next to each name under `public/brand/`.

## Files

| Path | Use |
|------|-----|
| `assets/brand/diebel-icon.svg` | Source of truth (512×512 viewBox). |
| `assets/brand/diebel-icon-mono.svg` | Single-color white on transparent (overlays, print). |
| `public/brand/diebel-icon.svg` | Same as full-color; served at `/brand/diebel-icon.svg`. |
| `public/brand/icon-192.png`, `icon-512.png` | Web / PWA. |
| `public/brand/play-icon-512.png` | **Google Play** high-res icon (512×512). |
| `public/favicon-16.png`, `public/favicon-32.png` | Browser tab. |
| `public/apple-touch-icon.png` | 180×180 Apple touch. |

## Clear space

- Keep at least **~12%** of the icon side as padding when placing the full-color tile inside another layout (relative to the 512 canvas, about 64px).

## When to use mono vs full color

- **Full color** (`diebel-icon.svg`): app launcher, PWA, marketing, header next to wordmark on dark UI.
- **Mono** (`diebel-icon-mono.svg`): single-ink print, light badges on busy imagery, watermark-style marks on dark video.

## Don’ts

- Do not add letters (“D”, “Diebel”) inside the icon.
- Do not stretch non-uniformly; keep square aspect ratio.
- Do not introduce glow, bevel, or 3D effects.

## Regenerate raster exports

From repo root `align-app`:

```bash
npm run icons:export
```

Source: `assets/brand/diebel-icon.svg`. Requires `sharp` (already a devDependency).
