# Images Directory

PWA app icons generated from the original `icon.png`.

## Source

- `icon.png` - Original logo (2176x1984, non-square with gray background)

## Generated PWA Icons

All icons are square with white background, optimized using LANCZOS resampling.

### Standard Icons (for manifest.json)

| File | Size | Purpose |
|------|------|---------|
| `icon-512x512.png` | 512x512 | Primary PWA icon |
| `icon-384x384.png` | 384x384 | Large screens |
| `icon-256x256.png` | 256x256 | Medium screens |
| `icon-192x192.png` | 192x192 | Standard Android/Chrome |
| `icon-144x144.png` | 144x144 | Older Android |
| `icon-128x128.png` | 128x128 | Web store icons |
| `icon-96x96.png` | 96x96 | Small displays |
| `icon-72x72.png` | 72x72 | Legacy Android |
| `icon-48x48.png` | 48x48 | Taskbar/dock |
| `icon-32x32.png` | 32x32 | Browser tab |
| `icon-16x16.png` | 16x16 | Small favicon |

### Special Icons

| File | Purpose |
|------|---------|
| `icon-maskable-512x512.png` | Adaptive icon with 10% safe zone padding for circular/squircle masks |
| `apple-touch-icon.png` | iOS home screen icon (180x180) |
| `favicon.ico` | Multi-resolution favicon (16x16, 32x32, 48x48) |

## Usage in manifest.json

```json
{
  "icons": [
    { "src": "/images/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/images/icon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## Usage in index.html

```html
<link rel="icon" href="/images/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/images/icon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/images/icon-16x16.png">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
```

## Regenerating Icons

Icons were generated using Python/Pillow. To regenerate, run:

```python
from PIL import Image

img = Image.open("icon.png").convert('RGBA')
# Crop to content, make square, resize to needed sizes
# See project history for full script
```
