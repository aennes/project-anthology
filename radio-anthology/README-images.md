# Radio Anthology — episode images

Covers and detail galleries use **story-relevant photography** (drivers, cars, race moments), not circuit maps.

## Data

- **Manifest:** `public/data/radio-images.json` (generated)
- **Files:** `public/images/radio/{episode-id}/cover.webp`, `01.webp`, `02.webp`, …

## Add or refresh images

1. Edit search terms in `scripts/radio-image-sources.mjs` (per `id` matching `RADIO_ARCHIVE` in `app.js`).
2. Run:

```bash
npm run images:radio-anthology
```

Only Wikimedia Commons files with CC / CC0 / public-domain licenses are downloaded. Attribution is stored in the manifest for the detail gallery footer.

## Manual override

Place files under `public/images/radio/{episode-id}/` and add or edit that episode in `public/data/radio-images.json`:

```json
{
  "episodes": {
    "multi-21-malaysia-2013": {
      "cover": "/images/radio/multi-21-malaysia-2013/cover.webp",
      "coverAlt": "Sebastian Vettel, Malaysian GP 2013",
      "coverCredit": { "author": "…", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:…" },
      "gallery": [
        { "src": "/images/radio/multi-21-malaysia-2013/01.webp", "alt": "…", "layout": "landscape", "credit": { } }
      ]
    }
  }
}
```

Episodes with `anthologyCover` in `radio-image-sources.mjs` can fall back to main-archive stills under `/images/Landscape 1280x720/` when Commons has no suitable hit.

## Privacy / broadcast

Do not add F1 world-feed screenshots, team press kits, or identifiable personal data beyond what Commons already publishes under a free license. Same policy as the main Anthology image pipeline.
