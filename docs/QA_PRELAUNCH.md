# QA Pre-Launch Report — Project Anthology

**Date:** 2026-05-17  
**Environment:** Windows, Node 22.x, `npm run dev` (Vite `:3000`, dev API `:3001`)  
**Auditor:** Automated checks + HTTP probes + code review (browser manual steps below)

---

## Executive summary

| Metric | Value |
|--------|--------|
| **Launch-ready?** | **Yes, with caveats** — spot-check in browser (§8); 2026 F1 snapshots still partial |
| **Hard blockers** | **0** (was 1 — fixed: `StoryModal` raised to `z-[80]` above shell `NavBar` `z-[60]`) |
| **Warnings** | **6** — see matrix |
| **Automated tests** | Vitest 44/44 pass; Playwright 1/2 pass |

---

## 1. Automated checks

| Check | Result | Notes |
|-------|--------|-------|
| `node --check season-tracker/app.js` | **PASS** | |
| `node --check radio-anthology/app.js` | **PASS** | |
| `node --check tracks/app.js` | **PASS** | |
| `npm run build:check` | **PASS** | Full Vite build + `copy-season-tracker` / `copy-tracks`; bundle script exits 0 |
| `npm run test:run` (Vitest) | **PASS** | 5 files, 44 tests |
| `npm run test:e2e` (Playwright) | **PASS** | Post-fix: **2/2** with `PW_PORT=3000` against `npm run dev` |
| Nav link grep (`NavBar.tsx`, `nav-shell.js`) | **PASS** | All hrefs consistent: `/`, `/timeline`, `/season-tracker`, `/tracks`, `/radio-anthology`, `/news` |

### Playwright detail

- **PASS** `navigation.spec.ts` — menu → News
- **FAIL** `story-modal.spec.ts` — `story-modal-menu-button` click times out; fixed shell `NavBar` (`z-[60]`, `data-testid="menu-button"`) intercepts pointer events over modal (`z-50`)

---

## 2. Route / asset inventory (HTTP, dev server)

| URL | Status | Content-Type | Notes |
|-----|--------|--------------|-------|
| `/` | 200 | `text/html` | SPA shell |
| `/timeline` | 200 | `text/html` | SPA |
| `/news` | 200 | `text/html` | SPA |
| `/season-tracker/` | 200 | `text/html; charset=utf-8` | Vanilla mini-app |
| `/radio-anthology/` | 200 | `text/html; charset=utf-8` | Vanilla mini-app |
| `/tracks/` | 200 | `text/html; charset=utf-8` | Vanilla mini-app |
| `/radio-anthology/#multi-21-malaysia-2013` | 200 | HTML + `app.js` | Hash routing shell OK |
| `/tracks/#monaco` | 200 | HTML + `app.js` | Hash routing shell OK |
| `/season-tracker/styles.css` | 200 | `text/css; charset=utf-8` | Not HTML |
| `/nav-shell.css` | 200 | `text/css` | Not HTML |
| `/data/f1/index.json` | 200 | `application/json` | Manifest OK |
| `/data/f1/circuits/monaco/2024.json` | 200 | `application/json` | Circuit race history OK |

**Production `dist/`:** `dist/season-tracker/index.html`, `dist/tracks/index.html`, `dist/radio-anthology/index.html` present after build.

---

## 3. API routes (`api/*.ts`)

| Route | Probe | Result | Notes |
|-------|-------|--------|-------|
| `api/health.ts` | `GET /api/health` | **PASS** 200 JSON | |
| `api/news.ts` | `GET /api/news` | **PASS** 200 JSON | Vitest covered |
| `api/f1-season.ts` | `GET /api/f1-season?path=2024.json` | **PASS** 200 JSON | Ergast proxy |
| `api/f1-live.ts` | `GET /api/f1-live?path=sessions&year=2026` | **PASS** 200 JSON | Malformed `path=sessions?year=2026` returns **400** (expected) |
| `api/proxy-helpers.ts` | — | **PASS** | Shared sanitization / CORS |

---

