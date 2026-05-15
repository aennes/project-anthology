/* eslint-disable no-use-before-define */
(() => {
  /** Earliest season exposed in the UI / API; clamp so bad clock years do not produce invalid tabs. */
  const SEASON_MIN = 2021;
  const SEASON_CURRENT = Math.max(SEASON_MIN, new Date().getFullYear());
  /** Bump when cache key shape changes so sessionStorage does not mix incompatible payloads. */
  const CACHE_VERSION = 'v3';
  const WIKI_LOGO_MISS_PREFIX = 'st_wiki_logo_miss:';
  const IS_DEV =
    typeof location !== 'undefined' &&
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  function logDataError(scope, err, detail) {
    if (!IS_DEV) return;
    const msg = err instanceof Error ? err.message : String(err ?? '');
    console.error(`[season-tracker] ${scope}`, msg, detail ?? '');
  }
  /** Simple ↔ Nerd display mode (persisted). */
  const MODE_STORAGE_KEY = 'f1_tracker_mode';

  /**
   * OpenF1 `path` values allowed from the browser (must match what `fetchLiveJson` and the UI call).
   * Server proxy still sanitizes; this prevents accidental or malicious path strings in client code.
   */
  const OPENF1_ALLOWED_PATHS = new Set([
    'sessions',
    'drivers',
    'position',
    'intervals',
    'stints',
    'pit',
    'car_data',
    'laps',
    'race_control',
  ]);

  /** Base delay between successful live poll cycles (ms). */
  const LIVE_POLL_BASE_MS = 5000;
  /** Max backoff when polls keep failing (ms); steps are 5s → 10s → 20s → this cap. */
  const LIVE_POLL_FAILURE_BACKOFF_MAX_MS = 30000;
  /** Per-request abort timeout for `/api/f1-live` (ms). */
  const LIVE_FETCH_TIMEOUT_MS = 10000;
  /** After this many consecutive all-endpoint failures, pause polling for LIVE_CIRCUIT_PAUSE_MS. */
  const LIVE_CIRCUIT_FAIL_THRESHOLD = 5;
  /** Cool-down when live API is persistently failing (ms). */
  const LIVE_CIRCUIT_PAUSE_MS = 60000;
  /**
   * Ergast-backed `cachedSeasonJson` entries also persist in localStorage so new tabs / cold opens
   * avoid re-hitting `/api/f1-season` for the same keys. TTL is a trade-off vs freshness.
   */
  const SEASON_LOCAL_TTL_MS = 2 * 60 * 60 * 1000;

  function seasonLocalStorageKey(sessionKey) {
    return `f1_season_local_${sessionKey}`;
  }

  function readSeasonLocalBundle(sessionKey) {
    try {
      const raw = localStorage.getItem(seasonLocalStorageKey(sessionKey));
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || typeof o.t !== 'number' || !('d' in o)) return null;
      const age = Date.now() - o.t;
      return { data: o.d, isFresh: age >= 0 && age < SEASON_LOCAL_TTL_MS };
    } catch {
      return null;
    }
  }

  function writeSeasonLocalBundle(sessionKey, data) {
    try {
      localStorage.setItem(seasonLocalStorageKey(sessionKey), JSON.stringify({ t: Date.now(), d: data }));
    } catch {
      // ignore quota / private mode
    }
  }

  function seasonCacheKey(year, suffix) {
    return `f1_season_${CACHE_VERSION}_${year}_${suffix}`;
  }

  function openF1SessionsCacheKey(year) {
    return `f1_openf1_${CACHE_VERSION}_${year}_race_sessions`;
  }

  function roundCacheKey(year, round, suffix) {
    return `f1_season_${CACHE_VERSION}_${year}_round_${round}_${suffix}`;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    pillNextRace: $('#pillNextRace'),
    pillLabel: $('#pillNextRace .pill__label'),
    heroPulseLabel: $('#heroPulseLabel'),
    liveBadge: $('#liveBadge'),
    liveStatus: $('#liveStatus'),
    liveDataBanner: $('#liveDataBanner'),
    liveTowerPanel: $('#liveTowerPanel'),
    towerTitle: $('#towerTitle'),
    towerHint: $('#towerHint'),
    timingTower: $('#timingTower'),
    constructorsList: $('#constructorsList'),
    raceControlBanner: $('#raceControlBanner'),
    lapCounter: $('#lapCounter'),
    calendarRail: $('#calendarRail'),
    tagSeason: $('#tagSeason'),
    tagRounds: $('#tagRounds'),
    heroLeader: $('#heroLeader'),
    heroLeaderSub: $('#heroLeaderSub'),
    statPoints: $('#statPoints'),
    statWins: $('#statWins'),
    statGap: $('#statGap'),
    top3Cards: $('#top3Cards'),
    tyreBars: $('#tyreBars'),
    tyreNote: $('#tyreNote'),
    winsBars: $('#winsBars'),
    winsNote: $('#winsNote'),
    closestCard: $('#closestCard'),
    closestNote: $('#closestNote'),
    idleInsight: $('#idleInsight'),
    historyDrivers: $('#historyDrivers'),
    historyConstructors: $('#historyConstructors'),
    champCard: $('#champCard'),
    histTitle: $('#histTitle'),
    histHint: $('#histHint'),
    modal: $('#raceModal'),
    modalTitle: $('#raceModalTitle'),
    modalKicker: $('#raceModalKicker'),
    modalImg: $('#raceModalImg'),
    modalFacts: $('#raceModalFacts'),
    modeSimple: $('#modeSimple'),
    modeNerd: $('#modeNerd'),
    nerdPitMount: $('#nerdPitMount'),
    h2hDriverA: $('#h2hDriverA'),
    h2hDriverB: $('#h2hDriverB'),
    h2hRun: $('#h2hRun'),
    h2hOut: $('#h2hOut'),
    nerdSimMount: $('#nerdSimMount'),
    stintModal: $('#stintModal'),
    stintModalTitle: $('#stintModalTitle'),
    stintModalBody: $('#stintModalBody'),
    stintModalClose: $('#stintModalClose'),
  };

  /** Team palette (approx + readable). */
  const TEAM_COLORS = {
    'Red Bull': '#3671C6',
    Ferrari: '#F91536',
    Mercedes: '#00D2BE',
    McLaren: '#FF8000',
    AstonMartin: '#229971',
    Aston: '#229971',
    Alpine: '#FF87BC',
    Williams: '#64C4FF',
    Haas: '#B6BABD',
    Sauber: '#52E252',
    'Kick Sauber': '#52E252',
    RB: '#6692FF',
    'Racing Bulls': '#6692FF',
  };

  /** Optional Commons `File:` titles — try before English Wikipedia `pageimages`. */
  const TEAM_COMMONS_FILES = {
    Ferrari: 'File:Logo Scuderia Ferrari.png',
    Mercedes: 'File:Mercedes-Benz W11 EQ Performance logo.svg',
    McLaren: 'File:McLaren Formula 1 Team Logo 2023.svg',
    'Red Bull': 'File:Red Bull Racing 2024 logo.png',
    Alpine: 'File:Alpine F1 Team logo.svg',
    Williams: 'File:Williams Racing 2020 logo.svg',
    Haas: 'File:Haas F1 Team logo.svg',
    'Kick Sauber': 'File:Sauber Motorsport 2024 logo.png',
    Sauber: 'File:Sauber Motorsport 2024 logo.png',
    'Racing Bulls': 'File:Racing Bulls 2024 logo.png',
    RB: 'File:Racing Bulls 2024 logo.png',
    Aston: 'File:Aston Martin F1 Team logo.svg',
    AstonMartin: 'File:Aston Martin F1 Team logo.svg',
  };

  const TEAM_WIKI_TITLES = {
    Ferrari: 'Scuderia Ferrari',
    Mercedes: 'Mercedes-Benz in Formula One',
    McLaren: 'McLaren',
    'Red Bull': 'Red Bull Racing',
    Alpine: 'Alpine F1 Team',
    Williams: 'Williams Racing',
    Haas: 'Haas F1 Team',
    'Kick Sauber': 'Sauber Motorsport',
    Sauber: 'Sauber Motorsport',
    'Racing Bulls': 'Racing Bulls',
    RB: 'Racing Bulls',
    Aston: 'Aston Martin in Formula One',
    AstonMartin: 'Aston Martin in Formula One',
  };

  const DRIVER_CODE_FIX = {
    // Ergast sometimes uses 3-letter code in Driver.code, but keep a fallback map
    VER: 'VER',
  };

  /**
   * Local assets live at site root: `/images/teams/{slug}.svg` (Vite `public/images/teams/`).
   * Filenames in repo: alpine, aston_martin, audi, cadillac, ferrari, haas, mclaren, mercedes,
   * redbull, visa_cash_racing_bulls, williams.
   */
  const TEAM_LOGO_SLUG_BY_CONSTRUCTOR_ID = {
    alpine: 'alpine',
    aston_martin: 'aston_martin',
    audi: 'audi',
    cadillac: 'cadillac',
    ferrari: 'ferrari',
    haas: 'haas',
    mclaren: 'mclaren',
    mercedes: 'mercedes',
    red_bull: 'redbull',
    rb: 'visa_cash_racing_bulls',
    racing_bulls: 'visa_cash_racing_bulls',
    sauber: 'visa_cash_racing_bulls',
    stake_sauber: 'visa_cash_racing_bulls',
    visa_cash_app_rb: 'visa_cash_racing_bulls',
    williams: 'williams',
  };

  const TEAM_LOGO_SLUG_BY_NAME = {
    Alpine: 'alpine',
    'Aston Martin': 'aston_martin',
    Audi: 'audi',
    Cadillac: 'cadillac',
    Ferrari: 'ferrari',
    Haas: 'haas',
    'Haas F1 Team': 'haas',
    McLaren: 'mclaren',
    Mercedes: 'mercedes',
    'Red Bull': 'redbull',
    'Red Bull Racing': 'redbull',
    'Oracle Red Bull Racing': 'redbull',
    Williams: 'williams',
    'Racing Bulls': 'visa_cash_racing_bulls',
    RB: 'visa_cash_racing_bulls',
    'Visa Cash App RB': 'visa_cash_racing_bulls',
    'Visa Cash App RB F1 Team': 'visa_cash_racing_bulls',
    'Kick Sauber': 'visa_cash_racing_bulls',
    Sauber: 'visa_cash_racing_bulls',
    'Stake F1 Team Kick Sauber': 'visa_cash_racing_bulls',
    'Stake F1 Team': 'visa_cash_racing_bulls',
  };

  const state = {
    year: SEASON_CURRENT,
    /** Resolved season with standings data (may be before clock year when feed is empty). */
    activeSeason: SEASON_CURRENT,
    countdownTimer: null,
    heroCountdownTimer: null,
    racePhase: 'upcoming',
    livePollTimer: null,
    livePollBackoffMs: LIVE_POLL_BASE_MS,
    liveConsecutiveFailures: 0,
    liveCircuitPausedUntil: 0,
    liveSnapshots: {
      drivers: null,
      positions: null,
      intervals: null,
      stints: null,
      pits: null,
      carData: null,
      laps: null,
      raceControl: null,
    },
    liveSliceStale: {
      drivers: false,
      positions: false,
      intervals: false,
      stints: false,
      pits: false,
      carData: false,
      laps: false,
      raceControl: false,
    },
    live: false,
    nextRace: null,
    calendar: [],
    standings: null,
    constructors: null,
    driverMetaByNumber: new Map(), // number -> { code, name, team, headshotUrl? }
    headshotByCode: new Map(), // DriverCode -> url (OpenF1 + spec CDN try)
    teamByDriverId: new Map(), // Ergast driverId -> team
    lastTowerOrder: [],
    snapshotLoaded: false,
    /** Incremented when the race modal opens so stale circuit image callbacks do not touch the DOM. */
    modalCircuitGen: 0,
    /** `'simple'` | `'nerd'` — persisted under `MODE_STORAGE_KEY`. */
    uiMode: 'simple',
    /** Last live timing rows for instant re-render on mode toggle. */
    lastLiveTowerRows: [],
    /** Nerd-only panels wired + populated once per session after first Nerd activation. */
    nerdPanelsReady: false,
    /** Pit strategy visualizer rendered at least once. */
    pitVizRendered: false,
    /** Coalesces live timing DOM paints to one frame per poll. */
    liveDomRaf: 0,
    /**
     * Championship sim: predicted finishing positions. `driverId` → `round` → `1..20` or `null` (use default rank).
     * @type {Record<string, Record<number, number | null>>}
     */
    simPred: {},
  };

  // ---------------------------
  // Safe images: HTTPS allowlist (known CDNs) OR same-origin paths `/images/teams/*`, `/circuits/*`
  // and sibling-relative `../images/teams/*`, `../circuits/*`. `setImageWithFallbacks` walks candidates
  // in order; rejected schemes/hosts never reach `img.src`. Final failure → placeholder callbacks.
  // ---------------------------
  const SAFE_IMAGE_HOSTS = new Set([
    'media.formula1.com',
    'upload.wikimedia.org',
    'commons.wikimedia.org',
    'en.wikipedia.org',
    'www.wikipedia.org',
  ]);

  function isImageSrcAllowed(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return false;
    if (s.startsWith('//')) s = `https:${s}`;
    const lower = s.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
    if (s.startsWith('/')) {
      if (s.startsWith('//')) return false;
      if (s.includes('..') || s.includes('\\') || s.includes('\0')) return false;
      return s.startsWith('/images/teams/') || s.startsWith('/circuits/');
    }
    if (s.startsWith('../')) {
      if (s.includes('\0') || s.includes('..\\')) return false;
      if (/\.\.\/\.\./.test(s)) return false;
      return s.startsWith('../images/teams/') || s.startsWith('../circuits/');
    }
    if (!lower.startsWith('https://')) return false;
    let host = '';
    try {
      host = new URL(s).hostname.toLowerCase();
    } catch {
      return false;
    }
    return SAFE_IMAGE_HOSTS.has(host);
  }

  function dedupePreserveOrder(items) {
    const seen = new Set();
    const out = [];
    for (const x of items) {
      const t = String(x ?? '').trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  /**
   * @param {HTMLImageElement} img
   * @param {string[]} candidates
   * @param {{
   *   alt?: string,
   *   loading?: string,
   *   decoding?: string,
   *   referrerPolicy?: string,
   *   onSuccess?: () => void,
   *   onShowPlaceholder?: () => void,
   *   shouldApply?: () => boolean,
   * }} [opts]
   * @returns {Promise<boolean>}
   */
  function setImageWithFallbacks(img, candidates, opts) {
    const options = opts || {};
    if (typeof img.__safeImgSupersede === 'function') img.__safeImgSupersede();

    const shouldApply = typeof options.shouldApply === 'function' ? options.shouldApply : () => true;
    const urls = dedupePreserveOrder(candidates).filter(isImageSrcAllowed);

    if (options.alt !== undefined) img.alt = String(options.alt);
    if (options.referrerPolicy) img.referrerPolicy = options.referrerPolicy;
    if (options.loading) img.loading = options.loading;
    if (options.decoding) img.decoding = options.decoding;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (img.__safeImgSupersede === supersedeSelf) img.__safeImgSupersede = null;
        resolve(ok);
      };
      const supersedeSelf = () => finish(false);
      img.__safeImgSupersede = supersedeSelf;

      if (urls.length === 0) {
        if (shouldApply()) options.onShowPlaceholder?.();
        finish(false);
        return;
      }

      let idx = 0;
      let loadSerial = 0;

      const tryNext = () => {
        if (settled) return;
        if (idx >= urls.length) {
          if (shouldApply()) {
            img.removeAttribute('src');
            options.onShowPlaceholder?.();
          }
          finish(false);
          return;
        }
        const url = urls[idx];
        idx += 1;
        const serial = (loadSerial += 1);

        const cleanup = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onErr);
        };

        const onLoad = () => {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          if (shouldApply()) {
            img.hidden = false;
            img.removeAttribute('aria-hidden');
            options.onSuccess?.();
          }
          finish(true);
        };

        const onErr = () => {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          tryNext();
        };

        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onErr, { once: true });
        if (shouldApply()) {
          img.hidden = false;
          img.removeAttribute('aria-hidden');
        }
        img.src = url;

        if (img.complete) {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          if (img.naturalWidth > 0) {
            if (shouldApply()) {
              img.hidden = false;
              img.removeAttribute('aria-hidden');
              options.onSuccess?.();
            }
            finish(true);
          } else {
            tryNext();
          }
        }
      };

      tryNext();
    });
  }

  /**
   * Same-origin circuit art: `public/circuits/{basename}.{ext}` → `/circuits/...` (Vite `public/`).
   * Resolver order: Ergast `circuitId` → alias stems → slugified `circuitName` (underscore + hyphen) → trimmed suffixes.
   * 2025–26 Ergast IDs ship as minimal SVGs under `public/circuits/`; future IDs need matching `{circuitId}.svg` or entries here.
   */
  const CIRCUIT_ASSET_ALIASES = {
    las_vegas: ['vegas'],
    lasvegas: ['vegas'],
  };

  function normalizeCircuitBasename(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/-/g, '_');
  }

  function buildCircuitBasenames(race) {
    const out = [];
    const seen = new Set();
    const push = (stem) => {
      const n = normalizeCircuitBasename(stem);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    };
    const pushHyphenSlug = (hyp) => {
      const h = String(hyp || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!h || seen.has(h)) return;
      seen.add(h);
      out.push(h);
    };

    const id = race?.circuitId ? String(race.circuitId).trim().toLowerCase() : '';
    if (id) {
      push(id);
      const aliases = CIRCUIT_ASSET_ALIASES[id];
      if (aliases) for (const a of aliases) push(a);
    }

    const nameSlugHyp = slugifyCircuit(race?.circuitName);
    if (nameSlugHyp) {
      push(nameSlugHyp.replace(/-/g, '_'));
      pushHyphenSlug(nameSlugHyp);
    }
    const stripped = nameSlugHyp
      .replace(/-circuit$/, '')
      .replace(/-grand-prix-circuit$/, '')
      .replace(/-international-circuit$/, '')
      .replace(/-street-circuit$/, '')
      .replace(/-autodrome$/, '');
    if (stripped && stripped !== nameSlugHyp) {
      push(stripped.replace(/-/g, '_'));
      pushHyphenSlug(stripped);
    }

    return out;
  }

  function circuitUrlsForBasename(base) {
    const b = String(base || '').trim();
    if (!b) return [];
    const roots = ['/circuits/', '../circuits/'];
    const exts = ['.svg', '.webp', '.png', '.jpg', '.jpeg'];
    const urls = [];
    for (const root of roots) {
      for (const ext of exts) urls.push(`${root}${b}${ext}`);
    }
    return urls;
  }

  /** @param {{ circuitId?: string, circuitName?: string }} race */
  function circuitImageUrlCandidatesFromRace(race) {
    const urls = [];
    for (const b of buildCircuitBasenames(race)) urls.push(...circuitUrlsForBasename(b));
    urls.push('/circuits/_placeholder.svg', '../circuits/_placeholder.svg');
    return urls;
  }

  const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

  function pointsForRacePosition(pos) {
    const p = Number(pos);
    if (!Number.isFinite(p) || p < 1) return 0;
    return F1_POINTS[p - 1] ?? 0;
  }

  function compoundHexPitViz(c) {
    const k = normalizeCompound(c);
    if (k === 'SOFT') return '#ff4d4d';
    if (k === 'MEDIUM') return '#ffb020';
    if (k === 'HARD') return '#f3f4f6';
    if (k === 'INTERMEDIATE') return '#22c55e';
    if (k === 'WET') return '#3b82f6';
    return compoundColor(c);
  }

  function readStoredUiMode() {
    try {
      if (localStorage.getItem(MODE_STORAGE_KEY) === 'nerd') return 'nerd';
    } catch {
      // ignore
    }
    return 'simple';
  }

  function syncModeToggleButtons() {
    const nerd = state.uiMode === 'nerd';
    if (el.modeSimple) {
      el.modeSimple.setAttribute('aria-pressed', nerd ? 'false' : 'true');
    }
    if (el.modeNerd) {
      el.modeNerd.setAttribute('aria-pressed', nerd ? 'true' : 'false');
    }
  }

  function runModeSwitchAnimation() {
    if (prefersReducedMotion) return;
    document.body.classList.add('is-mode-animating');
    window.setTimeout(() => document.body.classList.remove('is-mode-animating'), 360);
  }

  function setUiMode(mode) {
    const next = mode === 'nerd' ? 'nerd' : 'simple';
    if (state.uiMode === next) return;
    state.uiMode = next;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.body.classList.toggle('is-nerd', next === 'nerd');
    syncModeToggleButtons();
    runModeSwitchAnimation();
    if (next === 'nerd') {
      $$('.nerd-only.io-section').forEach((n) => n.classList.add('io-in'));
      void ensureNerdPanels();
    }
    if (state.live && Array.isArray(state.lastLiveTowerRows) && state.lastLiveTowerRows.length) {
      renderTowerLive(state.lastLiveTowerRows);
    }
  }

  function openStintModal(payload) {
    const dlg = el.stintModal;
    const body = el.stintModalBody;
    if (!(dlg instanceof HTMLDialogElement) || !body) return;
    const laps =
      payload.lapEnd != null && payload.lapStart != null
        ? `${escapeHtml(String(payload.lapStart))}–${escapeHtml(String(payload.lapEnd))}`
        : escapeHtml(String(payload.lapStart ?? '—'));
    const dur = payload.durationText ? escapeHtml(payload.durationText) : '—';
    if (el.stintModalTitle) {
      el.stintModalTitle.textContent = `${payload.compound || 'Stint'} · #${payload.driverNumber}`;
    }
    body.innerHTML = `
      <p><strong>Compound</strong> ${escapeHtml(payload.compound || '—')}</p>
      <p><strong>Laps</strong> ${laps}</p>
      <p><strong>Duration</strong> ${dur}</p>
    `;
    dlg.showModal();
  }

  function closeStintModal() {
    const dlg = el.stintModal;
    if (dlg instanceof HTMLDialogElement && dlg.open) dlg.close();
  }

  async function ensureNerdPanels() {
    if (state.nerdPanelsReady) return;
    state.nerdPanelsReady = true;
    void populateH2hDriverSelects();
    renderChampionshipSim();
    if (!state.pitVizRendered) {
      state.pitVizRendered = true;
      void renderPitStrategyViz();
    }
  }

  async function populateH2hDriverSelects() {
    const aSel = el.h2hDriverA;
    const bSel = el.h2hDriverB;
    if (!aSel || !bSel) return;
    if (aSel.dataset.wired === '1' && aSel.options.length > 1) return;
    aSel.dataset.wired = '1';
    const byId = new Map();
    for (let y = SEASON_MIN; y <= SEASON_CURRENT; y += 1) {
      // eslint-disable-next-line no-await-in-loop
      const json = await cachedSeasonJson(seasonCacheKey(y, 'driverStandings'), () => fetchErgastJson(`${y}/driverStandings.json`));
      for (const d of extractDriverStandings(json)) {
        if (!d.driverId) continue;
        const label = `${d.givenName} ${d.familyName}`.trim() || d.code;
        byId.set(d.driverId, { id: d.driverId, label, code: d.code });
      }
    }
    const list = [...byId.values()].sort((x, y) => x.label.localeCompare(y.label));
    const mkOpts = (sel, otherVal) => {
      sel.innerHTML = '';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = 'Choose…';
      sel.appendChild(ph);
      for (const d of list) {
        if (d.id === otherVal) continue;
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = `${d.label} (${d.code})`;
        sel.appendChild(o);
      }
    };
    mkOpts(aSel, bSel.value);
    mkOpts(bSel, aSel.value);
    aSel.addEventListener('change', () => mkOpts(bSel, aSel.value));
    bSel.addEventListener('change', () => mkOpts(aSel, bSel.value));
  }

  async function runH2hCompare() {
    const out = el.h2hOut;
    const idA = el.h2hDriverA?.value || '';
    const idB = el.h2hDriverB?.value || '';
    if (!out || !idA || !idB || idA === idB) {
      if (out) out.innerHTML = '<p class="small muted">Pick two different drivers.</p>';
      return;
    }
    out.innerHTML = '<p class="small muted">Loading season stats…</p>';
    const years = [];
    for (let y = SEASON_MIN; y <= SEASON_CURRENT; y += 1) years.push(y);

    const perYear = [];
    for (const y of years) {
      // eslint-disable-next-line no-await-in-loop
      const standingsJson = await cachedSeasonJson(seasonCacheKey(y, 'driverStandings'), () =>
        fetchErgastJson(`${y}/driverStandings.json`),
      );
      const standings = extractDriverStandings(standingsJson);
      const rowA = standings.find((d) => d.driverId === idA) || null;
      const rowB = standings.find((d) => d.driverId === idB) || null;
      perYear.push({ year: y, rowA, rowB, standings });
    }

    const wins = { a: 0, b: 0 };
    let podiumsA = 0;
    let podiumsB = 0;
    const finishesA = [];
    const finishesB = [];

    function ingestDriverRaceResults(json, driverId, finishes, addPodium) {
      const races = json?.MRData?.RaceTable?.Races || [];
      for (const race of races) {
        const results = race?.Results || [];
        for (const res of results) {
          if ((res.Driver || {}).driverId !== driverId) continue;
          const pos = Number(res.position || 0);
          if (!Number.isFinite(pos)) continue;
          finishes.push(pos);
          if (pos <= 3) addPodium();
          break;
        }
      }
    }

    for (const { year, rowA, rowB } of perYear) {
      if (rowA) wins.a += rowA.wins || 0;
      if (rowB) wins.b += rowB.wins || 0;
      // eslint-disable-next-line no-await-in-loop
      const [resA, resB] = await Promise.all([
        fetchErgastJson(`${year}/drivers/${idA}/results.json`).catch(() => null),
        fetchErgastJson(`${year}/drivers/${idB}/results.json`).catch(() => null),
      ]);
      ingestDriverRaceResults(resA, idA, finishesA, () => {
        podiumsA += 1;
      });
      ingestDriverRaceResults(resB, idB, finishesB, () => {
        podiumsB += 1;
      });
    }

    const ptsA = perYear.map((x) => (x.rowA ? x.rowA.points : 0));
    const ptsB = perYear.map((x) => (x.rowB ? x.rowB.points : 0));

    const avg = (arr) => {
      if (!arr.length) return null;
      const s = arr.reduce((x, v) => x + v, 0);
      return s / arr.length;
    };
    const avgA = avg(finishesA);
    const avgB = avg(finishesB);

    function teammateRatioFor(id, standings) {
      const self = standings.find((d) => d.driverId === id);
      if (!self) return null;
      const mates = standings.filter((d) => d.constructorName === self.constructorName && d.driverId !== id);
      if (mates.length !== 1) return null;
      const t = mates[0];
      const tot = self.points + t.points;
      if (!tot) return null;
      return self.points / tot;
    }

    const ratiosA = [];
    const ratiosB = [];
    for (const { rowA, rowB, standings } of perYear) {
      if (rowA) {
        const r = teammateRatioFor(idA, standings);
        if (r != null) ratiosA.push(r);
      }
      if (rowB) {
        const r = teammateRatioFor(idB, standings);
        if (r != null) ratiosB.push(r);
      }
    }
    const meanRatio = (arr) => (arr.length ? arr.reduce((x, v) => x + v, 0) / arr.length : null);
    const rA = meanRatio(ratiosA);
    const rB = meanRatio(ratiosB);

    const labelA =
      el.h2hDriverA && el.h2hDriverA.selectedIndex > 0 ? el.h2hDriverA.selectedOptions[0]?.textContent || 'A' : 'A';
    const labelB =
      el.h2hDriverB && el.h2hDriverB.selectedIndex > 0 ? el.h2hDriverB.selectedOptions[0]?.textContent || 'B' : 'B';
    const w = 320;
    const h = 120;
    const pad = 8;
    const minP = Math.min(0, ...ptsA, ...ptsB);
    const maxP = Math.max(1, ...ptsA, ...ptsB);
    const xStep = years.length > 1 ? (w - pad * 2) / (years.length - 1) : 0;
    const toY = (p) => pad + ((maxP - p) / (maxP - minP || 1)) * (h - pad * 2);
    const linePath = (arr) =>
      arr
        .map((p, i) => {
          const x = pad + (years.length === 1 ? (w - pad * 2) / 2 : i * xStep);
          const y = toY(p);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const pathA = linePath(ptsA);
    const pathB = linePath(ptsB);

    const svgChart = `<svg class="nerdH2h__chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Points by season">
        <rect x="0" y="0" width="${w}" height="${h}" fill="rgba(255,255,255,0.02)" rx="10" />
        <path d="${escapeHtml(pathA)}" stroke="#ff4d4d" fill="none" />
        <path d="${escapeHtml(pathB)}" stroke="#38bdf8" fill="none" />
      </svg>`;

    out.innerHTML = `
      <div class="nerdH2h__grid">
        <div class="nerdH2h__card">
          <div class="small muted">${escapeHtml(labelA)}</div>
          <div><strong>Wins</strong> ${wins.a} · <strong>Podiums</strong> ${podiumsA}</div>
          <div><strong>Avg finish</strong> ${avgA == null ? '—' : escapeHtml(avgA.toFixed(2))}</div>
          <div><strong>Teammate pts share</strong> ${rA == null ? '—' : escapeHtml((rA * 100).toFixed(1))}%</div>
        </div>
        <div class="nerdH2h__card">
          <div class="small muted">${escapeHtml(labelB)}</div>
          <div><strong>Wins</strong> ${wins.b} · <strong>Podiums</strong> ${podiumsB}</div>
          <div><strong>Avg finish</strong> ${avgB == null ? '—' : escapeHtml(avgB.toFixed(2))}</div>
          <div><strong>Teammate pts share</strong> ${rB == null ? '—' : escapeHtml((rB * 100).toFixed(1))}%</div>
        </div>
      </div>
      <div class="small muted" style="margin-top:10px">Points per season (Jolpica / Ergast driver standings).</div>
      ${svgChart}
    `;
  }

  function renderChampionshipSim() {
    const root = el.nerdSimMount;
    if (!root) return;
    if (root._nerdSimChange) root.removeEventListener('change', root._nerdSimChange);
    if (root._nerdSimClick) root.removeEventListener('click', root._nerdSimClick);
    if (state.year !== SEASON_CURRENT || !state.standings || !state.calendar.length) {
      root.innerHTML = '<p class="small muted">Simulator uses the current season calendar and standings. Switch to the current year tab.</p>';
      return;
    }
    const now = new Date();
    const remaining = state.calendar.filter((r) => !isRaceDone(r, now));
    const drivers = extractDriverStandings(state.standings).slice(0, 12);
    if (remaining.length === 0) {
      root.innerHTML = '<p class="small muted">No remaining races on the calendar.</p>';
      return;
    }
    if (!state.simPred || typeof state.simPred !== 'object') state.simPred = {};

    const thead = `<tr><th>Driver</th>${remaining
      .map((r) => `<th title="${escapeHtml(r.raceName)}">R${r.round}</th>`)
      .join('')}</tr>`;

    const tbody = drivers
      .map((d) => {
        state.simPred[d.driverId] = state.simPred[d.driverId] || {};
        const cells = remaining
          .map((r) => {
            const cur = state.simPred[d.driverId][r.round];
            const def = Math.min(20, Math.max(1, d.position || 10));
            const opts = [`<option value=""${cur == null ? ' selected' : ''}>Auto (${def})</option>`]
              .concat(
                Array.from({ length: 20 }, (_, i) => {
                  const p = i + 1;
                  return `<option value="${p}"${cur === p ? ' selected' : ''}>P${p}</option>`;
                }),
              )
              .join('');
            return `<td><select data-sim="${escapeHtml(d.driverId)}" data-round="${r.round}" aria-label="Predicted finish ${escapeHtml(d.code)} round ${r.round}">${opts}</select></td>`;
          })
          .join('');
        return `<tr><td>${escapeHtml(d.code)} ${escapeHtml(`${d.givenName} ${d.familyName}`.trim())}</td>${cells}</tr>`;
      })
      .join('');

    root.innerHTML = `
      <div class="nerdSimActions">
        <button type="button" class="pill pill--ghost" id="simRecalc">Recalculate</button>
        <button type="button" class="pill pill--ghost" id="simReset">Reset auto</button>
      </div>
      <table class="nerdSimTable" aria-label="Championship forecast inputs">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
      <div class="nerdSimStandings" id="simStandingsOut"></div>
    `;

    const onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLSelectElement) || !t.dataset.sim) return;
      const did = t.dataset.sim;
      const rd = Number(t.dataset.round);
      const v = t.value === '' ? null : Number(t.value);
      state.simPred[did] = state.simPred[did] || {};
      state.simPred[did][rd] = v;
      computeSimStandings(drivers, remaining);
    };
    const onClick = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.id === 'simRecalc') computeSimStandings(drivers, remaining);
      if (t.id === 'simReset') {
        drivers.forEach((d) => {
          state.simPred[d.driverId] = {};
        });
        renderChampionshipSim();
      }
    };
    root._nerdSimChange = onChange;
    root._nerdSimClick = onClick;
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    computeSimStandings(drivers, remaining);
  }

  function computeSimStandings(drivers, remaining) {
    const host = document.getElementById('simStandingsOut');
    if (!host || !drivers.length) return;
    const nRem = remaining.length;
    const leaderActual = drivers.reduce((best, d) => (d.points > best.points ? d : best), drivers[0]);
    const leaderPts = leaderActual.points;

    const rows = drivers.map((d) => {
      let pts = d.points;
      for (const r of remaining) {
        const override = state.simPred[d.driverId]?.[r.round];
        const def = Math.min(20, Math.max(1, d.position || 10));
        const pos = override == null ? def : override;
        pts += pointsForRacePosition(pos);
      }
      return { ...d, simPts: pts };
    });
    rows.sort((a, b) => b.simPts - a.simPts);

    const list = rows
      .map((d, idx) => {
        const maxReach = d.points + nRem * 25;
        let math;
        if (d.driverId === leaderActual.driverId) {
          math = 'Title leader (actual pts)';
        } else if (maxReach > leaderPts) {
          math = 'In contention (broadcast bound)';
        } else {
          math = 'Out of contention (bound)';
        }
        return `<li>
          <span>${idx + 1}</span>
          <span class="mono">${escapeHtml(d.code)}</span>
          <span>${escapeHtml(`${d.givenName} ${d.familyName}`.trim())}</span>
          <span class="mono">${d.simPts}</span>
          <span class="mono">${escapeHtml(math)}</span>
        </li>`;
      })
      .join('');
    host.innerHTML = `<div class="panel__titleRow" style="margin-top:8px"><div class="panel__title">Projected standings</div></div><ol>${list}</ol>`;
  }

  async function renderPitStrategyViz() {
    const root = el.nerdPitMount;
    if (!root) return;
    root.innerHTML = '<p class="small muted">Loading OpenF1 race sessions…</p>';
    const year = 2025;
    const calJson = await cachedSeasonJson(seasonCacheKey(year, 'calendar'), () => fetchErgastJson(`${year}.json`));
    const cal = extractCalendar(calJson);
    const now = new Date();
    const done = cal.filter((r) => r.season === year && isRaceDone(r, now));
    if (done.length === 0) {
      root.innerHTML = '<p class="small muted">No completed 2025 races yet.</p>';
      return;
    }

    const sessionsRaw = await cachedSeasonJson(openF1SessionsCacheKey(year), async () => {
      const r = await fetchLiveJson('sessions', { year: String(year), session_name: 'Race' });
      return r.ok ? r.data : [];
    });
    const sessions = assertLivePayloadArray('sessions', sessionsRaw);
    const sortedSess = [...sessions].sort((a, b) => String(a.date_start || '').localeCompare(String(b.date_start || '')));
    const sortedRaces = [...done].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const n = Math.min(sortedSess.length, sortedRaces.length);

    const chunks = [];
    for (let i = 0; i < n; i += 1) {
      const race = sortedRaces[i];
      const sk = sortedSess[i]?.session_key;
      if (sk == null) continue;
      // eslint-disable-next-line no-await-in-loop
      const stRes = await fetchLiveJson('stints', { session_key: String(sk) });
      const stints = stRes.ok ? assertLivePayloadArray('stints', stRes.data) : [];
      chunks.push({ race, stints });
    }

    root.innerHTML = '';
    for (const { race, stints } of chunks) {
      if (!stints.length) continue;
      let maxLap = 1;
      for (const s of stints) {
        const le = Number(s.lap_end ?? s.lap_finish ?? 0);
        const ls = Number(s.lap_start ?? 1);
        if (Number.isFinite(le)) maxLap = Math.max(maxLap, le);
        if (Number.isFinite(ls)) maxLap = Math.max(maxLap, ls);
      }
      const byNum = new Map();
      for (const s of stints) {
        const dn = Number(s.driver_number);
        if (!Number.isFinite(dn)) continue;
        if (!byNum.has(dn)) byNum.set(dn, []);
        byNum.get(dn).push(s);
      }
      for (const arr of byNum.values()) {
        arr.sort((a, b) => Number(a.stint_number || 0) - Number(b.stint_number || 0));
      }
      const driversSorted = [...byNum.keys()].sort((a, b) => a - b);
      const wrap = document.createElement('div');
      wrap.className = 'pitRace';
      wrap.innerHTML = `
        <h3 class="pitRace__title">${escapeHtml(race.raceName)}</h3>
        <div class="pitRace__sub">Round ${escapeHtml(String(race.round))} · session stints · max lap ${escapeHtml(String(maxLap))}</div>
      `;
      const lanes = document.createElement('div');
      for (const dn of driversSorted) {
        const row = document.createElement('div');
        row.className = 'pitLane';
        const label = document.createElement('div');
        label.className = 'pitLane__no';
        label.textContent = String(dn);
        const track = document.createElement('div');
        track.className = 'pitLane__track';
        for (const s of byNum.get(dn) || []) {
          const ls = Number(s.lap_start ?? 1);
          const le = Number(s.lap_end ?? s.lap_finish ?? ls);
          const compound = normalizeCompound(s.compound || s.tyre_compound || '');
          const left = ((ls - 1) / maxLap) * 100;
          const width = (Math.max(1, le - ls + 1) / maxLap) * 100;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pitStint';
          btn.style.left = `${left}%`;
          btn.style.width = `${width}%`;
          btn.style.background = compoundHexPitViz(compound);
          const lapEnd = Number.isFinite(le) ? le : ls;
          const lapStart = Number.isFinite(ls) ? ls : 1;
          const durRaw = s.stint_duration ?? s.duration ?? s.lap_duration;
          const durationText =
            typeof durRaw === 'number' && Number.isFinite(durRaw)
              ? `${durRaw.toFixed(1)}s`
              : typeof durRaw === 'string' && durRaw.trim()
                ? durRaw.trim()
                : `${Math.max(0, lapEnd - lapStart + 1)} lap(s)`;
          btn.addEventListener('click', () =>
            openStintModal({
              compound: compound || 'UNKNOWN',
              lapStart,
              lapEnd,
              durationText,
              driverNumber: dn,
            }),
          );
          track.appendChild(btn);
        }
        row.appendChild(label);
        row.appendChild(track);
        lanes.appendChild(row);
      }
      const axis = document.createElement('div');
      axis.className = 'pitAxis';
      axis.innerHTML = `<span>1</span><span>${escapeHtml(String(maxLap))}</span>`;
      wrap.appendChild(lanes);
      wrap.appendChild(axis);
      root.appendChild(wrap);
    }
    if (!root.children.length) {
      root.innerHTML = '<p class="small muted">No stint rows returned for paired sessions.</p>';
    }
  }

  init().catch((err) => {
    logDataError('init', err);
    renderPillError();
    renderEmpty();
  });

  function buildSeasonTabs() {
    const host = document.getElementById('seasonTablist');
    if (!host) return;
    host.replaceChildren();
    for (let i = 0; i < 5; i += 1) {
      const year = SEASON_CURRENT - i;
      if (year < SEASON_MIN) break;
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.dataset.year = String(year);
      btn.textContent = String(year);
      if (year === SEASON_CURRENT) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.setAttribute('aria-selected', 'false');
      }
      host.appendChild(btn);
    }
  }

  async function init() {
    buildSeasonTabs();
    state.uiMode = readStoredUiMode();
    document.body.classList.toggle('is-nerd', state.uiMode === 'nerd');
    syncModeToggleButtons();
    bindUI();
    setupSectionIo();
    const activeYear = await resolveActiveSeasonYear();
    state.activeSeason = activeYear;
    state.year = activeYear;
    syncActiveSeasonTab(activeYear);
    await warmSeason(activeYear);
    await warmHeadshotsFromOpenF1();
    await renderSeason(activeYear);
    await decideLiveAndStart();
    await refreshIdleInsight();
    setupSnapshotLazyLoad();
    if (state.uiMode === 'nerd') {
      $$('.nerd-only.io-section').forEach((n) => n.classList.add('io-in'));
      void ensureNerdPanels();
    }
  }

  function syncActiveSeasonTab(year) {
    const host = document.getElementById('seasonTablist');
    if (!host) return;
    $$('.tab', host).forEach((btn) => {
      const y = Number(btn.dataset.year);
      const on = y === year;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /** OpenF1 `drivers` includes `headshot_url` (canonical). Spec `{year}/{DriverCode}.png` is used as a secondary try in `resolveHeadshotForCode`. */
  async function warmHeadshotsFromOpenF1() {
    const res = await fetchLiveJson('drivers', { session_key: 'latest' });
    if (!res.ok) return;
    const drivers = assertLivePayloadArray('drivers', res.data);
    for (const d of drivers) {
      if (!d || typeof d !== 'object') continue;
      const code = String(d.name_acronym || d.code || '').trim().toUpperCase();
      if (!code) continue;
      const raw = d.headshot_url;
      if (typeof raw === 'string' && raw && raw !== 'null') {
        const u = sanitizeHeadshotUrl(raw);
        if (u && isImageSrcAllowed(u)) state.headshotByCode.set(code, u);
      }
    }
  }

  /** Requested CDN shape: `{year}/{DriverCode}.png` (Formula 1 media; may 404 for some codes → initials). */
  function resolveSpecHeadshotUrl(code, seasonYear = SEASON_CURRENT) {
    const c = encodeURIComponent(code);
    const y = Number(seasonYear);
    const yearSeg = Number.isFinite(y) ? Math.max(SEASON_MIN, y) : SEASON_CURRENT;
    return `https://media.formula1.com/image/upload/f_auto,q_auto,w_132/v1740000001/fom-website/static-assets/drivers/${yearSeg}/${c}.png`;
  }

  function sanitizeHeadshotUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const i = s.indexOf('.transform');
    return i >= 0 ? s.slice(0, i) : s;
  }

  /** Prefer OpenF1 map, then spec URL for `seasonYear` (historical tabs use that year on the CDN path). */
  function resolveHeadshotForCode(code, seasonYear = SEASON_CURRENT) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return '';
    const fromApi = state.headshotByCode.get(c);
    if (fromApi && isImageSrcAllowed(fromApi)) return fromApi;
    return resolveSpecHeadshotUrl(c, seasonYear);
  }

  function makeAvatarEl(code, nameFallback, preferUrl, headshotYear = SEASON_CURRENT) {
    const wrap = document.createElement('span');
    wrap.className = 'avatar';
    const prefer = typeof preferUrl === 'string' ? preferUrl.trim() : '';
    const spec = resolveSpecHeadshotUrl(code, headshotYear);
    const candidates = dedupePreserveOrder([prefer, spec].filter(Boolean));
    const allowed = candidates.filter(isImageSrcAllowed);

    const showFallback = () => {
      wrap.replaceChildren();
      wrap.classList.add('avatar--fallback');
      wrap.textContent = initialsFrom(nameFallback || code);
    };

    if (allowed.length === 0) {
      showFallback();
      return wrap;
    }

    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    wrap.appendChild(img);

    void setImageWithFallbacks(img, allowed, {
      onSuccess: () => wrap.classList.add('is-loaded'),
      onShowPlaceholder: showFallback,
    });

    return wrap;
  }

  function setupSectionIo() {
    if (prefersReducedMotion) {
      $$('.io-section').forEach((n) => n.classList.add('io-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target;
          if (t instanceof HTMLElement) {
            t.classList.add('io-in');
            io.unobserve(t);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    $$('.io-section').forEach((n) => io.observe(n));
  }

  function bindUI() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' || document.hidden) {
        stopLivePolling();
      } else if (document.visibilityState === 'visible' && state.live) {
        void resumeLivePollingAfterVisible();
      }
    });

    // calendar keyboard navigation
    el.calendarRail.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const first = el.calendarRail.querySelector('.raceCard');
      const gap = 12;
      const isNarrow = window.matchMedia('(max-width: 700px)').matches;
      const rect = first instanceof HTMLElement ? first.getBoundingClientRect() : null;
      const stride = isNarrow ? (rect ? rect.height + gap : 200) : rect ? rect.width + gap : 300;
      const step = stride * (e.key === 'ArrowRight' ? 1 : -1);
      if (isNarrow) {
        el.calendarRail.scrollBy({ top: step, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      } else {
        el.calendarRail.scrollBy({ left: step, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    });

    // tabs
    $$('.tab').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const year = Number(btn.dataset.year);
        if (!year || year === state.year) return;
        $$('.tab').forEach((b) => b.classList.toggle('is-active', b === btn));
        $$('.tab').forEach((b) => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
        state.year = year;
        await warmSeason(year);
        await renderHistorical(year);
        void refreshIdleInsight();
        if (state.uiMode === 'nerd') renderChampionshipSim();
      });
    });

    // modal close
    el.modal.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.dataset.close === 'true') closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const stint = el.stintModal;
      if (stint instanceof HTMLDialogElement && stint.open) {
        e.preventDefault();
        stint.close();
        return;
      }
      if (el.modal.getAttribute('aria-hidden') === 'false') closeModal();
    });

    el.modeSimple?.addEventListener('click', () => setUiMode('simple'));
    el.modeNerd?.addEventListener('click', () => setUiMode('nerd'));
    el.stintModalClose?.addEventListener('click', () => closeStintModal());
    el.h2hRun?.addEventListener('click', () => void runH2hCompare());
    el.stintModal?.addEventListener('click', (e) => {
      if (e.target === el.stintModal) closeStintModal();
    });
  }

  async function warmSeason(year) {
    if (year !== state.activeSeason && year !== SEASON_CURRENT) return;
    const [drivers, constructors, calendar] = await Promise.all([
      cachedSeasonJson(seasonCacheKey(year, 'driverStandings'), () => fetchErgastJson(`${year}/driverStandings.json`)),
      cachedSeasonJson(seasonCacheKey(year, 'constructorStandings'), () => fetchErgastJson(`${year}/constructorStandings.json`)),
      cachedSeasonJson(seasonCacheKey(year, 'calendar'), () => fetchErgastJson(`${year}.json`)),
    ]);
    state.standings = drivers;
    state.constructors = constructors;
    state.calendar = extractCalendar(calendar);
  }

  async function resolveActiveSeasonYear() {
    for (let y = SEASON_CURRENT; y >= SEASON_MIN; y -= 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const json = await cachedSeasonJson(seasonCacheKey(y, 'driverStandings'), () =>
          fetchErgastJson(`${y}/driverStandings.json`),
        );
        if (extractDriverStandings(json).length > 0) return y;
      } catch (err) {
        logDataError('resolveActiveSeasonYear', err, { year: y });
      }
    }
    return SEASON_CURRENT;
  }

  async function renderSeason(year) {
    setHeroLoading();
    el.tagSeason.textContent = `Season ${year}`;

    const driversJson =
      state.standings ||
      (await cachedSeasonJson(seasonCacheKey(year, 'driverStandings'), () => fetchErgastJson(`${year}/driverStandings.json`)));
    const constructorsJson =
      state.constructors ||
      (await cachedSeasonJson(seasonCacheKey(year, 'constructorStandings'), () =>
        fetchErgastJson(`${year}/constructorStandings.json`),
      ));
    const calendarJson =
      state.calendar.length
        ? null
        : await cachedSeasonJson(seasonCacheKey(year, 'calendar'), () => fetchErgastJson(`${year}.json`));

    if (!state.calendar.length && calendarJson) state.calendar = extractCalendar(calendarJson);

    const driverStandings = extractDriverStandings(driversJson);
    const constructorStandings = extractConstructorStandings(constructorsJson);

    renderHero(driverStandings, constructorStandings, state.calendar);
    renderTowerStatic(driverStandings);
    renderConstructors(constructorStandings);
    renderCalendar(state.calendar);
  }

  async function renderHistorical(year) {
    el.histTitle.textContent = `Final Driver Standings`;
    el.histHint.textContent = `Loading ${year}…`;

    const [driversJson, constructorsJson] = await Promise.all([
      cachedSeasonJson(seasonCacheKey(year, 'driverStandings'), () => fetchErgastJson(`${year}/driverStandings.json`)),
      cachedSeasonJson(seasonCacheKey(year, 'constructorStandings'), () => fetchErgastJson(`${year}/constructorStandings.json`)),
    ]);

    const driverStandings = extractDriverStandings(driversJson);
    const constructorStandings = extractConstructorStandings(constructorsJson);

    renderHistory(driverStandings, constructorStandings, year);
    if (driverStandings.length === 0 && constructorStandings.length === 0) {
      el.histHint.textContent = `No published data for ${year} yet.`;
    } else {
      el.histHint.textContent = `Final standings (${year}).`;
    }
  }

  function renderHero(driverStandings, constructorStandings, calendar) {
    const leader = driverStandings[0];
    const second = driverStandings[1];
    const leaderTeam = leader?.constructorName || '—';
    const leaderName = leader ? `${leader.givenName} ${leader.familyName}` : '—';
    const leaderPts = leader?.points ?? '—';
    const leaderWins = leader?.wins ?? '—';
    const gap = leader && second ? `${Number(leader.points) - Number(second.points)} pts` : '—';

    el.heroLeader.textContent = leaderName;
    if (leader) {
      el.heroLeaderSub.textContent = `${leaderTeam} • ${leader.code}`;
    } else if (driverStandings.length === 0) {
      el.heroLeaderSub.textContent = calendar.length
        ? 'Standings not available yet — data may still be updating for this season.'
        : 'No calendar or standings yet — the feed may not include this season until it is published.';
    } else {
      el.heroLeaderSub.textContent = '—';
    }
    el.statPoints.textContent = String(leaderPts);
    el.statWins.textContent = String(leaderWins);
    el.statGap.textContent = gap;

    // rounds done / total
    const total = calendar.length;
    const now = new Date();
    const done = calendar.filter((r) => isRaceDone(r, now)).length;
    el.tagRounds.textContent = `${done}/${total} rounds`;

    // top3 cards (tilt + image)
    el.top3Cards.innerHTML = '';
    driverStandings.slice(0, 3).forEach((d, idx) => {
      const teamColor = getTeamColor(d.constructorName);
      const fullName = `${d.givenName} ${d.familyName}`.trim();
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.tilt = 'true';
      card.style.setProperty('--accent', teamColor);
      card.innerHTML = `
        <div class="card__top">
          <div class="card__pos">P${idx + 1}</div>
          <div class="card__pts">${escapeHtml(String(d.points))} pts</div>
        </div>
        <div class="card__body">
          <div class="card__mid">
            <span class="card__avatarSlot" data-avatar-slot="1"></span>
            <div class="card__identity">
              <div class="card__codeRow">
                <span class="card__code">${escapeHtml(d.code)}</span>
              </div>
              <div class="card__name" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
            </div>
          </div>
          <div class="card__team">
            <span class="chip" style="background:${teamColor}"></span>
            <span class="card__teamName">${escapeHtml(d.constructorName)}</span>
          </div>
        </div>
      `;
      const slot = card.querySelector('[data-avatar-slot]');
      if (slot) slot.replaceWith(makeAvatarEl(d.code, fullName));
      card.addEventListener('click', () => setAccent(teamColor));
      el.top3Cards.appendChild(card);
    });

    bindTilt();
    // default accent to leader team color (but allow user override later)
    if (leader?.constructorName) setAccent(getTeamColor(leader.constructorName), { soft: true });

    const racePhase = getSeasonRacePhase(calendar);
    state.nextRace = racePhase.race;
    state.racePhase = racePhase.phase;
    updatePillForNextRace(racePhase);
    clearHeroLoading();
  }

  function setHeroLoading() {
    el.heroLeader?.classList.add('is-loading');
    el.statPoints?.classList.add('is-loading');
    el.statWins?.classList.add('is-loading');
    el.statGap?.classList.add('is-loading');
  }

  function clearHeroLoading() {
    el.heroLeader?.classList.remove('is-loading');
    el.statPoints?.classList.remove('is-loading');
    el.statWins?.classList.remove('is-loading');
    el.statGap?.classList.remove('is-loading');
  }

  function renderHistory(driverStandings, constructorStandings, year) {
    el.historyDrivers.innerHTML = '';
    el.historyConstructors.innerHTML = '';
    const champ = driverStandings[0];
    const champTeamColor = champ ? getTeamColor(champ.constructorName) : getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (champ) setAccent(champTeamColor, { soft: true });

    driverStandings.forEach((d) => {
      el.historyDrivers.appendChild(makeTowerRowStatic(d, year));
    });
    constructorStandings.forEach((c) => {
      el.historyConstructors.appendChild(makeConstructorRow(c));
    });

    el.champCard.innerHTML = champ
      ? `
        <div class="champ__row">
          <div class="champ__avatarSlot" data-champ-avatar="1"></div>
          <div class="champ__who">
            <div class="champ__name">${escapeHtml(champ.givenName)} ${escapeHtml(champ.familyName)}</div>
            <div class="champ__team">${escapeHtml(champ.constructorName)} • ${year}</div>
          </div>
          <div class="champ__stats">
            <div><strong>${escapeHtml(String(champ.points))}</strong> pts</div>
            <div>${escapeHtml(String(champ.wins))} wins</div>
          </div>
        </div>
      `
      : `<div class="champEmpty" role="status"><div class="champEmpty__title">No champion data</div><p class="champEmpty__meta">This year has no published driver standings in the feed yet — try another season tab.</p></div>`;
    const aSlot = el.champCard.querySelector('[data-champ-avatar]');
    if (champ && aSlot) aSlot.replaceWith(makeAvatarEl(champ.code, `${champ.givenName} ${champ.familyName}`, '', year));
  }

  function renderTowerStatic(driverStandings) {
    el.towerTitle.textContent = 'Drivers';
    el.towerHint.textContent = 'Standings format (not live).';
    el.timingTower.className = 'tower tower--static';
    el.timingTower.innerHTML = '';
    driverStandings.forEach((d) => {
      el.timingTower.appendChild(makeTowerRowStatic(d));
    });
  }

  function renderConstructors(constructorStandings) {
    el.constructorsList.innerHTML = '';
    constructorStandings.forEach((c) => el.constructorsList.appendChild(makeConstructorRow(c)));
    if (prefersReducedMotion) {
      el.constructorsList.querySelectorAll('.constructorRow').forEach((row) => row.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
    );
    el.constructorsList.querySelectorAll('.constructorRow').forEach((row, i) => {
      if (row instanceof HTMLElement) {
        row.style.transitionDelay = `${i * 40}ms`;
        io.observe(row);
      }
    });
  }

  function renderCalendar(calendar) {
    el.calendarRail.innerHTML = '';
    const now = new Date();
    const next = getSeasonRacePhase(calendar).race;
    calendar.forEach((r) => {
      const done = isRaceDone(r, now);
      const card = document.createElement('div');
      const isNext = next && next.round === r.round;
      card.className = `raceCard${done ? ' is-done' : ' is-upcoming'}${isNext ? ' is-next' : ''}`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${r.raceName} details`);
      card.innerHTML = `
        <span class="raceCard__accent" aria-hidden="true"></span>
        <div class="raceCard__inner">
          <div class="raceCard__head">
            <span class="raceRoundBadge"><span class="raceRoundBadge__lbl">R</span><span class="raceRoundBadge__num">${escapeHtml(String(r.round))}</span></span>
            <span class="raceFlag" aria-hidden="true" title="${escapeHtml(r.country || '')}">${escapeHtml(flagEmojiFromCountry(r.country))}</span>
          </div>
          <h3 class="raceTitle">${escapeHtml(r.raceName)}</h3>
          <p class="raceCircuit">${escapeHtml(r.circuitName)}</p>
          <time class="raceWhen" datetime="${escapeHtml(r.date)}">${escapeHtml(formatDate(r.date))}</time>
          <div class="winnerChip" data-winner hidden></div>
        </div>
      `;

      // winner chip (best effort, cached per session)
      if (done) {
        void fillWinnerChip(card, r);
        card.addEventListener('click', () => openRaceModal(r));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') openRaceModal(r);
        });
      } else {
        card.addEventListener('click', () => scrollToLive());
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') scrollToLive();
        });
      }

      el.calendarRail.appendChild(card);
    });
  }

  async function fillWinnerChip(card, race) {
    const chip = card.querySelector('[data-winner]');
    if (!(chip instanceof HTMLElement)) return;
    try {
      const k = roundCacheKey(race.season, race.round, 'result');
      const data = await cachedSeasonJson(k, () => fetchErgastJson(`${race.season}/${race.round}/results/1.json`));
      const win = extractRaceWinner(data);
      if (!win) return;
      chip.hidden = false;
      const who = escapeHtml(String(win.code || win.name || '—'));
      chip.innerHTML = `<span class="winnerChip__trophy" aria-hidden="true">🏆</span><span class="winnerChip__k">Winner</span><span class="winnerChip__v">${who}</span>`;
    } catch {
      // ignore
    }
  }

  function renderPillError() {
    updateHeroNextRacePill({ phase: 'unavailable', race: null });
    if (!el.pillLabel) return;
    el.pillLabel.textContent = 'Next race unavailable';
  }

  function renderEmpty() {
    el.liveStatus.textContent = 'Data unavailable.';
  }

  function updatePillForNextRace(racePhase) {
    updateHeroNextRacePill(racePhase);
    if (!el.pillNextRace || !el.pillLabel) return;
    const { phase, race: nextRace } = racePhase;
    if (phase === 'unavailable') {
      el.pillLabel.textContent = 'Calendar unavailable';
      return;
    }
    if (phase === 'complete' && nextRace) {
      el.pillLabel.innerHTML = `<span>Season complete</span> · <strong>${escapeHtml(nextRace.raceName)}</strong>`;
      el.pillNextRace.onclick = () => document.querySelector('#calendar')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      stopCountdown();
      return;
    }
    if (phase === 'break') {
      el.pillLabel.textContent = 'Season break — next round TBC';
      stopCountdown();
      return;
    }
    if (!nextRace) {
      el.pillLabel.textContent = 'Season loaded';
      stopCountdown();
      return;
    }
    el.pillLabel.innerHTML = `<span>Next:</span> <strong>${escapeHtml(nextRace.raceName)}</strong> <span id="countdown">—</span>`;
    el.pillNextRace.onclick = () => document.querySelector('#calendar')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    startCountdown(nextRace);
  }

  function updateHeroNextRacePill(racePhase) {
    const pill = document.getElementById('heroNextRace');
    const label = document.getElementById('heroNextRaceLabel');
    const circuit = document.getElementById('heroNextCircuit');
    const cd = document.getElementById('heroCountdown');
    if (!pill || !label) return;
    const { phase, race: nextRace } = racePhase;
    pill.hidden = false;
    if (phase === 'unavailable') {
      label.textContent = 'Next race unavailable';
      if (circuit) circuit.textContent = '';
      if (cd) cd.textContent = '';
      return;
    }
    if (phase === 'complete' && nextRace) {
      label.textContent = 'Season complete';
      if (circuit) circuit.textContent = nextRace.raceName;
      if (cd) cd.textContent = '';
      return;
    }
    if (phase === 'break') {
      label.textContent = 'Season break';
      if (circuit) circuit.textContent = 'Next round to be confirmed';
      if (cd) cd.textContent = '';
      return;
    }
    if (!nextRace) {
      label.textContent = 'Season';
      if (circuit) circuit.textContent = '';
      if (cd) cd.textContent = '';
      return;
    }
    label.textContent = 'Next race';
    if (circuit) circuit.textContent = `${nextRace.raceName} · ${nextRace.circuitName}`;
    pill.onclick = () => document.querySelector('#calendar')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    if (cd) {
      const target = new Date(`${nextRace.date}T${nextRace.time || '13:00:00Z'}`);
      const tickHeroCd = () => {
        const ms = Math.max(0, target.getTime() - Date.now());
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        cd.textContent = `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(ss)}s`;
      };
      tickHeroCd();
      if (state.heroCountdownTimer) window.clearInterval(state.heroCountdownTimer);
      state.heroCountdownTimer = window.setInterval(tickHeroCd, 1000);
    }
  }

  function scrollToLive() {
    document.querySelector('#live')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  function startCountdown(race) {
    stopCountdown();
    const target = new Date(`${race.date}T${race.time || '13:00:00Z'}`);
    const tick = () => {
      const now = Date.now();
      const ms = Math.max(0, target.getTime() - now);
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      const cd = $('#countdown');
      if (cd) cd.textContent = `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(ss)}s`;
    };
    tick();
    state.countdownTimer = window.setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (state.countdownTimer) window.clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }

  async function decideLiveAndStart() {
    const sessionsRes = await fetchLiveJson('sessions', { session_key: 'latest' });
    const sessionsForGate = sessionsRes.ok ? assertLivePayloadArray('sessions', sessionsRes.data) : [];
    const live =
      sessionsRes.ok && sessionsForGate.length > 0 && isSessionLive(sessionsForGate);
    state.live = live;

    if (!live) {
      resetLiveSnapshotsAndStale();
    }

    if (live) {
      el.liveTowerPanel?.classList.add('tower--live');
      el.heroPulseLabel?.classList.add('is-live');
      if (el.heroPulseLabel) el.heroPulseLabel.textContent = 'Live session';
      el.liveBadge.hidden = false;
      el.liveStatus.textContent = 'Live session detected. Polling every 5s.';
      el.towerTitle.textContent = 'Timing Tower';
      el.towerHint.textContent = 'Live format (best-effort).';
      setPillLive();
      clearLiveDataBanner();
      startLivePolling();
    } else {
      el.liveTowerPanel?.classList.remove('tower--live');
      el.heroPulseLabel?.classList.remove('is-live');
      if (el.heroPulseLabel) el.heroPulseLabel.textContent = 'Championship leader';
      el.liveBadge.hidden = true;
      if (!sessionsRes.ok) {
        el.liveStatus.textContent = 'Could not verify live session — showing standings.';
      } else if (sessionsForGate.length === 0) {
        el.liveStatus.textContent = 'No session data — showing standings.';
      } else {
        el.liveStatus.textContent = 'Not live right now. Showing standings.';
      }
      clearLiveDataBanner();
      stopLivePolling();
    }
    void refreshIdleInsight();
  }

  function setPillLive() {
    if (!el.pillLabel) return;
    el.pillLabel.innerHTML = `<span class="liveDot" aria-hidden="true"></span><strong>LIVE</strong><span> • click to jump</span>`;
    el.pillNextRace.onclick = scrollToLive;
    const heroPill = document.getElementById('heroNextRace');
    const heroLabel = document.getElementById('heroNextRaceLabel');
    const heroCircuit = document.getElementById('heroNextCircuit');
    const heroCd = document.getElementById('heroCountdown');
    if (heroPill) {
      heroPill.hidden = false;
      heroPill.classList.add('is-live');
      heroPill.onclick = scrollToLive;
    }
    if (heroLabel) heroLabel.textContent = 'Live now';
    if (heroCircuit) heroCircuit.textContent = 'OpenF1 timing active';
    if (heroCd) heroCd.textContent = '';
    if (state.heroCountdownTimer) {
      window.clearInterval(state.heroCountdownTimer);
      state.heroCountdownTimer = null;
    }
  }

  function isSessionLive(sessionsJson) {
    if (!Array.isArray(sessionsJson) || sessionsJson.length === 0) return false;
    const s = sessionsJson[0];
    if (!s || typeof s !== 'object') return false;
    const now = Date.now();
    const start = Date.parse(s.date_start || s.session_start || s.date || '');
    const end = Date.parse(s.date_end || s.session_end || '');
    if (!Number.isFinite(start)) return false;
    if (Number.isFinite(start) && Number.isFinite(end)) return now >= start && now <= end;
    if (Number.isFinite(start) && !Number.isFinite(end)) return now >= start && now - start < 6 * 60 * 60 * 1000;
    return false;
  }

  function resetLiveSnapshotsAndStale() {
    state.liveSnapshots = {
      drivers: null,
      positions: null,
      intervals: null,
      stints: null,
      pits: null,
      carData: null,
      laps: null,
      raceControl: null,
    };
    state.liveSliceStale = {
      drivers: false,
      positions: false,
      intervals: false,
      stints: false,
      pits: false,
      carData: false,
      laps: false,
      raceControl: false,
    };
    state.livePollBackoffMs = LIVE_POLL_BASE_MS;
    state.liveConsecutiveFailures = 0;
    state.liveCircuitPausedUntil = 0;
  }

  function mergeLiveSnapshotSlice(key, result, assertKind) {
    const snap = state.liveSnapshots;
    const stale = state.liveSliceStale;
    const had = Array.isArray(snap[key]) && snap[key].length > 0;
    if (result.ok) {
      const arr = assertLivePayloadArray(assertKind, result.data);
      if (arr.length > 0 || !had) {
        snap[key] = arr;
      }
      stale[key] = false;
    } else {
      stale[key] = had;
    }
  }

  function updateLiveDataBanner(mode, text) {
    const b = el.liveDataBanner;
    if (!b) return;
    if (!text) {
      b.hidden = true;
      b.textContent = '';
      b.classList.remove('liveBanner--warn', 'liveBanner--error');
      return;
    }
    b.hidden = false;
    b.textContent = text;
    b.classList.remove('liveBanner--warn', 'liveBanner--error');
    if (mode === 'warn') b.classList.add('liveBanner--warn');
    if (mode === 'error') b.classList.add('liveBanner--error');
  }

  function clearLiveDataBanner() {
    updateLiveDataBanner('', '');
  }

  function nextBackoffMsFromFailures(consecutiveFailures) {
    if (consecutiveFailures <= 0) return LIVE_POLL_BASE_MS;
    if (consecutiveFailures === 1) return 10_000;
    if (consecutiveFailures === 2) return 20_000;
    return LIVE_POLL_FAILURE_BACKOFF_MAX_MS;
  }

  function stopLivePolling() {
    if (state.livePollTimer != null) {
      window.clearTimeout(state.livePollTimer);
      state.livePollTimer = null;
    }
  }

  function scheduleLivePollTimeout() {
    stopLivePolling();
    if (!state.live || document.hidden) return;
    const now = Date.now();
    let delay = state.livePollBackoffMs;
    if (state.liveCircuitPausedUntil > now) {
      delay = Math.max(delay, state.liveCircuitPausedUntil - now);
    }
    state.livePollTimer = window.setTimeout(() => {
      void runLivePollCycle();
    }, delay);
  }

  async function resumeLivePollingAfterVisible() {
    if (!state.live) return;
    stopLivePolling();
    state.livePollBackoffMs = LIVE_POLL_BASE_MS;
    if (Date.now() < state.liveCircuitPausedUntil) {
      updateLiveDataBanner('error', 'Live data temporarily unavailable');
      scheduleLivePollTimeout();
      return;
    }
    if (state.liveConsecutiveFailures > 0) {
      updateLiveDataBanner('warn', 'Reconnecting…');
    }
    await pollLive();
    if (state.liveConsecutiveFailures === 0) {
      clearLiveDataBanner();
    }
    scheduleLivePollTimeout();
  }

  async function runLivePollCycle() {
    if (!state.live || document.hidden) {
      stopLivePolling();
      return;
    }
    const now = Date.now();
    if (now < state.liveCircuitPausedUntil) {
      updateLiveDataBanner('error', 'Live data temporarily unavailable');
      scheduleLivePollTimeout();
      return;
    }
    if (state.liveConsecutiveFailures > 0) {
      updateLiveDataBanner('warn', 'Reconnecting…');
    }
    await pollLive();
    if (state.liveConsecutiveFailures === 0) {
      clearLiveDataBanner();
    }
    scheduleLivePollTimeout();
  }

  function startLivePolling() {
    if (!state.live) return;
    stopLivePolling();
    state.livePollBackoffMs = LIVE_POLL_BASE_MS;
    state.liveConsecutiveFailures = 0;
    void (async () => {
      await pollLive();
      clearLiveDataBanner();
      scheduleLivePollTimeout();
    })();
  }

  function scheduleLiveDomPaint() {
    if (state.liveDomRaf) return;
    state.liveDomRaf = window.requestAnimationFrame(() => {
      state.liveDomRaf = 0;
      const towerRows = buildTimingTower();
      if (towerRows.length > 0) {
        renderTowerLive(towerRows);
      }
      renderRaceControl(state.liveSnapshots.raceControl);
      renderLapCounter(state.liveSnapshots.laps);
    });
  }

  async function pollLive() {
    if (Date.now() < state.liveCircuitPausedUntil) {
      return;
    }
    const nerd = state.uiMode === 'nerd';
    const [
      resDrivers,
      resPos,
      resInt,
      resStint,
      resLaps,
      resRc,
      resPit,
      resCar,
    ] = await Promise.all([
      fetchLiveJson('drivers', { session_key: 'latest' }),
      fetchLiveJson('position', { session_key: 'latest' }),
      fetchLiveJson('intervals', { session_key: 'latest' }),
      fetchLiveJson('stints', { session_key: 'latest' }),
      fetchLiveJson('laps', { session_key: 'latest' }),
      fetchLiveJson('race_control', { session_key: 'latest' }),
      nerd ? fetchLiveJson('pit', { session_key: 'latest' }) : Promise.resolve({ ok: false }),
      nerd ? fetchLiveJson('car_data', { session_key: 'latest' }) : Promise.resolve({ ok: false }),
    ]);

    mergeLiveSnapshotSlice('drivers', resDrivers, 'drivers');
    mergeLiveSnapshotSlice('positions', resPos, 'position');
    mergeLiveSnapshotSlice('intervals', resInt, 'intervals');
    mergeLiveSnapshotSlice('stints', resStint, 'stints');
    mergeLiveSnapshotSlice('laps', resLaps, 'laps');
    mergeLiveSnapshotSlice('raceControl', resRc, 'race_control');
    if (nerd) {
      mergeLiveSnapshotSlice('pits', resPit, 'pit');
      mergeLiveSnapshotSlice('carData', resCar, 'car_data');
    }

    const results = nerd
      ? [resDrivers, resPos, resInt, resStint, resPit, resCar, resLaps, resRc]
      : [resDrivers, resPos, resInt, resStint, resLaps, resRc];
    const anyOk = results.some((r) => r.ok);
    if (!anyOk) {
      state.liveConsecutiveFailures += 1;
      state.livePollBackoffMs = nextBackoffMsFromFailures(state.liveConsecutiveFailures);
      if (state.liveConsecutiveFailures >= LIVE_CIRCUIT_FAIL_THRESHOLD) {
        state.liveCircuitPausedUntil = Date.now() + LIVE_CIRCUIT_PAUSE_MS;
        state.liveConsecutiveFailures = 0;
        state.livePollBackoffMs = LIVE_POLL_BASE_MS;
        updateLiveDataBanner('error', 'Live data temporarily unavailable');
      }
    } else {
      state.liveConsecutiveFailures = 0;
      state.livePollBackoffMs = LIVE_POLL_BASE_MS;
    }

    const driversArr = state.liveSnapshots.drivers;
    if (Array.isArray(driversArr) && driversArr.length > 0) {
      buildDriverMeta(driversArr);
    }

    scheduleLiveDomPaint();
  }

  function buildDriverMeta(driversJson) {
    if (!Array.isArray(driversJson)) return;
    for (const d of driversJson) {
      if (!d || typeof d !== 'object') continue;
      const number = Number(d.driver_number ?? d.number);
      if (!Number.isFinite(number)) continue;
      const code = String(d.name_acronym || d.code || '').trim().toUpperCase();
      const name = String(d.full_name || d.driver_name || d.name || '').trim();
      const team = String(d.team_name || d.team || d.constructor_name || '').trim();
      const rawHs = d.headshot_url;
      let headshotUrl = '';
      if (typeof rawHs === 'string' && rawHs && rawHs !== 'null') {
        const u = sanitizeHeadshotUrl(rawHs);
        if (isImageSrcAllowed(u)) {
          headshotUrl = u;
          if (code) state.headshotByCode.set(code, headshotUrl);
        } else if (code) {
          headshotUrl = resolveHeadshotForCode(code);
        }
      } else if (code) {
        headshotUrl = resolveHeadshotForCode(code);
      }
      state.driverMetaByNumber.set(number, { code, name, team, headshotUrl });
    }
  }

  function buildTimingTower() {
    const positions = state.liveSnapshots.positions;
    const intervals = state.liveSnapshots.intervals;
    const stints = state.liveSnapshots.stints;
    const pits = state.liveSnapshots.pits;
    const carData = state.liveSnapshots.carData;
    const laps = state.liveSnapshots.laps;
    const stale = state.liveSliceStale;

    const pos = normalizeByDriverNumber(positions, ['driver_number', 'position']);
    const intv = normalizeByDriverNumber(intervals, ['gap_to_leader', 'interval']);
    const stint = latestByDriverNumber(stints, 'date');
    const pit = latestByDriverNumber(pits, 'date');
    const drs = latestByDriverNumber(carData, 'date');
    const lap = latestByDriverNumber(laps, 'date');

    const list = [];
    const driverNums = Array.from(pos.keys());
    driverNums.sort((a, b) => Number(pos.get(a)?.position ?? 999) - Number(pos.get(b)?.position ?? 999));

    for (const dn of driverNums) {
      const meta = state.driverMetaByNumber.get(dn) || { code: '', name: '', team: '', headshotUrl: '' };
      const p = pos.get(dn) || {};
      const g = intv.get(dn) || {};
      const s = stint.get(dn) || {};
      const pr = pit.get(dn) || {};
      const cd = drs.get(dn) || {};
      const lp = lap.get(dn) || {};

      const compound = normalizeCompound(s.compound || s.tyre_compound || s.tire_compound || '');
      const pitOpen = isOpenPitStop(pr);
      const drsOn = Number(cd.drs ?? cd.drs_open ?? cd.drs_activation ?? 0) >= 10;
      const sector = {
        s1: lp.sector1_session_time ?? lp.sector1_time ?? lp.sector_1_time,
        s2: lp.sector2_session_time ?? lp.sector2_time ?? lp.sector_2_time,
        s3: lp.sector3_session_time ?? lp.sector3_time ?? lp.sector_3_time,
      };

      const rawPos = Number(p.position ?? p.pos ?? NaN);
      const posRank = Number.isFinite(rawPos) ? rawPos : 999;

      list.push({
        driverNumber: dn,
        position: posRank,
        code: meta.code || String(p.name_acronym || p.code || '').toUpperCase() || `#${dn}`,
        name: meta.name || '',
        team: meta.team || '',
        headshotUrl: meta.headshotUrl || resolveHeadshotForCode(meta.code || ''),
        teamColor: getTeamColor(meta.team),
        gapToLeader: formatGap(g.gap_to_leader ?? g.gap ?? ''),
        interval: formatGap(g.interval ?? g.interval_to_ahead ?? ''),
        staleIntervals: Boolean(stale.intervals),
        points: null,
        compound,
        pit: pitOpen,
        drs: drsOn,
        sector,
      });
    }

    return list;
  }

  function renderTowerLive(rows) {
    const list = el.timingTower;
    if (!list) return;
    list.className = 'tower tower--liveList';

    // FLIP reorder animation (best-effort)
    const prev = new Map();
    Array.from(list.children).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const key = node.dataset.key;
      if (!key) return;
      prev.set(key, node.getBoundingClientRect());
    });

    list.innerHTML = '';
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'towerRow towerRow--live is-updating';
      li.dataset.key = String(r.driverNumber);
      li.style.setProperty('--accent', r.teamColor);
      const sectorTxt = sectorSummary(r.sector);
      const hsUrl = r.headshotUrl || resolveHeadshotForCode(r.code);
      li.innerHTML = `
        <div class="pos">${escapeHtml(String(r.position))}</div>
        <span class="towerAvatarSlot towerAvatarSlot--live" data-live-avatar="1"></span>
        <div class="code">${escapeHtml(r.code)}</div>
        <div class="meta">
          <div class="name">${escapeHtml(r.name || r.code)}</div>
          <div class="team">${escapeHtml(r.team || '—')}</div>
        </div>
        <div class="tiny">
          ${r.compound ? `<span class="dot ${compoundClass(r.compound)}" title="${escapeHtml(r.compound)}"></span>` : ''}
          ${r.pit ? `<span class="pit pit--open" title="In pit lane">PIT</span>` : ''}
          <span class="drs ${r.drs ? 'is-on' : ''}" title="DRS active (telemetry)"></span>
        </div>
        <div class="timingPair${r.staleIntervals ? ' timingPair--stale' : ''}">
          <div class="timingPair__k">Gap</div>
          <div class="timingPair__v">${escapeHtml(r.gapToLeader || '—')}</div>
          <div class="timingPair__k timingPair__int">Int</div>
          <div class="timingPair__v timingPair__int">${escapeHtml(r.interval || '—')}</div>
        </div>
        <div class="sectors" title="Latest sector times">${sectorPipHtml(r.sector)}<span class="sectors__txt">${escapeHtml(sectorTxt)}</span></div>
      `;
      const avSlot = li.querySelector('[data-live-avatar]');
      if (avSlot) avSlot.replaceWith(makeAvatarEl(r.code, r.name || r.code, hsUrl || ''));
      list.appendChild(li);
    });

    if (!prefersReducedMotion) {
      const next = new Map();
      Array.from(list.children).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const key = node.dataset.key;
        if (!key) return;
        next.set(key, node.getBoundingClientRect());
      });
      for (const [key, newBox] of next.entries()) {
        const oldBox = prev.get(key);
        if (!oldBox) continue;
        const dx = oldBox.left - newBox.left;
        const dy = oldBox.top - newBox.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        const node = list.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (node instanceof HTMLElement) {
          node.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
            { duration: 320, easing: 'cubic-bezier(.2,1,.2,1)' },
          );
        }
      }
    }

    window.setTimeout(() => {
      $$('.towerRow', list).forEach((n) => n.classList.remove('is-updating'));
    }, 250);
    state.lastLiveTowerRows = rows;
  }

  function renderRaceControl(raceControl) {
    if (!Array.isArray(raceControl) || raceControl.length === 0) {
      el.raceControlBanner.hidden = true;
      return;
    }
    const last = raceControl[raceControl.length - 1];
    const msg = String(last.message || last.category || last.flag || last.event || '').toUpperCase();
    const banner = el.raceControlBanner;
    if (!msg) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.classList.remove('is-sc', 'is-red');
    if (msg.includes('SAFETY') || msg.includes('VSC') || msg.includes('SC')) banner.classList.add('is-sc');
    if (msg.includes('RED')) banner.classList.add('is-red');
    banner.textContent = msg.slice(0, 48);
  }

  function renderLapCounter(laps) {
    if (!Array.isArray(laps) || laps.length === 0) {
      el.lapCounter.textContent = 'Lap —';
      return;
    }
    let maxLap = 0;
    for (const l of laps) {
      const n = Number(l.lap_number ?? l.lap ?? 0);
      if (Number.isFinite(n)) maxLap = Math.max(maxLap, n);
    }
    el.lapCounter.textContent = maxLap ? `Lap ${maxLap}` : 'Lap —';
  }

  async function openRaceModal(race) {
    const season = race.season;
    const round = race.round;
    state.modalCircuitGen += 1;
    const circuitGen = state.modalCircuitGen;
    if (typeof el.modalImg.__safeImgSupersede === 'function') el.modalImg.__safeImgSupersede();

    el.modalKicker.textContent = `Round ${round} • ${season}`;
    el.modalTitle.textContent = race.raceName;
    el.modalFacts.innerHTML = `<div class="small muted">Loading…</div>`;
    const altParts = [race.circuitName, race.raceName].filter(Boolean);
    el.modalImg.alt = altParts.length ? `Circuit: ${altParts.join(' · ')}` : 'Race circuit';
    el.modalImg.removeAttribute('src');
    el.modalImg.hidden = false;
    el.modalImg.removeAttribute('aria-hidden');
    setImgPlaceholder(el.modalImg, `${race.circuitName}`);
    openModal();

    const [result1, qual1, resultsFull] = await Promise.all([
      fetchErgastJson(`${season}/${round}/results/1.json`).catch(() => null),
      fetchErgastJson(`${season}/${round}/qualifying/1.json`).catch(() => null),
      fetchErgastJson(`${season}/${round}/results.json`).catch(() => null),
    ]);

    if (circuitGen !== state.modalCircuitGen) return;

    const winner = extractRaceWinner(result1);
    const pole = extractPoleSitter(qual1);
    const fast = extractFastestLap(resultsFull || result1);
    const top10 = extractTopRaceResults(resultsFull, 10);

    await loadCircuitImage(el.modalImg, race, circuitGen);

    if (circuitGen !== state.modalCircuitGen) return;

    el.modalFacts.innerHTML = `
      ${fact('Winner', winner?.name || '—')}
      ${fact('Pole', pole?.name || '—')}
      ${fact('Fastest lap', fast?.name ? `${fast.name}${fast.time ? ` • ${fast.time}` : ''}` : '—')}
      ${fact('Circuit', race.circuitName)}
      ${fact('Date', formatDate(race.date))}
      ${renderModalTop10Rows(top10)}
    `;
  }

  function fact(k, v) {
    return `<div class="fact"><div class="fact__k">${escapeHtml(k)}</div><div class="fact__v">${escapeHtml(v)}</div></div>`;
  }

  function openModal() {
    el.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(el.modal);
  }

  function closeModal() {
    el.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    releaseFocusTrap();
  }

  let focusTrapCleanup = null;
  function trapFocus(modal) {
    releaseFocusTrap();
    const focusables = () =>
      $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', modal).filter((x) => !x.hasAttribute('disabled'));
    const first = focusables()[0];
    first?.focus?.();
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        }
      } else if (i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    };
    modal.addEventListener('keydown', onKey);
    focusTrapCleanup = () => modal.removeEventListener('keydown', onKey);
  }
  function releaseFocusTrap() {
    if (focusTrapCleanup) focusTrapCleanup();
    focusTrapCleanup = null;
  }

  function setupSnapshotLazyLoad() {
    const target = $('#snapshot');
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void loadSnapshot();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(target);
  }

  async function loadSnapshot() {
    if (state.snapshotLoaded) return;
    state.snapshotLoaded = true;
    el.tyreNote.textContent = 'Loading…';
    el.winsNote.textContent = 'Loading…';
    el.closestNote.textContent = 'Loading…';

    // best-effort strategy:
    // - find completed races from Ergast calendar
    // - fetch Ergast winner info per round to compute wins & closest margin
    // - tyre usage: only possible via OpenF1 stints, so we attempt to map Race sessions by year + session_name=Race
    const yr = state.activeSeason || SEASON_CURRENT;
    const calendarJson = await cachedSeasonJson(seasonCacheKey(yr, 'calendar'), () => fetchErgastJson(`${yr}.json`));
    const calendar = extractCalendar(calendarJson);
    const now = new Date();
    const done = calendar.filter((r) => isRaceDone(r, now));

    await Promise.all([buildWinsAndClosest(done), buildTyreUsage(yr)]);
  }

  async function buildWinsAndClosest(doneRaces) {
    if (doneRaces.length === 0) {
      el.winsBars.innerHTML = '';
      el.winsNote.textContent = 'No completed rounds yet — wins chart will fill as races finish.';
      el.closestNote.textContent = '';
      return;
    }

    const wins = new Map(); // constructor -> count
    let closest = null; // { raceName, margin, winner, runnerUp }

    const results = await withLimit(
      doneRaces,
      4,
      async (r) =>
        cachedSeasonJson(roundCacheKey(r.season, r.round, 'top2'), () => fetchErgastJson(`${r.season}/${r.round}/results/2.json`)),
    );

    results.forEach((json, idx) => {
      const race = doneRaces[idx];
      const top2 = extractTop2(json);
      if (!top2) return;
      const winner = top2[0];
      const p2 = top2[1];
      wins.set(winner.constructorName, (wins.get(winner.constructorName) || 0) + 1);
      const marginSec = parseGapSeconds(p2.timeGap || '');
      if (marginSec != null && (closest == null || marginSec < closest.margin)) {
        closest = {
          raceName: race.raceName,
          margin: marginSec,
          winner: `${winner.givenName} ${winner.familyName}`,
          runnerUp: `${p2.givenName} ${p2.familyName}`,
        };
      }
    });

    const winBars = winsToBars(wins);
    if (winBars.length === 0) {
      el.winsBars.innerHTML = '<div class="emptyHint">No constructor wins parsed yet — results may still be provisional.</div>';
    } else {
      renderBars(el.winsBars, winBars, { valueFormatter: (v) => `${v}` });
    }
    el.winsNote.textContent = `Wins by team from Ergast race results (${doneRaces.length} completed round${doneRaces.length === 1 ? '' : 's'}).`;

    if (!closest) {
      el.closestCard.innerHTML = `<div class="editorialCard editorialCard--muted"><div class="editorialTitle">Closest finish</div><div class="editorialMeta"><div>No P2 time-gap data yet — many sprint or classified finishes omit gaps in the feed.</div><div class="editorialSubhint">Check back after more conventional race endings.</div></div></div>`;
      el.closestNote.textContent = '';
      return;
    }

    el.closestCard.innerHTML = `
      <div class="editorialCard">
        <div class="editorialTitle">${escapeHtml(closest.raceName)}</div>
        <div class="editorialMeta">
          <div><strong>${escapeHtml(closest.winner)}</strong> over ${escapeHtml(closest.runnerUp)}</div>
          <div>Winning margin: <strong>${escapeHtml(closest.margin.toFixed(3))}s</strong></div>
        </div>
      </div>
    `;
    el.closestNote.textContent = 'Margins derived from P2 time gap when available.';
  }

  async function buildTyreUsage(year) {
    // This is intentionally lazy + best-effort; OpenF1 session discovery is not guaranteed for all years/rounds.
    try {
      const sessionsRaw = await cachedSeasonJson(openF1SessionsCacheKey(year), async () => {
        const r = await fetchLiveJson('sessions', { year: String(year), session_name: 'Race' });
        return r.ok ? r.data : [];
      });
      const sessions = assertLivePayloadArray('sessions', sessionsRaw);
      if (sessions.length === 0) {
        el.tyreBars.innerHTML = '';
        el.tyreNote.textContent = 'Tyre breakdown unavailable (no OpenF1 race sessions found).';
        return;
      }
      // limit to first N to avoid excessive requests
      const sessionKeys = sessions
        .map((s) => s.session_key)
        .filter((k) => k != null && k !== '')
        .slice(0, 18);

      const stints = await withLimit(
        sessionKeys,
        3,
        async (sk) => {
          const r = await fetchLiveJson('stints', { session_key: String(sk) });
          return r.ok ? assertLivePayloadArray('stints', r.data) : [];
        },
      );

      const counts = new Map([['SOFT', 0], ['MEDIUM', 0], ['HARD', 0], ['INTERMEDIATE', 0], ['WET', 0]]);
      stints.flat().forEach((s) => {
        const c = normalizeCompound(s.compound || s.tyre_compound || '');
        if (!c) return;
        const key = c.toUpperCase();
        if (!counts.has(key)) counts.set(key, 0);
        counts.set(key, counts.get(key) + 1);
      });

      renderBars(
        el.tyreBars,
        [...counts.entries()]
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({ label: k, value: v, color: compoundColor(k) })),
        { valueFormatter: (v) => `${v}` },
      );
      el.tyreNote.textContent = 'Best-effort: aggregated from OpenF1 stints for discovered Race sessions.';
    } catch {
      el.tyreBars.innerHTML = '';
      el.tyreNote.textContent = 'Tyre breakdown unavailable (request failed).';
    }
  }

  function renderBars(root, items, opts) {
    root.innerHTML = '';
    if (!items || items.length === 0) return;
    const max = Math.max(...items.map((x) => x.value || 0), 1);
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'barRow';
      row.innerHTML = `
        <div>
          <div class="barLabel">
            <span class="barLabel__name" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</span>
            <span class="barValue">${escapeHtml(opts?.valueFormatter ? opts.valueFormatter(it.value) : String(it.value))}</span>
          </div>
          <div class="barTrack" role="presentation">
            <div class="barFill" style="background:${escapeHtml(it.color || 'var(--accent)')};"></div>
          </div>
        </div>
        <div></div>
      `;
      root.appendChild(row);
      const fill = row.querySelector('.barFill');
      const pct = Math.round((it.value / max) * 1000) / 10;
      window.setTimeout(() => {
        row.classList.add('is-in');
        if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
      }, prefersReducedMotion ? 0 : 80 + i * 60);
    });
  }

  function makeTowerRowStatic(d, headshotYear = SEASON_CURRENT) {
    const li = document.createElement('li');
    li.className = 'towerRow';
    const teamColor = getTeamColor(d.constructorName);
    li.style.setProperty('--accent', teamColor);
    li.innerHTML = `
      <div class="pos">${escapeHtml(String(d.position))}</div>
      <span class="towerAvatarSlot" data-tower-avatar="1"></span>
      <div class="code">${escapeHtml(d.code)}</div>
      <div class="meta">
        <div class="name">${escapeHtml(d.givenName)} ${escapeHtml(d.familyName)}</div>
        <div class="team">${escapeHtml(d.constructorName)}</div>
      </div>
      <div class="pts">${escapeHtml(String(d.points))} pts</div>
      <div class="gap">${escapeHtml(d.gapToLeader || '')}</div>
    `;
    const av = li.querySelector('[data-tower-avatar]');
    if (av) av.replaceWith(makeAvatarEl(d.code, `${d.givenName} ${d.familyName}`, '', headshotYear));
    return li;
  }

  function makeConstructorRow(c) {
    const li = document.createElement('li');
    li.className = 'constructorRow';
    li.tabIndex = 0;
    const color = getTeamColor(c.constructorName);
    const title = wikiTitleForTeam(c.constructorName);
    li.innerHTML = `
      <div class="pos">${escapeHtml(String(c.position))}</div>
      <div class="constructorName">${escapeHtml(c.constructorName)}</div>
      <div class="logoMini" aria-hidden="true"><span></span></div>
    `;
    li.addEventListener('click', () => setAccent(color));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') setAccent(color);
    });
    void loadTeamLogoInto(li.querySelector('.logoMini'), title, c.constructorName, c.constructorId);
    return li;
  }

  function wikiThumbFromQueryJson(j) {
    const pages = j?.query?.pages || {};
    const first = pages[Object.keys(pages)[0]];
    return first?.thumbnail?.source || '';
  }

  function resolveLocalTeamLogoSlug(constructorName, constructorId) {
    const id = String(constructorId || '')
      .trim()
      .toLowerCase();
    if (id && TEAM_LOGO_SLUG_BY_CONSTRUCTOR_ID[id]) return TEAM_LOGO_SLUG_BY_CONSTRUCTOR_ID[id];
    const cleaned = String(constructorName || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    if (TEAM_LOGO_SLUG_BY_NAME[cleaned]) return TEAM_LOGO_SLUG_BY_NAME[cleaned];
    const compact = cleaned.replace(/\s/g, '');
    if (TEAM_LOGO_SLUG_BY_NAME[compact]) return TEAM_LOGO_SLUG_BY_NAME[compact];
    return '';
  }

  /** Same-origin paths: production `/images/...`; from `/season-tracker/` `../images/...` also resolves to `/images/`. */
  function localTeamLogoUrlCandidates(slug) {
    return [`/images/teams/${slug}.svg`, `../images/teams/${slug}.svg`];
  }

  async function loadTeamLogoInto(container, wikiTitle, constructorName, constructorId) {
    if (!(container instanceof HTMLElement)) return;
    container.classList.add('logoMini--pending');
    container.innerHTML = '<span class="logoShimmer" aria-hidden="true"></span>';
    const slug = resolveLocalTeamLogoSlug(constructorName, constructorId);
    const localCandidates = slug ? localTeamLogoUrlCandidates(slug).filter(isImageSrcAllowed) : [];

    if (localCandidates.length > 0) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.className = 'logoMini__img';
      const ok = await setImageWithFallbacks(img, localCandidates, {
        onSuccess: () => {
          container.classList.remove('logoMini--pending');
          container.replaceChildren(img);
        },
      });
      if (ok) return;
    }
    await loadTeamLogoFromWiki(container, wikiTitle, constructorName);
  }

  function wikiLogoMissKey(wikiTitle) {
    return `${WIKI_LOGO_MISS_PREFIX}${String(wikiTitle).toLowerCase()}`;
  }

  function isWikiLogoMiss(wikiTitle) {
    try {
      return sessionStorage.getItem(wikiLogoMissKey(wikiTitle)) === '1';
    } catch {
      return false;
    }
  }

  function markWikiLogoMiss(wikiTitle) {
    try {
      sessionStorage.setItem(wikiLogoMissKey(wikiTitle), '1');
    } catch {
      // ignore
    }
  }

  async function loadTeamLogoFromWiki(container, wikiTitle, constructorName) {
    if (!(container instanceof HTMLElement) || !wikiTitle) {
      container.classList.remove('logoMini--pending');
      container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
      return;
    }
    if (isWikiLogoMiss(wikiTitle)) {
      container.classList.remove('logoMini--pending');
      container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
      return;
    }
    container.classList.add('logoMini--pending');
    if (!container.querySelector('.logoShimmer')) {
      container.innerHTML = '<span class="logoShimmer" aria-hidden="true"></span>';
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const tryTitles = [];
    const cleaned = String(constructorName || '')
      .replace(/\s+/g, ' ')
      .trim();
    const commonsFile = TEAM_COMMONS_FILES[cleaned] || TEAM_COMMONS_FILES[cleaned.replace(/\s/g, '')];
    if (commonsFile) tryTitles.push({ host: 'https://commons.wikimedia.org', title: commonsFile });
    tryTitles.push({ host: 'https://en.wikipedia.org', title: wikiTitle });

    try {
      let src = '';
      for (const { host, title } of tryTitles) {
        const url = `${host}/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=160&titles=${encodeURIComponent(title)}`;
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) continue;
        // eslint-disable-next-line no-await-in-loop
        const j = await r.json();
        src = wikiThumbFromQueryJson(j);
        if (src) break;
      }
      if (src && isImageSrcAllowed(src)) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.className = 'logoMini__img logoMini__img--remote';
        const ok = await setImageWithFallbacks(img, [src], {
          referrerPolicy: 'no-referrer',
          onSuccess: () => {
            container.classList.remove('logoMini--pending');
            container.replaceChildren(img);
          },
        });
        if (ok) return;
      }
      markWikiLogoMiss(wikiTitle);
      container.classList.remove('logoMini--pending');
      container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
    } catch {
      markWikiLogoMiss(wikiTitle);
      container.classList.remove('logoMini--pending');
      container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function bindTilt() {
    const cards = $$('[data-tilt="true"]');
    cards.forEach((card) => {
      const max = 7;
      const onMove = (e) => {
        if (prefersReducedMotion) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
      };
      const onLeave = () => {
        card.style.transform = '';
      };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
    });
  }

  function setAccent(color, opts = {}) {
    const root = document.documentElement;
    const prev = getComputedStyle(root).getPropertyValue('--accent')?.trim();
    if (opts.soft && prev && prev.length > 0) return;
    root.style.setProperty('--team-accent', color);
    root.style.setProperty('--accent', color);
    const bar = document.getElementById('heroAccentBar');
    if (bar instanceof HTMLElement) {
      bar.style.background = `linear-gradient(90deg, ${color}, transparent 72%)`;
      bar.style.boxShadow = `0 0 28px color-mix(in oklab, ${color} 45%, transparent)`;
    }
  }

  function getTeamColor(name) {
    if (!name) return '#ff2a6d';
    const cleaned = String(name).replace(/\s+/g, ' ').trim();
    if (TEAM_COLORS[cleaned]) return TEAM_COLORS[cleaned];
    const key = cleaned.replace(/\s/g, '');
    return TEAM_COLORS[key] || '#ff2a6d';
  }

  function wikiTitleForTeam(name) {
    if (!name) return '';
    const cleaned = String(name).replace(/\s+/g, ' ').trim();
    if (TEAM_WIKI_TITLES[cleaned]) return TEAM_WIKI_TITLES[cleaned];
    const key = cleaned.replace(/\s/g, '');
    return TEAM_WIKI_TITLES[key] || cleaned;
  }

  // ---------------------------
  // Data helpers (Ergast)
  // ---------------------------

  async function fetchErgastJson(path) {
    const url = `/api/f1-season?path=${encodeURIComponent(path)}`;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        if (r.status === 404) return { MRData: {} };
        const snippet = await r.text().catch(() => '');
        logDataError('fetchErgastJson', new Error(`HTTP ${r.status}`), { path, snippet: snippet.slice(0, 200) });
        throw new Error(`Ergast fetch failed (${r.status})`);
      }
      const json = await r.json();
      if (json && typeof json === 'object' && 'error' in json && !json.MRData) {
        logDataError('fetchErgastJson', new Error('proxy error'), { path, error: json.error });
        return { MRData: {} };
      }
      return json;
    } catch (err) {
      logDataError('fetchErgastJson', err, { path });
      throw err;
    }
  }

  /**
   * Resilient OpenF1 fetch via same-origin proxy. Never throws; use `ok` to branch.
   * Paths are allowlisted; requests time out so hung sockets do not stall the live panel.
   */
  async function fetchLiveJson(path, params = {}) {
    if (!OPENF1_ALLOWED_PATHS.has(path)) {
      return { ok: false, error: 'path_not_allowed', status: 0 };
    }
    const controller = new AbortController();
    let timer = null;
    try {
      timer = window.setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);
      const sp = new URLSearchParams({ path: String(path) });
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        sp.set(k, String(v));
      }
      const response = await fetch(`/api/f1-live?${sp.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        logDataError('fetchLiveJson', new Error(`HTTP ${response.status}`), { path, params });
        return { ok: false, error: `http_${response.status}`, status: response.status };
      }
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        logDataError('fetchLiveJson', parseErr, { path, params });
        return { ok: false, error: 'json_parse', status: response.status };
      }
      return { ok: true, data, status: response.status };
    } catch (err) {
      const name = err && typeof err === 'object' ? err.name : '';
      if (name === 'AbortError') return { ok: false, error: 'timeout', status: 0 };
      logDataError('fetchLiveJson', err, { path, params });
      return { ok: false, error: 'network', status: 0 };
    } finally {
      if (timer != null) window.clearTimeout(timer);
    }
  }

  function isCacheableSeasonPayload(key, data) {
    if (!data || typeof data !== 'object') return false;
    const lists = data?.MRData?.StandingsTable?.StandingsLists?.[0];
    if (key.includes('driverStandings')) {
      const ds = lists?.DriverStandings || lists?.DriverStanding || [];
      return Array.isArray(ds) && ds.length > 0;
    }
    if (key.includes('constructorStandings')) {
      const cs = lists?.ConstructorStandings || [];
      return Array.isArray(cs) && cs.length > 0;
    }
    if (key.includes('_calendar')) {
      const races = data?.MRData?.RaceTable?.Races;
      return Array.isArray(races) && races.length > 0;
    }
    if (key.includes('_round_')) {
      const races = data?.MRData?.RaceTable?.Races;
      if (!Array.isArray(races) || races.length === 0) return false;
      const race = races[0];
      return Boolean(race?.Results?.length || race?.QualifyingResults?.length);
    }
    return true;
  }

  function readCachedSeasonJson(fullKey) {
    const raw = sessionStorage.getItem(fullKey);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (isCacheableSeasonPayload(fullKey, data)) return data;
        sessionStorage.removeItem(fullKey);
      } catch {
        sessionStorage.removeItem(fullKey);
      }
    }
    const loc = readSeasonLocalBundle(fullKey);
    if (loc?.isFresh && isCacheableSeasonPayload(fullKey, loc.data)) {
      try {
        sessionStorage.setItem(fullKey, JSON.stringify(loc.data));
      } catch {
        // ignore quota
      }
      return loc.data;
    }
    if (loc && !isCacheableSeasonPayload(fullKey, loc.data)) {
      try {
        localStorage.removeItem(seasonLocalStorageKey(fullKey));
      } catch {
        // ignore
      }
    }
    return loc?.data && isCacheableSeasonPayload(fullKey, loc.data) ? loc.data : null;
  }

  function writeCachedSeasonJson(fullKey, data) {
    if (!isCacheableSeasonPayload(fullKey, data)) return;
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(data));
    } catch {
      // ignore quota
    }
    writeSeasonLocalBundle(fullKey, data);
  }

  async function cachedSeasonJson(key, loader) {
    const fullKey = key;
    const cached = readCachedSeasonJson(fullKey);
    if (cached) return cached;

    const loc = readSeasonLocalBundle(fullKey);
    try {
      const data = await loader();
      writeCachedSeasonJson(fullKey, data);
      return data;
    } catch (err) {
      if (loc?.data && isCacheableSeasonPayload(fullKey, loc.data)) {
        logDataError('cachedSeasonJson', err, { key: fullKey, note: 'stale local fallback' });
        writeCachedSeasonJson(fullKey, loc.data);
        return loc.data;
      }
      throw err;
    }
  }

  function extractDriverStandings(json) {
    if (!json || typeof json !== 'object') return [];
    const standings =
      json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ||
      json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStanding ||
      [];
    const out = standings.map((s) => {
      const d = s.Driver || {};
      const c = (s.Constructors && s.Constructors[0]) || s.Constructor || {};
      const code = (d.code || d.driverCode || d.permanentNumber || '').toString().toUpperCase().slice(0, 3);
      return {
        position: Number(s.position || 0),
        points: Number(s.points || 0),
        wins: Number(s.wins || 0),
        driverId: d.driverId || '',
        code: DRIVER_CODE_FIX[code] || code || (d.familyName ? d.familyName.slice(0, 3).toUpperCase() : '—'),
        givenName: d.givenName || '',
        familyName: d.familyName || '',
        constructorName: c.name || '—',
      };
    });

    // gap to leader
    if (out.length > 0) {
      const leadPts = out[0].points;
      out.forEach((d) => {
        d.gapToLeader = d.position === 1 ? '' : `+${leadPts - d.points}`;
      });
    }
    return out;
  }

  function extractConstructorStandings(json) {
    if (!json || typeof json !== 'object') return [];
    const standings = json?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    return standings.map((s) => {
      const c = s.Constructor || {};
      return {
        position: Number(s.position || 0),
        points: Number(s.points || 0),
        wins: Number(s.wins || 0),
        constructorId: c.constructorId || '',
        constructorName: c.name || '—',
      };
    });
  }

  function extractCalendar(json) {
    if (!json || typeof json !== 'object') return [];
    const races = json?.MRData?.RaceTable?.Races || [];
    return races.map((r) => ({
      season: Number(r.season || SEASON_CURRENT),
      round: Number(r.round || 0),
      raceName: r.raceName || 'Grand Prix',
      date: r.date || '',
      time: r.time || '',
      country: r.Circuit?.Location?.country || '',
      circuitName: r.Circuit?.circuitName || '',
      circuitId: String(r.Circuit?.circuitId || '')
        .trim()
        .toLowerCase(),
    }));
  }

  function pickNextRace(calendar) {
    if (!Array.isArray(calendar) || calendar.length === 0) return null;
    const now = new Date();
    const nowMs = now.getTime();
    const rows = calendar
      .map((r) => ({ r, t: Date.parse(`${r.date}T${r.time || '13:00:00Z'}`) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);

    const future = rows.filter((x) => x.t > nowMs);
    if (future[0]) return future[0].r;

    const inWeekend = rows.find((x) => x.t <= nowMs && !isRaceDone(x.r, now));
    if (inWeekend) return inWeekend.r;

    return null;
  }

  function getSeasonRacePhase(calendar) {
    if (!Array.isArray(calendar) || calendar.length === 0) {
      return { phase: 'unavailable', race: null };
    }
    const now = new Date();
    const next = pickNextRace(calendar);
    if (next) return { phase: 'upcoming', race: next };

    const allDone = calendar.every((r) => isRaceDone(r, now));
    if (allDone) {
      const last = [...calendar].sort((a, b) => b.round - a.round)[0];
      return { phase: 'complete', race: last };
    }

    const hasFuture = calendar.some((r) => {
      const t = Date.parse(`${r.date}T${r.time || '13:00:00Z'}`);
      return Number.isFinite(t) && t > now.getTime();
    });
    if (!hasFuture) return { phase: 'break', race: null };

    return { phase: 'unavailable', race: null };
  }

  function isRaceDone(race, now) {
    const t = Date.parse(`${race.date}T${race.time || '13:00:00Z'}`);
    if (!Number.isFinite(t)) return false;
    return now.getTime() > t + 6 * 60 * 60 * 1000;
  }

  function extractRaceWinner(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results?.[0];
    if (!res) return null;
    const d = res.Driver || {};
    const code = (d.code || '').toString().toUpperCase();
    return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
  }

  function extractPoleSitter(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.QualifyingResults?.[0];
    if (!res) return null;
    const d = res.Driver || {};
    const code = (d.code || '').toString().toUpperCase();
    return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
  }

  function extractFastestLap(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results || [];
    for (const r of res) {
      if (r?.FastestLap?.rank === '1' || r?.FastestLap?.rank === 1) {
        const d = r.Driver || {};
        return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), time: r.FastestLap?.Time?.time || '' };
      }
    }
    return null;
  }

  /** Full `results.json` race grid — first `limit` classified rows (best-effort). */
  function extractTopRaceResults(json, limit = 10) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results || [];
    const cap = Math.min(Math.max(1, Number(limit) || 10), 20);
    const out = [];
    for (let i = 0; i < res.length && out.length < cap; i += 1) {
      const r = res[i];
      if (!r || typeof r !== 'object') continue;
      const d = r.Driver || {};
      const c = r.Constructor || {};
      const pos = String(r.position ?? r.grid ?? i + 1);
      const code = (d.code || '').toString().toUpperCase();
      const name = `${d.givenName || ''} ${d.familyName || ''}`.trim() || '—';
      const cn = c.name || '—';
      const status = r.status || '';
      const time = r.Time?.time || r.Time?.millis || '';
      out.push({ pos, code, name, constructorName: cn, status, time });
    }
    return out;
  }

  function formatCountdownShort(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function renderModalTop10Rows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const head =
      '<thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time / status</th></tr></thead>';
    const body = rows
      .map((r) => {
        const t = r.time || r.status || '—';
        return `<tr><td>${escapeHtml(r.pos)}</td><td>${escapeHtml(r.code)} <span class="modalResults__name">${escapeHtml(r.name)}</span></td><td>${escapeHtml(r.constructorName)}</td><td>${escapeHtml(t)}</td></tr>`;
      })
      .join('');
    return `<div class="modalResults"><div class="modalResults__title">Race results (top ${rows.length})</div><div class="modalResults__tableWrap"><table>${head}<tbody>${body}</tbody></table></div></div>`;
  }

  async function refreshIdleInsight() {
    const box = el.idleInsight;
    if (!box) return;
    if (state.live) {
      box.hidden = true;
      return;
    }
    if (state.year !== state.activeSeason) {
      box.hidden = true;
      return;
    }
    const nr = state.nextRace;
    if (!nr) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const targetMs = Date.parse(`${nr.date}T${nr.time || '13:00:00Z'}`);
    const nowMs = Date.now();
    const cd = Number.isFinite(targetMs) ? Math.max(0, targetMs - nowMs) : null;

    const py = SEASON_CURRENT - 1;
    let asideBlocks = '';
    if (py >= SEASON_MIN) {
      try {
        const prev = await fetchErgastJson(`${py}/${nr.round}/results.json`);
        const w = extractRaceWinner(prev);
        const f = extractFastestLap(prev);
        asideBlocks += `<p class="idleInsight__fact"><strong>${py} winner</strong> · ${escapeHtml(w?.name || '—')}</p>`;
        const fl = f?.name ? `${f.name}${f.time ? ` (${f.time})` : ''}` : '—';
        asideBlocks += `<p class="idleInsight__fact"><strong>${py} fastest lap</strong> · ${escapeHtml(fl)}</p>`;
      } catch {
        asideBlocks += `<p class="idleInsight__fact"><span>Could not load ${py} race data.</span></p>`;
      }
    } else {
      asideBlocks = `<p class="idleInsight__fact"><span>No prior season on file.</span></p>`;
    }

    box.innerHTML = `
      <div class="panel__titleRow">
        <div class="panel__title">Next race</div>
        <div class="panel__hint">No live session</div>
      </div>
      <div class="idleInsight__grid">
        <div class="idleInsight__main">
          <div class="idleInsight__kicker">Upcoming</div>
          <h2 class="idleInsight__title">${escapeHtml(nr.raceName)}</h2>
          <p class="idleInsight__meta">${escapeHtml(nr.circuitName)} · ${escapeHtml(formatDate(nr.date))}</p>
          <p class="idleInsight__count">${cd != null ? `Starts in ${escapeHtml(formatCountdownShort(cd))}` : escapeHtml('Schedule TBC')}</p>
        </div>
        <div class="idleInsight__aside">
          <div class="idleInsight__asideTitle">Same round, last season</div>
          ${asideBlocks}
        </div>
      </div>
    `;
  }

  function extractTop2(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results || [];
    if (res.length < 2) return null;
    return res.slice(0, 2).map((r) => {
      const d = r.Driver || {};
      const c = r.Constructor || {};
      return {
        givenName: d.givenName || '',
        familyName: d.familyName || '',
        constructorName: c.name || '—',
        timeGap: r?.Time?.time || r?.Time?.gap || r?.Time?.timeGap || r?.Time?.delta || r?.Time?.milli || r?.status || '',
      };
    });
  }

  function parseGapSeconds(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    // Common formats: "+1.234", "1.234", "0:01.234"
    const cleaned = s.replace(/^\+/, '');
    if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
    const m = cleaned.match(/^(\d+):(\d+(\.\d+)?)$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return null;
  }

  // ---------------------------
  // OpenF1 helpers
  // ---------------------------

  /** Coerce live API payloads to plain object arrays; drop malformed rows (never throws). */
  function assertLivePayloadArray(kind, data) {
    void kind;
    if (!Array.isArray(data)) return [];
    const out = [];
    for (const row of data) {
      if (row && typeof row === 'object') out.push(row);
    }
    return out;
  }

  function normalizeByDriverNumber(rows, keys) {
    const map = new Map();
    if (!Array.isArray(rows)) return map;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const dn = Number(r.driver_number ?? r.driverNumber ?? r.number);
      if (!Number.isFinite(dn)) continue;
      const obj = { ...r };
      // ensure position property if present
      if (obj.position == null && obj.pos != null) obj.position = obj.pos;
      map.set(dn, obj);
      void keys;
    }
    return map;
  }

  function latestByDriverNumber(rows, timeKeyHint) {
    const map = new Map();
    if (!Array.isArray(rows)) return map;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const dn = Number(r.driver_number ?? r.driverNumber ?? r.number);
      if (!Number.isFinite(dn)) continue;
      const cur = map.get(dn);
      if (!cur) {
        map.set(dn, r);
        continue;
      }
      const a = Date.parse(cur[timeKeyHint] || cur.date || '');
      const b = Date.parse(r[timeKeyHint] || r.date || '');
      if (Number.isFinite(b) && (!Number.isFinite(a) || b > a)) map.set(dn, r);
    }
    return map;
  }

  function normalizeCompound(v) {
    const s = String(v || '').trim().toUpperCase();
    if (!s) return '';
    if (s.startsWith('SOFT')) return 'SOFT';
    if (s.startsWith('MED')) return 'MEDIUM';
    if (s.startsWith('HARD')) return 'HARD';
    if (s.startsWith('INTER')) return 'INTERMEDIATE';
    if (s.startsWith('WET')) return 'WET';
    return s;
  }

  function compoundClass(c) {
    const k = normalizeCompound(c);
    if (k === 'SOFT') return 'dot--soft';
    if (k === 'MEDIUM') return 'dot--medium';
    if (k === 'HARD') return 'dot--hard';
    if (k === 'INTERMEDIATE') return 'dot--inter';
    if (k === 'WET') return 'dot--wet';
    return '';
  }

  function compoundColor(c) {
    const k = normalizeCompound(c);
    if (k === 'SOFT') return '#ff4d4d';
    if (k === 'MEDIUM') return '#ffb020';
    if (k === 'HARD') return '#e8e8e8';
    if (k === 'INTERMEDIATE') return '#3ad1ff';
    if (k === 'WET') return '#38d996';
    return 'var(--accent)';
  }

  function formatGap(v) {
    if (v == null) return '—';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '—';
      return v >= 0 ? `+${v}` : String(v);
    }
    const s = String(v).trim();
    if (!s) return '—';
    const lower = s.toLowerCase();
    if (lower === 'nan' || lower === 'null' || lower === 'undefined') return '—';
    if (/^\+?lapped/i.test(s) || /^\+?lap/i.test(s)) return s.startsWith('+') ? s : `+${s}`;
    const compact = s.replace(/\s+/g, '');
    if (/^\+?\d*\.?\d+(s|sec|secs)?$/i.test(compact)) {
      return compact.startsWith('+') ? compact : `+${compact}`;
    }
    if (/^\+?\d/.test(compact)) return compact.startsWith('+') ? compact : `+${compact}`;
    return '—';
  }

  /** Compact sector line (OpenF1 exposes sector N session times when available). */
  function formatSectorToken(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(3);
    const s = String(v).trim();
    return s.length > 16 ? `${s.slice(0, 16)}…` : s;
  }

  function sectorSummary(sector) {
    if (!sector || typeof sector !== 'object') return '—';
    const a = [formatSectorToken(sector.s1), formatSectorToken(sector.s2), formatSectorToken(sector.s3)].filter(Boolean);
    if (a.length === 0) return '—';
    return `${a.join(' / ')}`;
  }

  function isOpenPitStop(pr) {
    if (!pr || typeof pr !== 'object') return false;
    if (pr.in_pit === true) return true;
    const inn = pr.pit_in_time ?? pr.pit_in;
    const out = pr.pit_out_time ?? pr.pit_out;
    const hasIn = inn != null && inn !== '';
    const hasOut = out != null && out !== '';
    return hasIn && !hasOut;
  }

  function parseSectorSeconds(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    const n = parseFloat(s.replace(/[^\d.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /** Shortest sector time → “best” pip (F1-style sector colouring). */
  function sectorPipHtml(sector) {
    const v1 = parseSectorSeconds(sector.s1);
    const v2 = parseSectorSeconds(sector.s2);
    const v3 = parseSectorSeconds(sector.s3);
    const vals = [v1, v2, v3].filter((x) => x != null);
    if (vals.length === 0) return '<span class="sectorPips" aria-hidden="true"></span>';
    const min = Math.min(...vals);
    const cls = (v) => {
      if (v == null) return 'sectorPip sectorPip--na';
      return v <= min + 0.002 ? 'sectorPip sectorPip--best' : 'sectorPip sectorPip--slow';
    };
    return `<span class="sectorPips" aria-hidden="true"><span class="${cls(v1)}"></span><span class="${cls(
      v2,
    )}"></span><span class="${cls(v3)}"></span></span>`;
  }

  // ---------------------------
  // Images (drivers + circuits)
  // ---------------------------

  function setImgPlaceholder(img, label) {
    const shell = img.closest('.imgShell');
    if (!(shell instanceof HTMLElement)) return;
    shell.classList.remove('imgShell--failed');
    const fb = shell.querySelector('.circuitFallback');
    if (fb instanceof HTMLElement) {
      fb.hidden = true;
      fb.replaceChildren();
      fb.setAttribute('aria-hidden', 'true');
    }
    const initials = initialsFrom(label);
    let node = shell.querySelector('.initials');
    if (!node) {
      node = document.createElement('div');
      node.className = 'initials';
      shell.appendChild(node);
    }
    node.textContent = initials;
    const shimmer = shell.querySelector('.shimmer');
    if (shimmer instanceof HTMLElement) shimmer.style.display = '';
  }

  async function loadCircuitImage(img, race, circuitGen) {
    const shell = img.closest('.imgShell');
    const label = race?.circuitName || race?.raceName || '';
    const fb = shell instanceof HTMLElement ? shell.querySelector('.circuitFallback') : null;

    const ok = await setImageWithFallbacks(img, circuitImageUrlCandidatesFromRace(race), {
      alt: label || 'Circuit',
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      shouldApply: () => circuitGen === state.modalCircuitGen,
      onSuccess: () => {
        if (circuitGen !== state.modalCircuitGen) return;
        if (shell) {
          shell.classList.remove('imgShell--failed');
          shell.querySelector('.shimmer')?.setAttribute('style', 'display:none');
          shell.querySelector('.initials')?.remove();
        }
        if (fb instanceof HTMLElement) {
          fb.hidden = true;
          fb.replaceChildren();
          fb.setAttribute('aria-hidden', 'true');
        }
        img.hidden = false;
        img.removeAttribute('aria-hidden');
      },
      onShowPlaceholder: () => {
        if (circuitGen !== state.modalCircuitGen) return;
        if (shell) {
          shell.classList.add('imgShell--failed');
          shell.querySelector('.shimmer')?.setAttribute('style', 'display:none');
          shell.querySelector('.initials')?.remove();
        }
        img.removeAttribute('src');
        img.hidden = true;
        img.setAttribute('aria-hidden', 'true');
        if (fb instanceof HTMLElement) {
          fb.replaceChildren();
          const abbr = document.createElement('span');
          abbr.className = 'circuitFallback__abbr';
          abbr.textContent = initialsFrom(label);
          const nm = document.createElement('span');
          nm.className = 'circuitFallback__name';
          nm.textContent = label || 'Circuit';
          fb.appendChild(abbr);
          fb.appendChild(nm);
          fb.hidden = false;
          fb.removeAttribute('aria-hidden');
        }
      },
    });
  }

  // ---------------------------
  // Utilities
  // ---------------------------

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(d) {
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  }

  function initialsFrom(s) {
    const parts = String(s || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] || 'F';
    const b = parts[1]?.[0] || parts[0]?.[1] || '1';
    return `${a}${b}`.toUpperCase();
  }

  function slugifyCircuit(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function flagEmojiFromCountry(country) {
    const c = String(country || '').toLowerCase();
    const map = {
      italy: '🇮🇹',
      monaco: '🇲🇨',
      spain: '🇪🇸',
      france: '🇫🇷',
      'united kingdom': '🇬🇧',
      uk: '🇬🇧',
      britain: '🇬🇧',
      austria: '🇦🇹',
      belgium: '🇧🇪',
      netherlands: '🇳🇱',
      germany: '🇩🇪',
      hungary: '🇭🇺',
      japan: '🇯🇵',
      singapore: '🇸🇬',
      australia: '🇦🇺',
      china: '🇨🇳',
      canada: '🇨🇦',
      usa: '🇺🇸',
      'united states': '🇺🇸',
      mexico: '🇲🇽',
      brazil: '🇧🇷',
      qatar: '🇶🇦',
      bahrain: '🇧🇭',
      uae: '🇦🇪',
      'saudi arabia': '🇸🇦',
      azerbaijan: '🇦🇿',
      'south africa': '🇿🇦',
      'czech republic': '🇨🇿',
      finland: '🇫🇮',
      sweden: '🇸🇪',
      norway: '🇳🇴',
    };
    return map[c] || '🏁';
  }

  function colorAlpha(hex, a) {
    const h = String(hex || '').trim();
    if (!h.startsWith('#')) return `rgba(255,255,255,${a})`;
    const x = h.slice(1);
    const n = x.length === 3 ? x.split('').map((c) => c + c).join('') : x;
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function winsToBars(map) {
    const items = [...map.entries()].map(([k, v]) => ({ label: k, value: v, color: getTeamColor(k) }));
    items.sort((a, b) => b.value - a.value);
    return items;
  }

  async function withLimit(items, limit, worker) {
    const out = new Array(items.length);
    let i = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx], idx);
      }
    });
    await Promise.all(runners);
    return out;
  }
})();

