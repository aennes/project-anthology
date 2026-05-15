(() => {
  'use strict';

  /**
   * @typedef {Object} RadioEntry
   * @property {string} id
   * @property {number} year
   * @property {number} round
   * @property {string} gp_name
   * @property {string} driver
   * @property {string} team
   * @property {string} constructorId
   * @property {string} quote
   * @property {string} context
   * @property {string} significance
   * @property {string[]} tags
   * @property {string} [audio_url]
   * @property {string} [related_story_id]
   * @property {string} [circuit_svg]
   * @property {string} [pull_secondary]
   */

  /** @type {RadioEntry[]} */
  const RADIO_ARCHIVE = [
    {
      id: 'multi-21-malaysia-2013',
      year: 2013,
      round: 2,
      gp_name: 'Malaysian Grand Prix',
      driver: 'Sebastian Vettel',
      team: 'Red Bull Racing',
      constructorId: 'red_bull',
      quote: 'Multi 21, Seb.',
      context:
        'With both cars on soft tyres in the closing laps, the pit wall reminded Vettel of the pre-race code “Multi 21” — car 2 ahead of car 1 on a controlled finish.',
      significance:
        'Vettel passed Webber anyway, detonating trust inside the garage and becoming shorthand for broken team orders in the modern era.',
      tags: ['team-orders', 'red-bull', '2010s', 'championship'],
      circuit_svg: 'bahrain.svg',
    },
    {
      id: 'webber-unbelievable-china-2013',
      year: 2013,
      round: 3,
      gp_name: 'Chinese Grand Prix',
      driver: 'Mark Webber',
      team: 'Red Bull Racing',
      constructorId: 'red_bull',
      quote: 'Unbelievable, guys… unbelievable.',
      context:
        'After a chaotic sequence in the garage and a mis-timed final stop, Webber rejoined out of position and vented on the radio with dry, exhausted disbelief.',
      significance:
        'The line captured the feeling of a driver who believed the machinery and strategy were fighting him as much as the field.',
      tags: ['strategy', 'red-bull', '2010s', 'frustration'],
      circuit_svg: 'shanghai.svg',
    },
    {
      id: 'vettel-brazil-2012-retire-debate',
      year: 2012,
      round: 20,
      gp_name: 'Brazilian Grand Prix',
      driver: 'Sebastian Vettel',
      team: 'Red Bull Racing',
      constructorId: 'red_bull',
      quote: 'No, no, no — I can keep going.',
      context:
        'In a rain-hit title decider with visible damage, the pit wall feared terminal failure while Vettel argued to stay in the race and keep fighting through the spray.',
      significance:
        'The exchange framed how much a champion is willing to risk when a crown is one corner away — and how calm the cockpit must sound even when the car is not.',
      tags: ['brazil', 'red-bull', '2010s', 'championship', 'pressure'],
      circuit_svg: 'interlagos.svg',
    },
    {
      id: 'raikkonen-leave-me-alone-india-2012',
      year: 2012,
      round: 17,
      gp_name: 'Indian Grand Prix',
      driver: 'Kimi Räikkönen',
      team: 'Lotus F1 Team',
      constructorId: 'lotus_f1',
      quote: 'Just leave me alone — I know what to do.',
      context:
        'Race engineer Simon Rennie offered encouragement and gap information while Räikkönen was managing tyres on his way to the podium.',
      significance:
        'It became the meme-friendly distillation of Kimi’s persona: minimal words, maximum autonomy, and a refusal to dramatise the job.',
      tags: ['lotus', '2010s', 'comedy', 'cool'],
      pull_secondary: 'Yeah, yeah, yeah, yeah — I’m okay.',
    },
    {
      id: 'hamilton-bwoah-germany-2017',
      year: 2017,
      round: 11,
      gp_name: 'German Grand Prix',
      driver: 'Lewis Hamilton',
      team: 'Mercedes',
      constructorId: 'mercedes',
      quote: 'Bwoah… I mean, it’s the same for everyone, I guess.',
      context:
        'Asked in a post-session interview how tricky the conditions felt, Hamilton answered with the now-famous elongated “bwoah” and a shrug toward fairness.',
      significance:
        'The delivery turned into a cultural fingerprint for the sport on the internet — proof that tone matters as much as words in how fans remember a moment.',
      tags: ['interview', 'meme', '2010s', 'weather'],
      related_story_id: 'hamilton-silverstone',
      circuit_svg: 'catalunya.svg',
    },
    {
      id: 'sainz-smooth-operator-australia-2024',
      year: 2024,
      round: 3,
      gp_name: 'Australian Grand Prix',
      driver: 'Carlos Sainz',
      team: 'Ferrari',
      constructorId: 'ferrari',
      quote: 'Smooth operator — copy that.',
      context:
        'Days after appendix surgery, Sainz took the win in Melbourne; the engineer’s “smooth operator” call-back landed as both joke and genuine admiration.',
      significance:
        'A rare radio snapshot where the story off the track (recovery) and the story on it (racecraft) lined up in one sentence.',
      tags: ['ferrari', '2024', 'comeback', 'celebration'],
      circuit_svg: 'albert_park.svg',
    },
    {
      id: 'alonso-gp2-engine-hungary-2015',
      year: 2015,
      round: 10,
      gp_name: 'Hungarian Grand Prix',
      driver: 'Fernando Alonso',
      team: 'McLaren',
      constructorId: 'mclaren',
      quote: 'GP2 engine! GP2 — argh!',
      context:
        'Chasing a Toro Rosso on the main straight, Alonso’s Honda-powered McLaren was helplessly out-dragged; the exasperated cry was aimed at the power unit, not the category itself.',
      significance:
        'It distilled a painful era into one viral phrase — frustration so pure it became dark comedy for anyone who lived through McLaren-Honda.',
      tags: ['mclaren', '2010s', 'frustration', 'meme', 'honda'],
      circuit_svg: 'hungaroring.svg',
    },
    {
      id: 'norris-last-lap-austria-2020',
      year: 2020,
      round: 9,
      gp_name: 'Styrian Grand Prix',
      driver: 'Lando Norris',
      team: 'McLaren',
      constructorId: 'mclaren',
      quote: 'Last lap! Push like never before!',
      context:
        'On the final tour at the Red Bull Ring, Norris needed to claw time from the cars ahead for his breakthrough podium; the engineer’s urgency matched the lap that changed his career.',
      significance:
        'The shout became the soundtrack to Norris’s first F1 rostrum — youthful hunger meeting a team that finally believed in the result.',
      tags: ['mclaren', '2021now', 'pressure', 'celebration'],
      circuit_svg: 'red_bull_ring.svg',
    },
    {
      id: 'ricciardo-honda-looks-great-japan-2019',
      year: 2019,
      round: 17,
      gp_name: 'Japanese Grand Prix',
      driver: 'Daniel Ricciardo',
      team: 'Renault',
      constructorId: 'renault',
      quote: 'Honda looks great, doesn’t it?',
      context:
        'Ricciardo was stuck behind Hamilton, who was limping on a failing Mercedes power unit; the sarcastic radio quip mocked the rival PU while Renault fought for position.',
      significance:
        'Peak Ricciardo wit — turning another team’s misery into a punchline without ever raising his voice in the cockpit.',
      tags: ['renault', '2010s', 'comedy', 'sarcasm'],
      circuit_svg: 'suzuka.svg',
    },
    {
      id: 'verstappen-simply-lovely-baku-2018',
      year: 2018,
      round: 4,
      gp_name: 'Azerbaijan Grand Prix',
      driver: 'Max Verstappen',
      team: 'Red Bull Racing',
      constructorId: 'red_bull',
      quote: 'Simply lovely — that was lovely.',
      context:
        'After a scrappy qualifying session on the Baku street circuit, Verstappen delivered the line with theatrical calm, as if the chaos had been choreographed.',
      significance:
        'It showed how early Max could weaponise understatement — comedy as pressure release on a weekend that rarely offers peace.',
      tags: ['red-bull', '2010s', 'comedy', 'qualifying'],
      circuit_svg: 'baku.svg',
    },
    {
      id: 'button-is-it-a-bird-monaco-2009',
      year: 2009,
      round: 6,
      gp_name: 'Monaco Grand Prix',
      driver: 'Jenson Button',
      team: 'Brawn GP',
      constructorId: 'brawn',
      quote: 'Is it a bird? Is it a plane? No — it’s Super Jenson!',
      context:
        'On a flying qualifying lap at Monaco, Button’s engineer riffed on the superhero line as the Brawn carved through the cliff faces — the car and the joke both untouchable that weekend.',
      significance:
        'A rare moment where radio joy matched fairytale results — Brawn’s miracle year finding its voice on the most romantic lap in the sport.',
      tags: ['2000s', 'comedy', 'qualifying', 'championship'],
      related_story_id: 'brawn-2009',
      circuit_svg: 'monaco.svg',
    },
    {
      id: 'leclerc-i-am-stupid-monza-2019',
      year: 2019,
      round: 14,
      gp_name: 'Italian Grand Prix',
      driver: 'Charles Leclerc',
      team: 'Ferrari',
      constructorId: 'ferrari',
      quote: 'I am stupid.',
      context:
        'Leclerc spun at Parabolica during qualifying at Ferrari’s home race; the blunt self-assessment on team radio was as immediate as the mistake.',
      significance:
        'Fans embraced the honesty — a star driver owning a error without deflection, in a sport that usually speaks in engineering euphemisms.',
      tags: ['ferrari', '2010s', 'pressure', 'meme'],
      circuit_svg: 'monza.svg',
    },
    {
      id: 'grosjean-no-push-bahrain-2020',
      year: 2020,
      round: 15,
      gp_name: 'Bahrain Grand Prix',
      driver: 'Romain Grosjean',
      team: 'Haas F1 Team',
      constructorId: 'haas',
      quote: 'No, no, don’t push — I’m in the barrier, I’m in the barrier!',
      context:
        'After a terrifying Turn 3 fireball, Grosjean’s first instinct was to stop anyone from shoving the car while he was still inside the survival cell.',
      significance:
        'The line marked the split second between violence and clarity — radio as lifeline, not theatre, on a day the sport will never forget.',
      tags: ['2021now', 'safety', 'pressure'],
      circuit_svg: 'bahrain.svg',
    },
    {
      id: 'verstappen-mate-celebration-brazil-2016',
      year: 2016,
      round: 20,
      gp_name: 'Brazilian Grand Prix',
      driver: 'Max Verstappen',
      team: 'Red Bull Racing',
      constructorId: 'red_bull',
      quote: 'Mate, you’ve had the biggest celebration already — you’ve had a great season.',
      context:
        'Verstappen tried to thank the team after a wet masterclass at Interlagos; the engineer cut through the sentiment with a joke about Ricciardo’s earlier podium antics.',
      significance:
        'Proof that Red Bull’s radio culture runs on banter even in history-making drives — youth, rain, and laughter in one package.',
      tags: ['red-bull', '2010s', 'comedy', 'brazil', 'rain'],
      circuit_svg: 'interlagos.svg',
    },
  ];

  const CIRCUIT_TEXTURES = [
    'monaco.svg',
    'silverstone.svg',
    'spa.svg',
    'suzuka.svg',
    'imola.svg',
    'interlagos.svg',
    'catalunya.svg',
    'bahrain.svg',
  ];

  const TEAM_HEX = {
    red_bull: '#3671C6',
    ferrari: '#E8002D',
    mercedes: '#27F4D2',
    mclaren: '#FF8700',
    lotus_f1: '#C8A000',
    renault: '#FFF500',
    brawn: '#7DC242',
    haas: '#B6BABD',
    williams: '#005AFF',
    default: '#ff1801',
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const byId = new Map(RADIO_ARCHIVE.map((e) => [e.id.toLowerCase(), e]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** @param {string} s */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** @param {RadioEntry} entry */
  function circuitTextureUrl(entry) {
    if (entry.circuit_svg) return `/circuits/${entry.circuit_svg}`;
    let h = 0;
    const id = String(entry.id || '');
    for (let i = 0; i < id.length; i++) {
      h = (h + id.charCodeAt(i) * (i + 1)) % 10007;
    }
    return `/circuits/${CIRCUIT_TEXTURES[h % CIRCUIT_TEXTURES.length]}`;
  }

  function teamColor(constructorId) {
    const k = String(constructorId || '').toLowerCase();
    return TEAM_HEX[k] || TEAM_HEX.default;
  }

  /** @param {string} id */
  function archivalSlug(id) {
    return String(id || '')
      .replace(/-/g, ' ')
      .toUpperCase()
      .slice(0, 18);
  }

  /** @param {number} year */
  function eraOfYear(year) {
    if (year >= 2000 && year <= 2009) return '2000s';
    if (year >= 2010 && year <= 2019) return '2010s';
    if (year >= 2021) return '2021now';
    return 'other';
  }

  const state = {
    tag: 'all',
    driver: 'all',
    era: 'all',
  };

  const el = {
    viewIndex: $('#viewIndex'),
    viewDetail: $('#viewDetail'),
    detailArticle: $('#detailArticle'),
    detailBack: /** @type {HTMLAnchorElement} */ ($('#detailBack')),
    topbarMoments: /** @type {HTMLAnchorElement} */ ($('#topbarMoments')),
    filterTag: /** @type {HTMLSelectElement} */ ($('#filterTag')),
    filterDriver: /** @type {HTMLSelectElement} */ ($('#filterDriver')),
    eraButtons: $$('.seg__btn[data-era]'),
    filterCount: $('#filterCount'),
    cardGrid: $('#cardGrid'),
    emptyState: $('#emptyState'),
  };

  function allTags() {
    const set = new Set();
    RADIO_ARCHIVE.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function allDrivers() {
    const set = new Set();
    RADIO_ARCHIVE.forEach((e) => set.add(e.driver));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function filtered() {
    return RADIO_ARCHIVE.filter((e) => {
      if (state.tag !== 'all' && !e.tags.includes(state.tag)) return false;
      if (state.driver !== 'all' && e.driver !== state.driver) return false;
      if (state.era !== 'all' && eraOfYear(e.year) !== state.era) return false;
      return true;
    });
  }

  function fillSelects() {
    el.filterTag.innerHTML =
      `<option value="all">All tags</option>` +
      allTags().map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    el.filterDriver.innerHTML =
      `<option value="all">All drivers</option>` +
      allDrivers().map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  function setEraButtons() {
    el.eraButtons.forEach((btn) => {
      const era = btn.getAttribute('data-era');
      const on = era === state.era;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderCards() {
    const list = filtered();
    el.filterCount.textContent =
      list.length === RADIO_ARCHIVE.length
        ? `Showing all ${RADIO_ARCHIVE.length} moments`
        : `Showing ${list.length} of ${RADIO_ARCHIVE.length} moments`;

    if (list.length === 0) {
      el.cardGrid.replaceChildren();
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;

    const frag = document.createDocumentFragment();
    list.forEach((entry, idx) => {
      const col = teamColor(entry.constructorId);
      const cover = circuitTextureUrl(entry);
      const chips = entry.tags
        .slice(0, 5)
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join('');
      const rec = String(idx + 1).padStart(2, '0');
      const slug = archivalSlug(entry.id);

      const a = document.createElement('a');
      a.className = 'radioCard';
      a.href = `#${encodeURIComponent(entry.id)}`;
      a.setAttribute('data-id', entry.id);
      a.setAttribute('aria-label', `${entry.quote} — ${entry.driver}, ${entry.gp_name} ${entry.year}`);
      a.style.setProperty('--team', col);
      a.style.setProperty('--cover-img', `url("${cover}")`);

      a.innerHTML = `
        <div class="radioCard__cover" aria-hidden="true">
          <div class="radioCard__coverTint"></div>
          <div class="radioCard__vignette"></div>
          <div class="radioCard__scan"></div>
          <div class="radioCard__coverTop">
            <div class="radioCard__rec">
              <span class="radioCard__recDot"></span>
              <span class="radioCard__recLab">Rec_${rec}</span>
            </div>
            <span class="radioCard__slug">${escapeHtml(slug)}</span>
          </div>
        </div>
        <div class="radioCard__spread">
          <p class="radioCard__quote">${escapeHtml(entry.quote)}</p>
          <div class="radioCard__byline">
            <span class="radioCard__driver">${escapeHtml(entry.driver)}</span>
            <span class="radioCard__sep" aria-hidden="true">/</span>
            <span class="radioCard__team">${escapeHtml(entry.team)}</span>
          </div>
          <p class="radioCard__deck">${escapeHtml(entry.gp_name)} · ${escapeHtml(String(entry.year))}</p>
          <p class="radioCard__context">${escapeHtml(entry.context)}</p>
          <div class="radioCard__tags">${chips}</div>
        </div>
        <div class="radioCard__rail" aria-hidden="true"></div>
      `;
      frag.appendChild(a);
    });
    el.cardGrid.replaceChildren(frag);
  }

  /** @param {'index'|'detail'} mode */
  function setView(mode) {
    const isDetail = mode === 'detail';
    if (el.viewIndex) el.viewIndex.hidden = isDetail;
    if (el.viewDetail) el.viewDetail.hidden = !isDetail;
    if (el.topbarMoments) el.topbarMoments.hidden = !isDetail;
    document.body.classList.toggle('is-detail', isDetail);
  }

  /** @param {RadioEntry} entry */
  function renderDetail(entry) {
    const art = el.detailArticle;
    if (!art) return;

    const col = teamColor(entry.constructorId);
    const cover = circuitTextureUrl(entry);
    document.title = `${entry.quote} • Radio Anthology`;
    art.style.setProperty('--team', col);
    art.style.setProperty('--cover-img', `url("${cover}")`);
    document.body.style.setProperty('--team', col);

    const storyHref = entry.related_story_id
      ? `/story/${encodeURIComponent(entry.related_story_id)}`
      : null;
    const storyBlock = storyHref
      ? `<a class="detailStoryCta" href="${escapeHtml(storyHref)}">
          <span class="detailStoryCta__eyebrow">Continue in the archive</span>
          <span class="detailStoryCta__title">Open related Anthology story</span>
          <span class="detailStoryCta__slug">${escapeHtml(entry.related_story_id)}</span>
        </a>`
      : '';

    const secondaryQuote = entry.pull_secondary
      ? `<figure class="detailPull detailPull--secondary">
          <blockquote class="detailPull__text">“${escapeHtml(entry.pull_secondary)}”</blockquote>
          <figcaption class="detailPull__attr">${escapeHtml(entry.driver)}</figcaption>
        </figure>`
      : '';

    const tagChips = entry.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');

    const audio = entry.audio_url
      ? `<div class="audioShell">
          <p class="audioShell__label">Audio</p>
          <audio controls preload="none" src="${escapeHtml(entry.audio_url)}">
            Your browser does not support the audio element.
          </audio>
        </div>`
      : `<div class="audioShell audioShell--disabled" aria-disabled="true">
          <p class="audioShell__label">Audio</p>
          <p class="audioShell__hint">No clip URL configured for this entry yet.</p>
        </div>`;

    art.innerHTML = `
<section class="detailHero" aria-labelledby="detailQuote">
  <div class="detailHero__media" aria-hidden="true">
    <div class="detailHero__bg"></div>
    <img class="detailHero__circuit" src="${escapeHtml(cover)}" alt="" width="400" height="400" decoding="async" />
    <div class="detailHero__veil"></div>
  </div>
  <div class="detailHero__nav">
    <span class="detailHero__mono font-mono">Archival record · ${escapeHtml(String(entry.year))}</span>
    <span class="detailHero__id font-mono">${escapeHtml(entry.id.toUpperCase())}</span>
  </div>
  <div class="detailHero__copy">
    <div class="detailHero__badges">
      <span class="detailBadge">${escapeHtml(String(entry.year))}</span>
      <span class="detailBadge detailBadge--muted">Round ${escapeHtml(String(entry.round))}</span>
    </div>
    <h1 class="detailHero__gp">${escapeHtml(entry.gp_name)}</h1>
    <p class="detailHero__lead"><strong>${escapeHtml(entry.driver)}</strong> · ${escapeHtml(entry.team)}</p>
    <p class="detailMega" id="detailQuote">“${escapeHtml(entry.quote)}”</p>
  </div>
</section>

<div class="detailSpread">
  <div class="detailSpread__grid">
    <aside class="detailAside panel panel--glass">
      <span class="detailAside__seq font-mono">Sequence 01</span>
      <h2 class="detailAside__title">On the radio</h2>
      <div class="detailAside__rule" aria-hidden="true"></div>
      <dl class="detailMeta">
        <div><dt>Driver</dt><dd>${escapeHtml(entry.driver)}</dd></div>
        <div><dt>Team</dt><dd>${escapeHtml(entry.team)}</dd></div>
        <div><dt>Grand Prix</dt><dd>${escapeHtml(entry.gp_name)}</dd></div>
        <div><dt>Season</dt><dd>${escapeHtml(String(entry.year))}</dd></div>
      </dl>
      <div class="detailAside__tags">${tagChips}</div>
    </aside>

    <div class="detailBody">
      <section class="detailSection" aria-labelledby="ctxTitle">
        <div class="detailDivider" aria-hidden="true"><span>01</span></div>
        <h2 class="detailSection__title" id="ctxTitle">Context</h2>
        <p class="detailProse detailProse--lead">${escapeHtml(entry.context)}</p>
      </section>

      <figure class="detailPull">
        <blockquote class="detailPull__text">“${escapeHtml(entry.quote)}”</blockquote>
        <figcaption class="detailPull__attr">— ${escapeHtml(entry.driver)}, ${escapeHtml(entry.gp_name)}</figcaption>
      </figure>

      ${secondaryQuote}

      <section class="detailSection detailCallout" aria-labelledby="sigTitle">
        <div class="detailDivider" aria-hidden="true"><span>02</span></div>
        <h2 class="detailSection__title" id="sigTitle">Why it matters</h2>
        <p class="detailProse">${escapeHtml(entry.significance)}</p>
      </section>

      ${storyBlock}
      ${audio}
    </div>
  </div>
</div>

<p class="detailNavRow detailNavRow--inline">
  <a class="detailNav" href="#">← All moments</a>
</p>`;
  }

  function parseHash() {
    return (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
  }

  function clearHash() {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  function onRoute() {
    const slug = parseHash();
    if (!slug) {
      document.body.style.removeProperty('--team');
      setView('index');
      document.title = 'Radio Anthology • Project Anthology';
      $('#main')?.focus?.();
      scrollTop();
      return;
    }
    const entry = byId.get(slug);
    if (!entry) {
      document.body.style.removeProperty('--team');
      clearHash();
      setView('index');
      document.title = 'Radio Anthology • Project Anthology';
      $('#main')?.focus?.();
      scrollTop();
      return;
    }
    setView('detail');
    renderDetail(entry);
    scrollTop();
  }

  function wireEvents() {
    el.filterTag.addEventListener('change', () => {
      state.tag = el.filterTag.value;
      renderCards();
    });
    el.filterDriver.addEventListener('change', () => {
      state.driver = el.filterDriver.value;
      renderCards();
    });
    el.eraButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const era = btn.getAttribute('data-era');
        if (!era) return;
        state.era = era;
        setEraButtons();
        renderCards();
      });
    });

    window.addEventListener('hashchange', onRoute);

    document.body.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const back = t.closest('a[href="#"]');
      if (!(back instanceof HTMLAnchorElement)) return;
      const inDetail =
        Boolean(back.closest('#viewDetail')) ||
        back.id === 'topbarMoments' ||
        back.id === 'detailBack';
      if (!inDetail) return;
      e.preventDefault();
      clearHash();
      onRoute();
    });

    /* ESC: nav-shell closes drawer first, then clears hash detail (see /nav-shell.js). */
  }

  function init() {
    fillSelects();
    setEraButtons();
    renderCards();
    wireEvents();
    onRoute();
  }

  init();
})();