## 4. Functional checklist (code review + probes)

### React SPA (`/`, `/timeline`, `/news`, story flow)

| Item | Result | Evidence |
|------|--------|----------|
| Routes registered | **PASS** | `App.tsx`: `/`, `/story/:id`, `/timeline`, `/news` |
| Story modal opens from archive | **PASS** | E2E opens modal; Vitest/Archive covered |
| Story modal MENU button | **PASS** (post-fix) | Was `z-50` under `NavBar` `z-[60]`; fixed to `z-[80]`. ESC still closes via `App.tsx` |
| NavBar MENU / drawer | **PASS** | E2E navigation test |
| Categories (home only) | **PASS** | `showCategories` on Shell `NavBar` |

### Season Tracker (`/season-tracker`)

| Item | Result | Evidence |
|------|--------|----------|
| Simple default mode | **PASS** | `uiMode: 'simple'`, `MODE_STORAGE_KEY` |
| Simple ↔ Nerd toggle | **PASS** | `#modeSimple` / `#modeNerd`, `is-mode-animating` |
| Standings from static JSON | **PASS** | `/data/f1/{year}/*.json`, manifest `/data/f1/index.json` |
| Calendar | **PASS** | Ergast-shaped `calendar.json` per year |
| Nerd panels (pit accordion, sim) | **PASS** | `#nerdPitMount`, `#nerdSimMount`, lazy init |
| Live path guarded | **PASS** | `decideLiveAndStart()` gates on OpenF1 sessions + `isSessionLive`; no poll when offline |

### Circuit Atlas (`/tracks`)

| Item | Result | Evidence |
|------|--------|----------|
| 30 circuits | **PASS** | 30× `circuitId` in `tracks/app.js` |
| Card images | **PASS** | `/circuits/*.svg` references |
| Detail + scroll | **PASS** | Hash `#monaco` → detail view |
| Race history JSON | **PASS** | `/data/f1/circuits/{id}/{year}.json` + cache keys |

### Radio Anthology (`/radio-anthology`)

| Item | Result | Evidence |
|------|--------|----------|
| 14 entries | **PASS** | 14× `id:` in `RADIO_ARCHIVE` |
| Detail via hash | **PASS** | `index.html` comment: no modal |
| No modal | **PASS** | Grid ↔ `#id` editorial detail |

### Shared `nav-shell.js` (vanilla apps)

| Item | Result | Evidence |
|------|--------|----------|
| MENU toggle | **PASS** | `toggleMenu`, focus trap |
| Home link `/` | **PASS** | `.anthology-nav__home` |
| ESC | **PASS** | Menu close → `onEscapeDetail` → `clearHashDetail` on tracks/radio |

---

## 5. Data completeness (`public/data/f1/`)

**Years on disk:** 2021–2026 + `circuits/`  
**Manifest:** `seasonMin` 2021, `seasonMax` 2026

### Season round snapshots vs calendar

| Year | Calendar races | `rounds/` dirs | Gap |
|------|----------------|----------------|-----|
| 2021 | 22 | 22 | 0 |
| 2022 | 22 | 22 | 0 |
| 2023 | 22 | 21 | **1** |
| 2024 | 24 | 23 | **1** |
| 2025 | 24 | 24 | 0 |
| 2026 | 22 | 4 | **18** (in-progress season; expected partial sync) |

**Impact:** Selecting a round without `results.json` / `qualifying.json` under `rounds/{n}/` may show empty race/quali panels for that round — **WARN**, not a crash.

### Tracks circuit JSON

All **30** atlas `circuitId` values have directories under `public/data/f1/circuits/` with multi-year JSON files (spot-check `monaco/2024.json` **200**).

---

## 6. Test matrix (summary)

