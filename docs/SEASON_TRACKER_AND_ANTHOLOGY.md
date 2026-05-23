# Season Tracker and Project Anthology — implementation reference

Audience: expert AI or human reviewer. Scope: **current repository state only**; items not found in the repo are called out explicitly.

---

## 1. Executive summary

**Season Tracker** is a standalone **vanilla HTML/CSS/JS** experience under `season-tracker/` (entry `index.html`, styles `styles.css`, logic `app.js`). It presents season overview, optional live timing (when OpenF1 reports an active session), calendar, historical year tabs, and lazy-loaded “snapshot” analytics, backed by **same-origin** JSON proxies **`/api/f1-live`** (OpenF1) and **`/api/f1-season`** (Jolpica Ergast-compatible JSON).

**Project Anthology** is the primary **Vite + React** single-page application (`App.tsx`, `index.tsx`): narrative archive, story modal routes, Timeline, and News. Season Tracker is **not** a React route; it is a **separate static subtree** copied into `dist/season-tracker/` on build and linked from the main nav as a normal **`<a href="/season-tracker">`**.

**Deployment surface:** `vercel.json` configures Vite framework output (`dist`), `buildCommand: npm run build:vercel`, API serverless handlers under `api/`, rewrites for `/api`, `/season-tracker`, and SPA fallback to `/`, plus global security headers (including CSP).

---

## 2. Anthology main application

### 2.1 Stack (from `package.json`, `vite.config.ts`)

| Layer | Implementation |
|--------|----------------|
| Build | Vite 6 (`vite.config.ts`), `root: __dirname`, `publicDir: 'public'`, `appType: 'spa'`, `build.outDir: 'dist'` |
| UI | React 19, `react-router-dom` 6 |
| Styling | Tailwind 3 (`tailwind.config.js`), PostCSS/autoprefixer in devDependencies |
| Motion / UX | `framer-motion`, `@sentry/react`, `@vercel/analytics`, `@vercel/speed-insights` |
| Fonts | `@fontsource/*` packages imported in `index.tsx` (Bebas Neue, Barlow Condensed, DM Sans, IBM Plex Mono) |
| Images | `sharp`, `vite-plugin-image-optimizer`, optional `cloudinary` |
| Dev API | `concurrently` runs Vite + `tsx server/dev-api-server.ts` on port **3001**; Vite `server.proxy['/api']` → `http://127.0.0.1:3001` with **15s** timeout |

### 2.2 Routes (`App.tsx`)

| Path | Element / behavior |
|------|---------------------|
| `/` | `Shell` — hero, archive, story modal overlay when `/story/:id` |
| `/story/:id` | Same `Shell`; story resolved from `match.params.id` |
| `/timeline` | `TimelineShell` → `Timeline` |
| `/news` | `NewsShell` → `News` |

**Not present as React routes:** `/season-tracker` (served as static files; see §3).

### 2.3 Navigation — `components/ui/NavBar.tsx`

- Drawer links **Anthology** (`navigate('/')`), **Timeline** (`navigate('/timeline')`), **News** (`navigate('/news')`) use React Router **`<button>` + `navigate()`**.
- **Season Tracker** uses a plain **`<a href="/season-tracker">`** (full navigation off the SPA bundle).

### 2.4 Design language (`tailwind.config.js`, `App.tsx`)

**Tailwind theme extension:**

- **Colors:** `f1-red` `#ff1801`, `f1-dark` `#15151e`, `f1-black` `#0a0a0a`, `f1-carbon` `#1f1f25`, `paper` `#f4f1ea`.
- **Fonts:** `fontFamily.display` Bebas Neue; `condensed` Barlow Condensed; `sans` DM Sans; `mono` IBM Plex Mono.
- **Motion:** `animate-grain` / `animate-shimmer` with matching keyframes.

**Global patterns in `App.tsx` (`Shell`):**

