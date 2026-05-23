# Performance audit — Project Anthology

**Date:** 2026-05-19  
**Scope:** React SPA (`/`, `/news`, `/timeline`, story modal), `season-tracker`, `radio-anthology`, `tracks`, `public/circuit-covers.js`, `/data/f1/`, APIs, `nav-shell`, `cinematic.css/js`  
**Environment:** Windows, Node 20.x+, `npm run dev` (Vite `:3000`, dev API `:3001`)

---

## Pass / fail matrix

| Area | Result | Notes |
|------|--------|-------|
| Duplicate news fetch on init | **PASS** (mitigated) | `warmNewsOnLoad()` + News share `refreshFromNetwork()` inflight dedupe; stale cache now awaits refresh for UI update |
| Season-tracker `warmSeason` + tab prefetch | **PASS** | Active year warmed first; other tab years via `prefetchSeasonBundle` after paint; manifest awaited before year resolve |
| Tracks parallel race-history years | **PASS** (fixed) | Was `Promise.all` on all years; now max 2 concurrent + 120ms stagger |
| `circuit-covers.js` lazy IO | **PASS** | Raster webp/jpg/png before wiki; wiki miss cache in sessionStorage |
| Wiki queue rate | **PASS** (tuned) | 2 concurrent slots, 300ms gap (was serial @ 400ms) |
| Local / session cache TTLs | **PASS** | News 30m; season `CACHE_VERSION=v4`; tracks race history 2h / 7d |
| Live polling + hidden tab | **PASS** | season-tracker stops on `visibilitychange`; News interval skips when `document.hidden` |
| Blocking scripts (static pages) | **PASS** | All mini-app scripts `defer`; no sync blocking JS |
| CSP vs images | **PASS** | `img-src` allows `self`, `https:`, `upload.wikimedia.org`; `/circuits/*` same-origin |
| `node --check` (4 JS bundles) | **PASS** | season-tracker, tracks, radio-anthology, circuit-covers |
| `npm run test:run` | **PASS** | 44/44 Vitest |
| `npm run build:check` | **PASS** | Vite build + bundle size script |
| `npm run test:e2e` | **SKIP** | Not re-run this audit; use `PW_PORT=3000 npm run test:e2e` with `npm run dev` |

---

## Uncommitted fixes (2026-05-19)

| File | Change |
|------|--------|
| `components/News.tsx` | Stale cache revalidate updates UI; polling paused when tab hidden |
| `public/circuit-covers.js` | Wiki fetch pool (2-wide, 300ms gap) |
| `season-tracker/app.js` | Removed blocking `loadF1StaticManifest()` from init (manifest was unused; fetch could stall startup) |
| `season-tracker/index.html` | Dropped unused `/data/f1/index.json` preload |
| `tracks/app.js` | Race-history loads: concurrency 2 + stagger |
| `tracks/index.html` | Preload `circuit-covers.js` + F1 manifest |
| `radio-anthology/index.html` | Preload `circuit-covers.js` |

---

## Findings (no code change required)

- **React bundle:** Sentry vendor ~406 KB gzip ~131 KB — largest chunk; acceptable for error reporting.
- **season-tracker** duplicates cover fallback logic inline (no `circuit-covers.js`) — intentional to avoid extra script on that page.
- **News** 5-minute interval while page open is by design; now respects visibility.
- **2026 F1 static snapshots** may still be partial — see `QA_PRELAUNCH.md` §8.

---

## User actions after deploy

1. Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) on season-tracker, tracks, and radio-anthology after deploy.
2. If standings or race history look stale, clear site storage for the origin (or only keys prefixed `f1_season_`, `anthologyTracksRace_`, `news_cache_v2`).
3. E2E locally: `npm run dev` then `set PW_PORT=3000&& npm run test:e2e` (PowerShell: `$env:PW_PORT=3000; npm run test:e2e`).