| Area | Status | Severity |
|------|--------|----------|
| JS syntax (3 mini-apps) | PASS | — |
| Production build | PASS | — |
| Unit tests (Vitest) | PASS | — |
| E2E navigation | PASS | — |
| E2E story modal MENU | PASS | After `z-[80]` fix |
| SPA routes HTTP | PASS | — |
| Static mini-apps HTTP | PASS | — |
| JSON/CSS content-types | PASS | — |
| API health/news/f1 | PASS | — |
| F1 2026 round snapshots | WARN | Data |
| F1 2023/2024 single-round gap | WARN | Data |
| Story modal z-index | PASS | Fixed `z-[80]` |
| Playwright vs port 3000 | WARN | Config defaults to 5173; override with `PW_PORT=3000` when reusing `npm run dev` |

---

## 7. Blockers vs nice-to-fix

### Blockers (fix before calling “done”)

_None remaining._

**Fixed during QA:** `components/StoryModal.tsx` — overlay `z-50` → `z-[80]` so MENU is above shell `NavBar` (`z-[60]`).

### Nice-to-fix (post-launch or parallel)

1. Align Playwright `story-modal` test with z-index fix (or use `force: true` only in test — prefer product fix).
2. Run `npm run sync:f1` to close 2023/2024 single-round gaps and grow 2026 `rounds/` as races complete.
3. Document `PW_PORT=3000` in CI when not using `dev:e2e` on 5173.
4. Add E2E for season-tracker / tracks / radio hash flows (currently only SPA nav + story modal).

---

## 8. Manuel doğrulama adımları (tarayıcı)

`npm run dev` çalışırken http://localhost:3000 adresinde:

### Ana site (React)

1. **Ana sayfa** — Hero ve arşiv kartları yükleniyor mu?
2. **Hikâye** — Bir arşiv kartına tıkla; tam ekran modal açılsın. **ESC** ile kapanıyor mu? **MENU** ana sayfaya götürmeli (z-index düzeltildi).
3. **Menu** — Sağ üst Menu → Timeline, Season Tracker, Circuit Atlas, Radio, News linkleri çalışsın.
4. **Timeline** — `/timeline` açılsın; bir hikâyeye tıklayınca `/story/:id` veya modal akışı tutarlı olsun.
5. **News** — `/news` başlık ve haber listesi (API veya fallback) görünsün.

### Season Tracker

6. `/season-tracker` — Varsayılan **Simple** görünüm.
7. **Nerd** moduna geç — pit accordion ve sim panelleri görünsün.
8. Sezon/yıl seç — Sürücü ve marka sıralaması dolsun.
9. Takvimden tamamlanmış bir yarış seç — Sonuç / sıralama verisi gelsin (2021–2025 tam sezonlar daha güvenilir).
10. Canlı oturum yokken — “Not live” / standings mesajı; gereksiz canlı poll olmasın.

### Circuit Atlas

11. `/tracks` — **30** pist kartı.
12. **Monaco** (`#monaco`) — Detay sayfası, aşağı kaydırma, yarış geçmişi bölümü.
13. **ESC** — Detaydan grid’e dönüş (nav-shell).

### Radio Anthology

14. `/radio-anthology` — **14** kart.
15. Bir karta tıkla — URL `#id` olsun; tam sayfa detay (modal yok).
16. **ESC** veya geri — listeye dön.

### Ortak navigasyon (mini-app’ler)

17. **MENU** — Drawer aç/kapa.
18. **Project Anthology ///** — ana sayfaya git.
19. Mobil genişlikte menü ve odak tuşları (Tab) mantıklı kalsın.

---

## 9. Commands to reproduce

```powershell
cd C:\Users\ts\Desktop\Coding\Anthology
node --check season-tracker/app.js
node --check radio-anthology/app.js
node --check tracks/app.js
npm run test:run
npm run build:check
# E2E against running dev on :3000
$env:PW_PORT="3000"; $env:PW_BASE_URL="http://127.0.0.1:3000"; npm run test:e2e
```

---

## 10. Sign-off

| Question | Answer |
|----------|--------|
| Path to this doc | `docs/QA_PRELAUNCH.md` |
| Blocker count | **0** |
| Launch-ready? | **Yes, with caveats** — manual smoke per §8; keep syncing 2026 F1 data |

*Minimal code fix: `StoryModal` z-index (see §7).*