- Page shell: `bg-f1-black`, `text-paper`, selection colors `f1-red` / white.
- **Film grain:** fixed full-viewport `div` with inline SVG turbulence data-URL, `opacity-[0.05]`, `mix-blend-overlay`, `animate-grain`, `z-50`.
- **Nav:** `NavBar` with `variant="overlay"` and `showCategories` on home; `ChipCircuitLoader` in suspense fallbacks; `ErrorBoundary` around main sections; footer typography uses `font-display` / `font-mono`.

**Key UI primitives (non-exhaustive):** `NavBar`, `Button`, `ChipCircuitLoader`, `ShortcutsModal`, `OfflineIndicator`, lazy `HeroSection`, `ArchiveSection`, `StoryModal`, route-level `Timeline`, `News`.

---

## 3. Season Tracker page

### 3.1 Stack and entrypoints

| File | Role |
|------|------|
| `season-tracker/index.html` | Document shell, Google Fonts links, `./styles.css`, `./app.js` (`defer`) |
| `season-tracker/styles.css` | Tokens, layout, components (topbar, hero, panels, tower, calendar, modal, etc.) |
| `season-tracker/app.js` | IIFE: data fetch, caching, UI rendering, live polling, modals |

**No React / Tailwind** in Season Tracker; fonts are loaded from **Google Fonts** in `index.html` (distinct from main app’s `@fontsource` self-hosting).

### 3.2 Production build and `dist/`

From `package.json`:

- **`build`:** `npm run images:gen && npm run images:optimize-story-38-40 && vite build && node scripts/copy-season-tracker.mjs`
- **`build:vercel`:** same pattern with `|| npm run nop` so image scripts can fail without aborting the build.

`scripts/copy-season-tracker.mjs` recursively copies `season-tracker/` → `dist/season-tracker/` and asserts `index.html`, `app.js`, `styles.css` exist, then logs file count.

### 3.3 Vercel routing (`vercel.json`)

| Rewrite | Destination |
|---------|-------------|
| `/api/:path*` | `/api/:path*` (serverless) |
| `/season-tracker` | `/season-tracker/index.html` |
| `/news`, `/timeline` | `/` (SPA) |
| `/(.*)` | `/` (catch-all SPA) |

`outputDirectory` is `dist`; `framework` is `vite`. `cleanUrls: true`, `trailingSlash: false`.

### 3.4 Local development (`vite.config.ts`)

Custom plugin **`anthology-season-tracker-dev`**:

- Intercepts paths **`/season-tracker`** and **`/season-tracker/*`**.
- Exact **`/season-tracker`** → **302** to **`/season-tracker/`** preserving query string.
- Serves files from filesystem `season-tracker/` with path normalization, rejection of `..` traversal, `403` on escape attempts, correct `Content-Type` by extension.

---

## 4. Data and API architecture

### 4.1 Browser → same-origin proxies

Season Tracker **`fetchErgastJson`** uses:

- `GET /api/f1-season?path=${encodeURIComponent(path)}` — path segments are Jolpica/Ergast-style JSON paths (e.g. `${year}.json`, `${year}/driverStandings.json`).

Season Tracker **`fetchLiveJson`** uses:

- `GET /api/f1-live?path=...&...` — query built from allowlisted path + params (see §8 for client-side allowlist reference).

**Direct third-party F1 data from the Season Tracker script:** not used for Ergast/OpenF1 JSON (those go through `/api/*`).

**Images / non-proxy HTTP:** Season Tracker loads **Formula 1 media CDN** URLs (headshots), **Wikimedia / Wikipedia** (team logo thumbnails via `action=query` API), and **same-origin** `/images/teams/`, `/circuits/` (and `../`-prefixed siblings for subpath deployment). See §7.

### 4.2 `api/f1-live.ts`

- Upstream base: **`https://api.openf1.org/v1`** + sanitized `path` query segment.
- **CORS:** `getAllowedOrigin(req)` from `proxy-helpers.ts` — sets `Access-Control-Allow-Origin` only for allowed hosts; mirrors **`api/news.ts`** policy (comment in source).
- **Methods:** `OPTIONS` 200; **`GET` only** else 405.
- **URL length:** `assertProxyUrlWithinLimit` (8192 chars).
- **Response:** forwards upstream status; empty body → JSON `null` with `Cache-Control: no-store`.
- **Non-JSON upstream:** 502 or upstream status with error snippet.
- **Cache-Control:** `isOpenF1LiveForCacheControl(json)` → if “live telemetry-like” array row detected, **`no-store`**; else **`s-maxage=30, stale-while-revalidate=60`**.

