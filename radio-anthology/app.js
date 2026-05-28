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
   */

  /** @typedef {{ cover?: string, coverAlt?: string, coverCredit?: object, gallery?: Array<{src:string,alt?:string,layout?:string,credit?:object}> }} RadioImageMeta */

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
    },
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

  /** @type {Record<string, RadioImageMeta>} */
  let imageManifest = {};

  // ── AI asset helper ──────────────────────────────────────────────────────
  /** @param {'radio'|'team'|'circuit'|'driver'} type @param {string} entityId @returns {Promise<string|null>} */
  async function getAIAsset(type, entityId) {
    const cacheKey = `asset_${type}_${entityId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch { /* ignore */ }
    try {
      const res = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, entityId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const url = typeof data?.url === 'string' ? data.url : null;
      if (url && !url.startsWith('/images/placeholders/')) {
        try { sessionStorage.setItem(cacheKey, url); } catch { /* ignore */ }
        return url;
      }
      return null;
    } catch {
      return null;
    }
  }

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
  function defaultCoverAlt(entry) {
    return `${entry.driver}, ${entry.gp_name} ${entry.year}`;
  }

  /** @param {RadioEntry} entry */
  function imagesForEntry(entry) {
    return imageManifest[entry.id] || imageManifest[entry.id.toLowerCase()] || null;
  }

  /** @param {RadioEntry} entry */
  function coverSpec(entry) {
    const meta = imagesForEntry(entry);
    if (meta?.cover) {
      return {
        src: meta.cover,
        alt: meta.coverAlt || defaultCoverAlt(entry),
        credit: meta.coverCredit,
      };
    }
    return null;
  }

  /** @param {object} [credit] */
  function formatCredit(credit) {
    if (!credit || typeof credit !== 'object') return '';
    if (credit.note) return escapeHtml(credit.note);
    const parts = [];
    if (credit.author) parts.push(escapeHtml(credit.author));
    if (credit.license) parts.push(escapeHtml(credit.license));
    const body = parts.join(' · ');
    if (credit.page) {
      return `${body} · <a href="${escapeHtml(credit.page)}" rel="license noopener noreferrer" target="_blank">Source</a>`;
    }
    return body;
  }

  /**
   * @param {HTMLElement} host
   * @param {HTMLImageElement} img
   * @param {HTMLElement | null} placeholder
   * @param {RadioEntry} entry
   * @param {'lazy'|'eager'} loading
   */
  async function applyCover(host, img, placeholder, entry, loading = 'lazy') {
    const spec = coverSpec(entry);

    const applyUrl = (url, alt) => {
      img.alt = alt || '';
      img.loading = loading;
      img.decoding = loading === 'eager' ? 'sync' : 'async';
      const onOk = () => {
        img.classList.add('is-loaded');
        host.classList.add('has-photo');
        if (placeholder) placeholder.hidden = true;
      };
      const onFail = () => {
        host.classList.add('is-cover-fallback');
        img.classList.remove('is-loaded');
        if (placeholder) placeholder.hidden = false;
      };
      img.addEventListener('load', onOk, { once: true });
      img.addEventListener('error', onFail, { once: true });
      if (img.src !== url) img.src = url;
      else if (img.complete && img.naturalWidth > 0) onOk();
    };

    if (spec?.src) {
      applyUrl(spec.src, spec.alt);
      return;
    }

    const aiUrl = await getAIAsset('radio', entry.constructorId || entry.id);
    if (aiUrl) {
      applyUrl(aiUrl, entry.driver ? `${entry.driver} — ${entry.gp_name}` : '');
      return;
    }

    host.classList.add('is-cover-fallback');
    if (placeholder) placeholder.hidden = false;
  }

  /** @param {RadioEntry} entry */
  function renderGallery(entry) {
    const meta = imagesForEntry(entry);
    const items = meta?.gallery || [];
    if (!items.length) return '';

    const cells = items
      .map((item) => {
        const layout = item.layout || 'landscape';
        const credit = formatCredit(item.credit);
        const creditBlock = credit
          ? `<figcaption class="detailGallery__credit font-mono">${credit}</figcaption>`
          : '';
        return `<figure class="detailGallery__item detailGallery__item--${escapeHtml(layout)}">
          <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || defaultCoverAlt(entry))}" loading="lazy" decoding="async" />
          ${creditBlock}
        </figure>`;
      })
      .join('');

    return `<section class="detailGallery" aria-labelledby="galleryTitle">
      <div class="detailDivider" aria-hidden="true"><span>03</span></div>
      <h2 class="detailSection__title" id="galleryTitle">Gallery</h2>
      <div class="detailGallery__grid">${cells}</div>
    </section>`;
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

  const state = {
    coverObserver: /** @type {IntersectionObserver | null} */ (null),
  };

  const el = {
    viewIndex: $('#viewIndex'),
    viewDetail: $('#viewDetail'),
    detailArticle: $('#detailArticle'),
    topbarMoments: /** @type {HTMLAnchorElement} */ ($('#topbarMoments')),
    cardGrid: $('#cardGrid'),
    archiveCount: $('#archiveCount'),
  };

  function ensureCoverObserver() {
    if (state.coverObserver) return;
    state.coverObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const card = e.target;
          if (!(card instanceof HTMLElement)) continue;
          if (card.dataset.coverReady === '1') continue;
          card.dataset.coverReady = '1';
          state.coverObserver?.unobserve(card);
          const id = card.getAttribute('data-id') || '';
          const entry = byId.get(String(id).toLowerCase());
          if (!entry) continue;
          const img = card.querySelector('img.radioCard__photo');
          const placeholder = card.querySelector('.radioCard__placeholder');
          if (img instanceof HTMLImageElement) applyCover(card, img, placeholder, entry, 'lazy');
        }
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    );
  }

  function renderCards() {
    const list = RADIO_ARCHIVE;
    if (el.archiveCount) {
      el.archiveCount.textContent = `${list.length} moments in the archive`;
    }

    const frag = document.createDocumentFragment();
    list.forEach((entry, idx) => {
      const col = teamColor(entry.constructorId);
      const chips = entry.tags
        .slice(0, 5)
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join('');
      const rec = String(idx + 1).padStart(2, '0');
      const slug = archivalSlug(entry.id);

      const a = document.createElement('a');
      a.className = 'radioCard cine-hover-lift';
      a.href = `#${encodeURIComponent(entry.id)}`;
      a.setAttribute('data-id', entry.id);
      a.dataset.coverReady = '0';
      a.setAttribute('aria-label', `${entry.quote} — ${entry.driver}, ${entry.gp_name} ${entry.year}`);
      a.style.setProperty('--team', col);
      a.innerHTML = `
        <div class="radioCard__cover" aria-hidden="true">
          <img class="radioCard__photo" alt="" width="640" height="400" />
          <div class="radioCard__placeholder" aria-hidden="true"></div>
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
    ensureCoverObserver();
    $$('.radioCard[data-id]', el.cardGrid).forEach((card) => {
      if (card instanceof HTMLElement) state.coverObserver?.observe(card);
    });
  }

  /** @param {'index'|'detail'} mode */
  function setView(mode) {
    const isDetail = mode === 'detail';
    if (el.viewIndex) el.viewIndex.hidden = isDetail;
    if (el.viewDetail) el.viewDetail.hidden = !isDetail;
    if (el.topbarMoments) el.topbarMoments.hidden = !isDetail;
    document.body.classList.toggle('is-detail', isDetail);
    document.body.classList.toggle('is-index', !isDetail);
  }

  /** @param {RadioEntry} entry */
  function renderDetail(entry) {
    const art = el.detailArticle;
    if (!art) return;

    const col = teamColor(entry.constructorId);
    document.title = `${entry.quote} • Radio Anthology`;
    art.style.setProperty('--team', col);
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
    const galleryBlock = renderGallery(entry);
    const cover = coverSpec(entry);
    const coverCredit = formatCredit(cover?.credit);

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
    <img class="detailHero__cover" alt="" width="1920" height="1080" />
    <div class="detailHero__placeholder" aria-hidden="true"></div>
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
    ${coverCredit ? `<p class="detailHero__credit font-mono">${coverCredit}</p>` : ''}
  </div>
</section>

<div class="detailSpread">
  <div class="detailSpread__grid">
    <aside class="detailAside panel panel--glass cine-glass cine-sticky-aside">
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

      ${galleryBlock}
      ${storyBlock}
      ${audio}
    </div>
  </div>
</div>`;

    const hero = art.querySelector('.detailHero');
    const coverImg = art.querySelector('img.detailHero__cover');
    const placeholder = art.querySelector('.detailHero__placeholder');
    if (hero instanceof HTMLElement && coverImg instanceof HTMLImageElement) {
      applyCover(hero, coverImg, placeholder, entry, 'eager');
    }
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
    window.AnthologyCinematic?.refresh?.();
    scrollTop();
  }

  function wireEvents() {
    window.addEventListener('hashchange', onRoute);

    document.body.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const back = t.closest('a[href="#"]');
      if (!(back instanceof HTMLAnchorElement)) return;
      const inDetail = back.id === 'topbarMoments';
      if (!inDetail) return;
      e.preventDefault();
      clearHash();
      onRoute();
    });
  }

  async function loadImageManifest() {
    try {
      const r = await fetch('/data/radio-images.json', { cache: 'default' });
      if (!r.ok) return;
      const j = await r.json();
      imageManifest = j?.episodes && typeof j.episodes === 'object' ? j.episodes : {};
    } catch {
      imageManifest = {};
    }
  }

  async function init() {
    await loadImageManifest();
    renderCards();
    wireEvents();
    onRoute();
  }

  init();
})();
