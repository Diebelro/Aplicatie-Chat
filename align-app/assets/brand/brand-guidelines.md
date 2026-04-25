# Diebel — brand icon (mini guidelines)

## Concept

- Single **chat bubble**: one rounded rectangle, centered on the tile.
- Flat geometry only: **no gradients**, **no drop shadows**, **no text inside the mark**, no secondary shapes.

## Colors (full-color lockup)

| Role        | Hex       |
|------------|-----------|
| Tile / bg  | `#0F172A` |
| Chat bubble | `#FFFFFF` |

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