### 4.3 `api/f1-season.ts`

- Upstream base: **`https://api.jolpi.ca/ergast/f1`** + sanitized path.
- Same CORS / GET-only / URL limit / JSON error handling patterns as `f1-live.ts`.
- **Cache-Control:** **`s-maxage=300, stale-while-revalidate=3600`** (including empty and parse-error branches as implemented).

### 4.4 `api/proxy-helpers.ts`

| Concern | Behavior |
|---------|----------|
| **`getAllowedOrigin`** | Parses `Origin` or `Referer`; allows **`localhost`**, **`127.0.0.1`**, **`project-anthology.vercel.app`**; else no CORS header |
| **`sanitizeProxyPath`** | SSRF-oriented: trim, no `..`, no `\`, no `://`, per-segment decode, max **24** segments, max **120** chars/segment, total raw length ≤ **2048**, rejects encoded slashes in segments, re-`encodeURIComponent` each segment |
| **`isOpenF1LiveForCacheControl`** | For JSON **arrays**: if any object has `driver_number`, `gap_to_leader` present, and `date` / `utc` / `inserted_at` within **2 minutes**, treat as live (`no-store` on proxy) |

### 4.5 `server/dev-api-server.ts` (local parity)

HTTP server on port **3001**; patches `req.query` and `res.status/json/send` for Vercel-style handlers.

| Route | Handler module |
|-------|----------------|
| `/api/news`, `/api/news/` | `../api/news` (failure → empty `[]` in dev) |
| `/api/health` | `../api/health` |
| `/api/f1-live` | `../api/f1-live` |
| `/api/f1-season` | `../api/f1-season` |

Other paths → **404** `Not Found`.

---

## 5. Season Tracker — functional inventory (`app.js`, `index.html`)

Constants such as **`SEASON_MIN` (2021)**, **`SEASON_CURRENT`** (`max(SEASON_MIN, current calendar year)`), **`CACHE_VERSION` (`'v2'`)** drive cache keys and tabs.

**Live polling constants (defined at top of `season-tracker/app.js`, immediately after `CACHE_VERSION`):** **`OPENF1_ALLOWED_PATHS`** (`Set` of OpenF1 first-path segments), **`LIVE_POLL_BASE_MS` (5000)**, **`LIVE_POLL_FAILURE_BACKOFF_MAX_MS` (30000)**, **`LIVE_FETCH_TIMEOUT_MS` (10000)**, **`LIVE_CIRCUIT_FAIL_THRESHOLD` (5)**, **`LIVE_CIRCUIT_PAUSE_MS` (60000)**.

### 5.1 Session storage cache keys

| Helper | Key pattern |
|--------|-------------|
| `seasonCacheKey(year, suffix)` | `f1_season_v2_${year}_${suffix}` |
| `roundCacheKey(year, round, suffix)` | `f1_season_v2_${year}_round_${round}_${suffix}` |
| `openF1SessionsCacheKey(year)` | `f1_openf1_v2_${year}_race_sessions` |

`cachedSeasonJson` reads/writes **`sessionStorage`** JSON; corrupt parse removes the key; `setItem` failures are swallowed.

### 5.2 Initialization and season logic

- **`buildSeasonTabs`:** up to **5** year tabs from `SEASON_CURRENT` downward, stopping below `SEASON_MIN`.
- **`warmSeason(year)`:** for **`year === SEASON_CURRENT` only**, parallel fetch+cache of driver standings, constructor standings, full-season calendar (Ergast paths via `/api/f1-season`).
- **`renderSeason(year)`:** uses in-memory `state` or falls back to cached fetch for standings/calendar; fills hero, static tower, constructors, calendar rail.
- **Historical tab click:** updates `state.year`, `warmSeason` (no-op if not current year), `renderHistorical(year)` loading final driver + constructor standings and champion card.

