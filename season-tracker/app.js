/* eslint-disable no-use-before-define */
(() => {
  const SEASON_CURRENT = 2025;
  const CACHE_PREFIX = `f1_season_${SEASON_CURRENT}_`;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    pillNextRace: $('#pillNextRace'),
    pillLabel: $('#pillNextRace .pill__label'),
    heroPulseLabel: $('#heroPulseLabel'),
    liveBadge: $('#liveBadge'),
    liveStatus: $('#liveStatus'),
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

  const state = {
    year: SEASON_CURRENT,
    countdownTimer: null,
    livePollTimer: null,
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
  };

  init().catch((err) => {
    // keep UI silent; we must avoid console noise in prod
    renderPillError();
    renderEmpty();
    void err;
  });

  async function init() {
    bindUI();
    setupSectionIo();
    await warmSeason(SEASON_CURRENT);
    await warmHeadshotsFromOpenF1();
    await renderSeason(SEASON_CURRENT);
    await decideLiveAndStart();
    setupSnapshotLazyLoad();
  }

  /** OpenF1 `drivers` includes `headshot_url` (canonical). Spec `{year}/{DriverCode}.png` is used as a secondary try in `resolveHeadshotForCode`. */
  async function warmHeadshotsFromOpenF1() {
    const drivers = await fetchOpenF1Json('drivers', { session_key: 'latest' }).catch(() => []);
    if (!Array.isArray(drivers)) return;
    for (const d of drivers) {
      if (!d || typeof d !== 'object') continue;
      const code = String(d.name_acronym || d.code || '').trim().toUpperCase();
      if (!code) continue;
      const raw = d.headshot_url;
      if (typeof raw === 'string' && raw && raw !== 'null') {
        state.headshotByCode.set(code, sanitizeHeadshotUrl(raw));
      }
    }
  }

  /** Requested CDN shape: `{year}/{DriverCode}.png` (Formula 1 media; may 404 for some codes → initials). */
  function resolveSpecHeadshotUrl(code) {
    const c = encodeURIComponent(code);
    return `https://media.formula1.com/image/upload/f_auto,q_auto,w_132/v1740000001/fom-website/static-assets/drivers/${SEASON_CURRENT}/${c}.png`;
  }

  function sanitizeHeadshotUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const i = s.indexOf('.transform');
    return i >= 0 ? s.slice(0, i) : s;
  }

  /** Prefer OpenF1 map, then spec URL. */
  function resolveHeadshotForCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return '';
    const fromApi = state.headshotByCode.get(c);
    if (fromApi) return fromApi;
    return resolveSpecHeadshotUrl(c);
  }

  function makeAvatarEl(code, nameFallback, preferUrl) {
    const wrap = document.createElement('span');
    wrap.className = 'avatar';
    const url = (typeof preferUrl === 'string' && preferUrl ? preferUrl : '') || resolveHeadshotForCode(code);
    if (url && url.length > 10) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      img.onload = () => wrap.classList.add('is-loaded');
      img.onerror = () => {
        wrap.replaceChildren();
        wrap.classList.add('avatar--fallback');
        wrap.textContent = initialsFrom(nameFallback || code);
      };
      wrap.appendChild(img);
    } else {
      wrap.classList.add('avatar--fallback');
      wrap.textContent = initialsFrom(nameFallback || code);
    }
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
      if (document.hidden) stopLivePolling();
      else if (state.live) startLivePolling();
    });

    // calendar keyboard navigation
    el.calendarRail.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const dx = e.key === 'ArrowRight' ? 320 : -320;
      el.calendarRail.scrollBy({ left: dx, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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
      });
    });

    // modal close
    el.modal.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.dataset.close === 'true') closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.modal.getAttribute('aria-hidden') === 'false') closeModal();
    });
  }

  async function warmSeason(year) {
    // only pre-warm 2025 on load as requested; historical years lazily on demand
    if (year !== SEASON_CURRENT) return;
    const [drivers, constructors, calendar] = await Promise.all([
      cachedSeasonJson(`${CACHE_PREFIX}driverStandings`, () => fetchErgastJson(`${year}/driverStandings.json`)),
      cachedSeasonJson(`${CACHE_PREFIX}constructorStandings`, () => fetchErgastJson(`${year}/constructorStandings.json`)),
      cachedSeasonJson(`${CACHE_PREFIX}calendar`, () => fetchErgastJson(`${year}.json`)),
    ]);
    state.standings = drivers;
    state.constructors = constructors;
    state.calendar = extractCalendar(calendar);
  }

  async function renderSeason(year) {
    el.tagSeason.textContent = `Season ${year}`;

    const driversJson =
      state.standings || (await cachedSeasonJson(`f1_season_${year}_driverStandings`, () => fetchErgastJson(`${year}/driverStandings.json`)));
    const constructorsJson =
      state.constructors ||
      (await cachedSeasonJson(
        `f1_season_${year}_constructorStandings`,
        () => fetchErgastJson(`${year}/constructorStandings.json`),
      ));
    const calendarJson =
      state.calendar.length
        ? null
        : await cachedSeasonJson(`f1_season_${year}_calendar`, () => fetchErgastJson(`${year}.json`));

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
      cachedSeasonJson(`f1_season_${year}_driverStandings`, () => fetchErgastJson(`${year}/driverStandings.json`)),
      cachedSeasonJson(`f1_season_${year}_constructorStandings`, () => fetchErgastJson(`${year}/constructorStandings.json`)),
    ]);

    const driverStandings = extractDriverStandings(driversJson);
    const constructorStandings = extractConstructorStandings(constructorsJson);

    renderHistory(driverStandings, constructorStandings, year);
    el.histHint.textContent = `Final standings (${year}).`;
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
    el.heroLeaderSub.textContent = leader ? `${leaderTeam} • ${leader.code}` : '—';
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
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.tilt = 'true';
      card.style.setProperty('--accent', teamColor);
      card.innerHTML = `
        <div class="card__top">
          <div class="card__pos">P${idx + 1}</div>
          <div class="card__pts">${d.points} pts</div>
        </div>
        <div class="card__mid">
          <span class="card__avatarSlot" data-avatar-slot="1"></span>
          <div>
            <div class="card__code">${escapeHtml(d.code)}</div>
            <div class="card__name">${escapeHtml(d.givenName)} ${escapeHtml(d.familyName)}</div>
          </div>
        </div>
        <div class="card__team">
          <span class="chip" style="background:${teamColor}"></span>
          <span>${escapeHtml(d.constructorName)}</span>
        </div>
      `;
      const slot = card.querySelector('[data-avatar-slot]');
      if (slot) slot.replaceWith(makeAvatarEl(d.code, `${d.givenName} ${d.familyName}`));
      card.addEventListener('click', () => setAccent(teamColor));
      el.top3Cards.appendChild(card);
    });

    bindTilt();
    // default accent to leader team color (but allow user override later)
    if (leader?.constructorName) setAccent(getTeamColor(leader.constructorName), { soft: true });

    // next race pill data
    state.nextRace = pickNextRace(calendar);
    updatePillForNextRace(state.nextRace);
  }

  function renderHistory(driverStandings, constructorStandings, year) {
    el.historyDrivers.innerHTML = '';
    el.historyConstructors.innerHTML = '';
    const champ = driverStandings[0];
    const champTeamColor = champ ? getTeamColor(champ.constructorName) : getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (champ) setAccent(champTeamColor, { soft: true });

    driverStandings.forEach((d) => {
      el.historyDrivers.appendChild(makeTowerRowStatic(d));
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
      : `<div class="small muted">No data.</div>`;
    const aSlot = el.champCard.querySelector('[data-champ-avatar]');
    if (champ && aSlot)
      aSlot.replaceWith(makeAvatarEl(champ.code, `${champ.givenName} ${champ.familyName}`));
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
  }

  function renderCalendar(calendar) {
    el.calendarRail.innerHTML = '';
    const now = new Date();
    const next = pickNextRace(calendar);
    calendar.forEach((r) => {
      const done = isRaceDone(r, now);
      const card = document.createElement('div');
      card.className = `raceCard${done ? ' is-done' : ''}${next && next.round === r.round ? ' is-next' : ''}`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${r.raceName} details`);
      card.innerHTML = `
        <div class="raceTop">
          <div class="raceRound">Round ${escapeHtml(String(r.round))}</div>
          <div class="raceFlag" aria-hidden="true">${escapeHtml(flagEmojiFromCountry(r.country))}</div>
        </div>
        <div class="raceName">${escapeHtml(r.raceName)}</div>
        <div class="raceMeta">
          <div>${escapeHtml(r.circuitName)}</div>
          <div>${escapeHtml(formatDate(r.date))}</div>
        </div>
        <div class="winnerChip" data-winner hidden></div>
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
      const k = `f1_season_${race.season}_round_${race.round}_result`;
      const data = await cachedSeasonJson(k, () => fetchErgastJson(`${race.season}/${race.round}/results/1.json`));
      const win = extractRaceWinner(data);
      if (!win) return;
      chip.hidden = false;
      chip.textContent = `Winner: ${win.code || win.name}`;
    } catch {
      // ignore
    }
  }

  function renderPillError() {
    if (!el.pillLabel) return;
    el.pillLabel.textContent = 'Next race unavailable';
  }

  function renderEmpty() {
    el.liveStatus.textContent = 'Data unavailable.';
  }

  function updatePillForNextRace(nextRace) {
    if (!el.pillNextRace || !el.pillLabel) return;
    if (!nextRace) {
      el.pillLabel.textContent = 'Season loaded';
      return;
    }
    el.pillLabel.innerHTML = `<span>Next:</span> <strong>${escapeHtml(nextRace.raceName)}</strong> <span id="countdown">—</span>`;
    el.pillNextRace.onclick = () => document.querySelector('#calendar')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    startCountdown(nextRace);
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
    // Live session detection (best-effort): if latest session is currently running (now between start/end), treat as live.
    const sessions = await fetchOpenF1Json('sessions', { session_key: 'latest' }).catch(() => []);
    const live = isSessionLive(sessions);
    state.live = live;
    if (live) {
      el.liveTowerPanel?.classList.add('tower--live');
      el.heroPulseLabel?.classList.add('is-live');
      if (el.heroPulseLabel) el.heroPulseLabel.textContent = 'Live session';
      el.liveBadge.hidden = false;
      el.liveStatus.textContent = 'Live session detected. Polling every 5s.';
      el.towerTitle.textContent = 'Timing Tower';
      el.towerHint.textContent = 'Live format (best-effort).';
      setPillLive();
      startLivePolling();
    } else {
      el.liveTowerPanel?.classList.remove('tower--live');
      el.heroPulseLabel?.classList.remove('is-live');
      if (el.heroPulseLabel) el.heroPulseLabel.textContent = 'Championship leader';
      el.liveBadge.hidden = true;
      el.liveStatus.textContent = 'Not live right now. Showing standings.';
      stopLivePolling();
    }
  }

  function setPillLive() {
    if (!el.pillLabel) return;
    el.pillLabel.innerHTML = `<span class="liveDot" aria-hidden="true"></span><strong>LIVE</strong><span> • click to jump</span>`;
    el.pillNextRace.onclick = scrollToLive;
  }

  function isSessionLive(sessionsJson) {
    if (!Array.isArray(sessionsJson) || sessionsJson.length === 0) return false;
    const now = Date.now();
    const s = sessionsJson[0] || sessionsJson[sessionsJson.length - 1];
    const start = Date.parse(s.date_start || s.session_start || s.date || '');
    const end = Date.parse(s.date_end || s.session_end || '');
    if (Number.isFinite(start) && Number.isFinite(end)) return now >= start && now <= end;
    if (Number.isFinite(start) && !Number.isFinite(end)) return now >= start && now - start < 6 * 60 * 60 * 1000;
    // fallback: OpenF1 live heuristic is implemented at API layer; here we keep conservative
    return false;
  }

  function startLivePolling() {
    stopLivePolling();
    const tick = () => void pollLive();
    tick();
    state.livePollTimer = window.setInterval(tick, 5000);
  }

  function stopLivePolling() {
    if (state.livePollTimer) window.clearInterval(state.livePollTimer);
    state.livePollTimer = null;
  }

  async function pollLive() {
    // fetch in parallel; each may fail independently
    const [drivers, positions, intervals, stints, pits, carData, laps, raceControl] = await Promise.all([
      fetchOpenF1Json('drivers', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('position', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('intervals', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('stints', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('pit', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('car_data', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('laps', { session_key: 'latest' }).catch(() => []),
      fetchOpenF1Json('race_control', { session_key: 'latest' }).catch(() => []),
    ]);

    buildDriverMeta(drivers);
    const towerRows = buildTimingTower(positions, intervals, stints, pits, carData, laps);
    renderTowerLive(towerRows);
    renderRaceControl(raceControl);
    renderLapCounter(laps);
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
        headshotUrl = sanitizeHeadshotUrl(rawHs);
        if (code) state.headshotByCode.set(code, headshotUrl);
      } else if (code) {
        headshotUrl = resolveHeadshotForCode(code);
      }
      state.driverMetaByNumber.set(number, { code, name, team, headshotUrl });
    }
  }

  function buildTimingTower(positions, intervals, stints, pits, carData, laps) {
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

      list.push({
        driverNumber: dn,
        position: Number(p.position ?? p.pos ?? 999),
        code: meta.code || String(p.name_acronym || p.code || '').toUpperCase() || `#${dn}`,
        name: meta.name || '',
        team: meta.team || '',
        headshotUrl: meta.headshotUrl || resolveHeadshotForCode(meta.code || ''),
        teamColor: getTeamColor(meta.team),
        gapToLeader: formatGap(g.gap_to_leader ?? g.gap ?? ''),
        interval: formatGap(g.interval ?? g.interval_to_ahead ?? ''),
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
        <div class="timingPair">
          <div class="timingPair__k">Gap</div>
          <div class="timingPair__v">${escapeHtml(r.gapToLeader || '—')}</div>
          <div class="timingPair__k">Int</div>
          <div class="timingPair__v">${escapeHtml(r.interval || '—')}</div>
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
    el.modalKicker.textContent = `Round ${round} • ${season}`;
    el.modalTitle.textContent = race.raceName;
    el.modalFacts.innerHTML = `<div class="small muted">Loading…</div>`;
    el.modalImg.alt = `${race.circuitName}`;
    el.modalImg.src = '';
    setImgPlaceholder(el.modalImg, `${race.raceName}`);
    openModal();

    const [result1, qual1] = await Promise.all([
      fetchErgastJson(`${season}/${round}/results/1.json`).catch(() => null),
      fetchErgastJson(`${season}/${round}/qualifying/1.json`).catch(() => null),
    ]);

    const winner = extractRaceWinner(result1);
    const pole = extractPoleSitter(qual1);
    const fast = extractFastestLap(result1);

    const circuitSlug = slugifyCircuit(race.circuitName);
    await loadCircuitImage(el.modalImg, circuitSlug);

    el.modalFacts.innerHTML = `
      ${fact('Winner', winner?.name || '—')}
      ${fact('Pole', pole?.name || '—')}
      ${fact('Fastest lap', fast?.name ? `${fast.name}${fast.time ? ` • ${fast.time}` : ''}` : '—')}
      ${fact('Circuit', race.circuitName)}
      ${fact('Date', formatDate(race.date))}
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
    const calendarJson = await cachedSeasonJson(`${CACHE_PREFIX}calendar`, () => fetchErgastJson(`${SEASON_CURRENT}.json`));
    const calendar = extractCalendar(calendarJson);
    const now = new Date();
    const done = calendar.filter((r) => isRaceDone(r, now));

    await Promise.all([buildWinsAndClosest(done), buildTyreUsage(SEASON_CURRENT)]);
  }

  async function buildWinsAndClosest(doneRaces) {
    if (doneRaces.length === 0) {
      el.winsNote.textContent = 'No completed rounds yet.';
      el.closestNote.textContent = '';
      return;
    }

    const wins = new Map(); // constructor -> count
    let closest = null; // { raceName, margin, winner, runnerUp }

    const results = await withLimit(
      doneRaces,
      4,
      async (r) => cachedSeasonJson(`f1_season_${r.season}_round_${r.round}_top2`, () => fetchErgastJson(`${r.season}/${r.round}/results/2.json`)),
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

    renderBars(el.winsBars, winsToBars(wins), { valueFormatter: (v) => `${v}` });
    el.winsNote.textContent = `Computed from Ergast results (completed rounds).`;

    if (!closest) {
      el.closestCard.innerHTML = `<div class="editorialCard"><div class="editorialTitle">No margin data yet</div><div class="editorialMeta"><div>Some races report status instead of time gaps.</div></div></div>`;
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
      const sessions = await cachedSeasonJson(`f1_openf1_${year}_race_sessions`, () =>
        fetchOpenF1Json('sessions', { year: String(year), session_name: 'Race' }),
      );
      if (!Array.isArray(sessions) || sessions.length === 0) {
        el.tyreBars.innerHTML = '';
        el.tyreNote.textContent = 'Tyre breakdown unavailable (no OpenF1 race sessions found).';
        return;
      }
      // limit to first N to avoid excessive requests
      const sessionKeys = sessions
        .map((s) => s.session_key)
        .filter(Boolean)
        .slice(0, 18);

      const stints = await withLimit(
        sessionKeys,
        3,
        async (sk) => fetchOpenF1Json('stints', { session_key: String(sk) }).catch(() => []),
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
            <span>${escapeHtml(it.label)}</span>
            <span class="barValue">${escapeHtml(opts?.valueFormatter ? opts.valueFormatter(it.value) : String(it.value))}</span>
          </div>
          <div class="barTrack">
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

  function makeTowerRowStatic(d) {
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
    if (av) av.replaceWith(makeAvatarEl(d.code, `${d.givenName} ${d.familyName}`));
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
    void loadTeamLogoInto(li.querySelector('.logoMini'), title, c.constructorName);
    return li;
  }

  function wikiThumbFromQueryJson(j) {
    const pages = j?.query?.pages || {};
    const first = pages[Object.keys(pages)[0]];
    return first?.thumbnail?.source || '';
  }

  async function loadTeamLogoInto(container, wikiTitle, constructorName) {
    if (!(container instanceof HTMLElement) || !wikiTitle) return;
    container.innerHTML = '<span class="logoShimmer" aria-hidden="true"></span>';
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
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
        const url = `${host}/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=128&titles=${encodeURIComponent(title)}`;
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) continue;
        const j = await r.json();
        src = wikiThumbFromQueryJson(j);
        if (src) break;
      }
      if (src) {
        img.src = src;
        img.onload = () => {
          container.innerHTML = '';
          container.appendChild(img);
        };
        img.onerror = () => {
          container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
        };
      } else {
        container.innerHTML = `<span class="logoFallback" aria-hidden="true"></span>`;
      }
    } catch {
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
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Ergast fetch failed');
    return r.json();
  }

  async function fetchOpenF1Json(path, params) {
    const sp = new URLSearchParams({ path, ...params });
    const r = await fetch(`/api/f1-live?${sp.toString()}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('OpenF1 fetch failed');
    return r.json();
  }

  async function cachedSeasonJson(key, loader) {
    const fullKey = key;
    const raw = sessionStorage.getItem(fullKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        sessionStorage.removeItem(fullKey);
      }
    }
    const data = await loader();
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(data));
    } catch {
      // ignore quota
    }
    return data;
  }

  function extractDriverStandings(json) {
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
    const races = json?.MRData?.RaceTable?.Races || [];
    return races.map((r) => ({
      season: Number(r.season || SEASON_CURRENT),
      round: Number(r.round || 0),
      raceName: r.raceName || 'Grand Prix',
      date: r.date || '',
      time: r.time || '',
      country: r.Circuit?.Location?.country || '',
      circuitName: r.Circuit?.circuitName || '',
    }));
  }

  function pickNextRace(calendar) {
    const now = new Date();
    const future = calendar
      .map((r) => ({ r, t: Date.parse(`${r.date}T${r.time || '13:00:00Z'}`) }))
      .filter((x) => Number.isFinite(x.t) && x.t > now.getTime())
      .sort((a, b) => a.t - b.t);
    return future[0]?.r || null;
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
    const s = String(v ?? '').trim();
    if (!s) return '';
    return s.startsWith('+') ? s : `+${s}`;
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
    const initials = initialsFrom(label);
    if (!shell.querySelector('.initials')) {
      const node = document.createElement('div');
      node.className = 'initials';
      node.textContent = initials;
      shell.appendChild(node);
    }
    const shimmer = shell.querySelector('.shimmer');
    if (shimmer instanceof HTMLElement) shimmer.style.display = '';
  }

  async function loadCircuitImage(img, slug) {
    const base = `../circuits/${slug}`;
    const exts = ['.jpg', '.jpeg', '.png', '.webp'];
    for (const ext of exts) {
      const src = `${base}${ext}`;
      // try load
      const ok = await probeImage(src);
      if (ok) {
        await applyLoadedImage(img, src);
        return;
      }
    }
    // placeholder
    const shell = img.closest('.imgShell');
    if (shell) {
      const shimmer = shell.querySelector('.shimmer');
      if (shimmer instanceof HTMLElement) shimmer.style.display = 'none';
    }
  }

  function probeImage(src) {
    return new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(true);
      i.onerror = () => resolve(false);
      i.src = src;
    });
  }

  function applyLoadedImage(img, src) {
    return new Promise((resolve) => {
      img.onload = () => {
        const shell = img.closest('.imgShell');
        if (shell) {
          shell.querySelector('.shimmer')?.setAttribute('style', 'display:none');
          shell.querySelector('.initials')?.remove();
        }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = src;
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