### 5.3 Hero and “pulse”

- Championship leader block: points, wins, chase gap vs P2, rounds completed vs total from calendar + `isRaceDone` (+6h after scheduled start).
- **Top 3 cards:** HTML template with **`escapeHtml`** for injected standings fields; avatars via **`makeAvatarEl`** (OpenF1 headshot map warmed at init + spec CDN fallback).
- **Team accent:** `setAccent(color)` sets CSS variables `--team-accent` and `--accent` on `document.documentElement`; optional `{ soft: true }` skips if accent already set. Cards and constructor rows call `setAccent` on interaction.
- **Next race insight (`#idleInsight`):** when **`!state.live`**, **`state.year === SEASON_CURRENT`**, and **`state.nextRace`** exists, **`refreshIdleInsight`** fills a full-width hero panel: upcoming GP title/circuit/date, short countdown (`formatCountdownShort`), and **previous season same round** winner + fastest lap from **`${SEASON_CURRENT-1}/${round}/results.json`**. Hidden when live, when no next race, or when a historical year tab is selected. Invoked after **`decideLiveAndStart`**, on tab changes, and at end of **`decideLiveAndStart`** for both live/non-live outcomes.

### 5.4 Live timing

- **Gate:** `decideLiveAndStart` → `fetchLiveJson('sessions', { session_key: 'latest' })` then **`isSessionLive`** (window between `date_start`/`session_start`/`date` and `date_end`/`session_end`, or start-only with **6h** heuristic).
- **Non-live:** static driver standings tower; status strings describe failure modes (“Could not verify…”, “No session data…”, “Not live…”).
- **Live:** panel class `tower--live`, hero label “Live session”, LIVE badge, status text **“Polling every 5s.”** (user-facing string in `decideLiveAndStart`).
- **`pollLive`:** parallel **`fetchLiveJson`** for: `drivers`, `position`, `intervals`, `stints`, `pit`, `car_data`, `laps`, `race_control` (all with `session_key: 'latest'`).
- **`mergeLiveSnapshotSlice`:** on success replaces snapshot array if new data non-empty **or** slice was empty; on failure marks slice **`liveSliceStale[key]`** true only if prior data existed (partial retain).
- **Tower:** `buildTimingTower` merges positions, gaps/intervals, latest stint/pit/car_data/lap per driver number; **`renderTowerLive`** uses **`escapeHtml`** for text fields; sector pip HTML is generated via **`sectorPipHtml`** (static class names); FLIP reorder animation unless reduced motion.
- **Race control banner:** last message uppercased, truncated to **48** chars, classes for SC/VSC vs red flag heuristics; **`textContent`** on banner.
- **Lap counter:** max `lap_number` / `lap` across lap array; **`textContent`**.

**Polling / backoff (implemented numeric literals):**

- `nextBackoffMsFromFailures`: after **1** failure → **10_000** ms; after **2** → **20_000** ms; else uses **`LIVE_POLL_FAILURE_BACKOFF_MAX_MS`** (see §8).
- On a poll cycle, if **no** slice returns OK: increment consecutive failures, set backoff from `nextBackoffMsFromFailures`; if failures **≥ `LIVE_CIRCUIT_FAIL_THRESHOLD`**, set **`liveCircuitPausedUntil = Date.now() + LIVE_CIRCUIT_PAUSE_MS`**, reset failure count, show error banner “Live data temporarily unavailable”.
- **`document.visibilitychange`:** hidden → **`stopLivePolling`**; visible + `state.live` → **`resumeLivePollingAfterVisible`** (resets backoff to base symbol, optional “Reconnecting…” banner, **`await pollLive`**, then schedules next timeout).
- **`scheduleLivePollTimeout`:** no scheduling if `!state.live` or `document.hidden`; delay is max of backoff and remaining circuit pause.

### 5.5 Calendar rail and modal

- Horizontal (or vertical on narrow view) **`#calendarRail`** with **`tabindex="0"`**; **ArrowLeft / ArrowRight** scroll with stride from first `.raceCard` geometry (or defaults); **`prefersReducedMotion`** uses `behavior: 'auto'`.
- Cards: completed races open **`openRaceModal`** (click / Enter / Space); upcoming scroll to **`#live`**.
- **`fillWinnerChip`:** per completed race, `roundCacheKey` + `fetchErgastJson` `results/1.json`; winner chip HTML uses **`escapeHtml`** for code/name.

**Modal (`#raceModal`):**

- **`role="dialog"`**, **`aria-modal="true"`**, **`aria-hidden`**, **`aria-labelledby`**; backdrop / close button **`data-close="true"`**; **Escape** closes.
- **`openModal` / `closeModal`:** body `overflow` + **`trapFocus`** (Tab cycles within modal focusables).
- **`openRaceModal`:** increments **`modalCircuitGen`** for stale-load guards; title/kicker updated; facts start as “Loading…”; parallel Ergast **`results/1.json`**, **`qualifying/1.json`**, and **`results.json`** (full grid); **`extractFastestLap`** prefers **`resultsFull`** so fastest lap is correct when `results/1` only contains P1; then **`loadCircuitImage`** with **`setImageWithFallbacks`** and `shouldApply: () => circuitGen === state.modalCircuitGen`.
- **Top 10 table:** **`extractTopRaceResults(resultsFull, 10)`** + **`renderModalTop10Rows`** append a scrollable **`.modalResults`** table (Pos / Driver / Team / Time or status); all cells built with **`escapeHtml`**.

### 5.6 Snapshot section (lazy)

- **`setupSnapshotLazyLoad`:** `IntersectionObserver` on `#snapshot` with **`rootMargin: '200px 0px'`**, then **`loadSnapshot`** once.
- **`buildWinsAndClosest`:** `withLimit(..., 4, ...)` parallel Ergast **`results/2.json`** per completed race; bar chart + “closest finish” editorial card; notes explain data limitations.
- **`buildTyreUsage`:** OpenF1 `sessions` filtered by year + `session_name: 'Race'`, then stints per `session_key`; compound normalization SOFT/MEDIUM/HARD/INTERMEDIATE/WET; bar colors via **`compoundColor`**.

### 5.7 Misc UX / a11y

- **Skip link** to `#main`.
- **Reduced motion:** `setupSectionIo` immediately adds `io-in` to `.io-section` and skips observer; calendar / scroll behaviors use `auto` vs `smooth` accordingly; **`bindTilt`** no-ops pointer tilt when reduced motion.
- **Init failure:** `init().catch` → **`renderPillError`**, **`renderEmpty`** (errors not logged to console by design in catch).

---

## 6. Design language (Season Tracker)

`styles.css` documents alignment with `tailwind.config.js`:

- **CSS variables:** `--f1-black`, `--f1-red`, `--f1-dark`, `--f1-carbon`, `--paper`, panel/glass/border/text/muted/accent, `--team-accent`, radii **`--radius-sm`** through **`--radius-full`**, **`--glass-blur`**, shadows, **`--max: 1180px`**.
- **Fonts:** `--font-display` (Bebas Neue), `--font-condensed` (Barlow Condensed), `--font-sans` (DM Sans stack), `--font-mono` (IBM Plex Mono). **`@font-face`** rules in `styles.css` load **`/fonts/st/*.woff2`** (stable filenames). **`npm run fonts:season-tracker`** (`scripts/copy-season-tracker-fonts.mjs`) copies WOFF2 from **`@fontsource/*`** into **`public/fonts/st/`** before **`vite build`** / **`build:vercel`** (wrapped with `|| npm run nop` so missing `node_modules` does not fail CI). `season-tracker/index.html` does **not** link Google Fonts (removed); CSP may still allow Google for other routes.
- **Grain:** **`.site-grain`** fixed overlay + **`@keyframes grain`** (8s steps(10)), matching comment reference to `App.tsx` / Tailwind `grain` animation.
- **Body:** layered radial gradients on `f1-black`; selection uses `f1-red`.

**Structural components (selectors / concepts in CSS + HTML):** `.topbar` / `.back` / `.brand`; `.hero` + `.panel--hero` / `.panel--glass`; **`.tower`** / **`.tower--live`** / **`.constructors`**; **`.rail`** / **`.raceCard`**; **`.tabs`** / **`.tab`**; **`.champ`**; snapshot **`.bars`** / **`.editorial`**; **`.modal`** / **`.imgShell`** / **`.circuitFallback`**; **`.logoMini`** / **`.logoShimmer`** / **`.logoFallback`**.

---

## 7. Images and resilience

### 7.1 `setImageWithFallbacks` (`app.js`)

- Filters **`dedupePreserveOrder(candidates)`** through **`isImageSrcAllowed`** before any assignment to **`img.src`**.
- **`isImageSrcAllowed`:** rejects `javascript:`, `vbscript:`, `data:`, `blob:`; for `https://` requires host in **`SAFE_IMAGE_HOSTS`**: `media.formula1.com`, `upload.wikimedia.org`, `commons.wikimedia.org`, `en.wikipedia.org`, `www.wikipedia.org`; for same-origin paths only **`/images/teams/`**, **`/circuits/`** (and **`../images/teams/`**, **`../circuits/`** with `..` traversal checks).
- Tries URLs sequentially on **`error`**; on exhaustion **`removeAttribute('src')`** and **`onShowPlaceholder`**.
- Optional **`shouldApply`** guard (used for modal circuit image vs **`modalCircuitGen`**).

### 7.2 Driver headshots

- OpenF1 **`headshot_url`** warmed in **`warmHeadshotsFromOpenF1`**, sanitized (strip `.transform` suffix) and stored if allowlisted.
- **`resolveSpecHeadshotUrl`:** `https://media.formula1.com/image/upload/.../drivers/{year}/{CODE}.png` with year clamped ≥ `SEASON_MIN`.
- **`makeAvatarEl`:** tries preferred + spec URL via **`setImageWithFallbacks`**; else initials in **`textContent`** on **`avatar--fallback`**.

### 7.3 Team logos

- **Local first:** `public/data/season-tracker-images.json` (from **`npm run images:season-tracker`**) plus **`/images/teams/{slug}.webp`** and **`/images/drivers/{CODE}.webp`** (Commons mirrors). `resolveLocalTeamLogoSlug` maps **constructorId** / **constructor name** to slug (e.g. `redbull`, `sauber`, `visa_cash_racing_bulls`). Runtime fallbacks: OpenF1 **`headshot_url`**, Formula 1 media CDN spec URLs, then Wikimedia **`pageimages`** for team logos.
- **Wiki fallback:** **`loadTeamLogoFromWiki`** — **`AbortController`** with **`4500`** ms timeout; tries **Commons** `pageimages` for optional **`TEAM_COMMONS_FILES`** entry, then **English Wikipedia** `pageimages` for **`TEAM_WIKI_TITLES`**; thumbnail URL must pass **`isImageSrcAllowed`**; final **`setImageWithFallbacks`** with **`referrerPolicy: 'no-referrer'`**; on failure **`logoFallback`** span.

### 7.4 Circuit images

- **`circuitImageUrlCandidatesFromRace`:** basename list from **`circuitId`**, **`CIRCUIT_ASSET_ALIASES`**, slugified **`circuitName`** + suffix stripping; for each basename, **`/circuits/`** and **`../circuits/`** with extensions **`.svg`, `.webp`, `.png`, `.jpg`, `.jpeg`**; trailing **`_placeholder.svg`** pair.
- Modal: **`setImgPlaceholder`** shows initials inside **`.imgShell`**; success hides shimmer / shows image; failure shows **`.circuitFallback`** with **`textContent`** nodes.

---

## 8. Live timing resilience (client `app.js`)

| Mechanism | Detail |
|-----------|--------|
| **Fetch wrapper** | **`fetchLiveJson`**: `AbortController` + **`LIVE_FETCH_TIMEOUT_MS` (10s)** abort; non-OK HTTP → `{ ok: false }`; JSON parse errors → `{ ok: false, error: 'json_parse' }`; **`AbortError`** → `{ ok: false, error: 'timeout' }` |
| **Path allowlist** | **`OPENF1_ALLOWED_PATHS`** `Set` at top of **`season-tracker/app.js`**: `sessions`, `drivers`, `position`, `intervals`, `stints`, `pit`, `car_data`, `laps`, `race_control` |
| **Backoff** | **`LIVE_POLL_BASE_MS` (5s)** on success; `nextBackoffMsFromFailures`: 1 → 10s, 2 → 20s, else **`LIVE_POLL_FAILURE_BACKOFF_MAX_MS` (30s)** |
| **Circuit pause** | After **`LIVE_CIRCUIT_FAIL_THRESHOLD` (5)** consecutive all-fail cycles, **`liveCircuitPausedUntil = Date.now() + LIVE_CIRCUIT_PAUSE_MS` (60s)** |
| **Visibility** | Pause polling when hidden; resume path resets backoff and repolls |
| **HTML safety** | **`escapeHtml`** for user- or API-derived strings in many templates; live tower positions use **`textContent`** on **`lapCounter`** / race control banner; **`sectorPipHtml`** returns fixed markup with escaped sector text via **`escapeHtml(sectorTxt)`** |
| **Partial merge** | **`mergeLiveSnapshotSlice`** + **`liveSliceStale`** flags stale gaps when intervals fetch fails but prior data exists |

**Banner:** **`#liveDataBanner`** with classes **`.liveBanner--warn`** / **`.liveBanner--error`** for reconnect / unavailable copy.

---

## 9. Security and CSP (`vercel.json`)

Global header **`Content-Security-Policy`** (single string value) includes among others:

- **`default-src 'self'`**
- **`script-src`** `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://vercel.live`, `https://*.sentry.io`
- **`style-src`** `'self'`, `'unsafe-inline'`, **`https://fonts.googleapis.com`**
- **`img-src`** `'self'`, `data:`, **`https:`** (broad)
- **`font-src`** `'self'`, `data:`, **`https://fonts.gstatic.com`**
- **`connect-src`** `'self'`, Sentry, Vercel analytics/vitals, Cloudinary, **`https://api.allorigins.win`**, **`https://commons.wikimedia.org`**, **`https://en.wikipedia.org`**
- **`frame-src 'none'`**, **`object-src 'none'`**, **`base-uri 'self'`**, **`form-action 'self'`**, **`upgrade-insecure-requests`**

**Relevant to Season Tracker:** same-origin **`/api/f1-live`** and **`/api/f1-season`** fall under **`'self'`**; **`style-src`** / **`font-src`** still list Google hosts for the main SPA; Season Tracker uses **self-hosted** **`/fonts/st/*.woff2`** (no extra `connect-src` needed). Wikimedia/Wikipedia **`connect-src`** entries align with client-side wiki thumbnail fetches; broad **`img-src https:`** covers F1 media and wiki image hosts.

---

## 10. How the two experiences connect

| Link | Mechanism |
|------|-----------|
| Anthology → Season Tracker | **`NavBar`** menu plain **`<a href="/season-tracker">`** (leaves React SPA) |
| Season Tracker → Anthology | Top bar **`<a class="back" href="/">`** with “Back” label |
| Origin | Same deployment host → shared **`vercel.json`** response headers on matched routes |
| APIs | Both can call **`/api/*`** on the same origin; main app dev server proxies to **`server/dev-api-server.ts`** |

---

## File index (primary sources)

- `package.json`, `vite.config.ts`, `vercel.json`
- `App.tsx`, `index.tsx`, `components/ui/NavBar.tsx`, `tailwind.config.js`
- `api/f1-live.ts`, `api/f1-season.ts`, `api/proxy-helpers.ts`, `server/dev-api-server.ts`, `scripts/copy-season-tracker.mjs`, **`scripts/copy-season-tracker-fonts.mjs`**
- `season-tracker/index.html`, `season-tracker/styles.css`, `season-tracker/app.js`
