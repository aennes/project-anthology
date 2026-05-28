(() => {
  'use strict';

  /** @typedef {{ circuitId?: string, name?: string, circuit_svg?: string }} CircuitCoverCtx */

  const CIRCUIT_ASSET_ALIASES = {
    las_vegas: ['vegas'],
    lasvegas: ['vegas'],
  };

  const SAFE_IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'res.cloudinary.com']);
  const WIKI_COVER_MISS_PREFIX = 'anthology_wiki_cover_miss_v2:';
  const WIKI_MAX_CONCURRENT = 2;
  const WIKI_GAP_MS = 300;
  const RASTER_EXTS = ['webp', 'jpg', 'png'];
  const CIRCUIT_ROOTS = ['/circuits/', '../circuits/'];

  let wikiInFlight = 0;
  let wikiNextAt = 0;
  /** @type {Array<{ task: () => Promise<unknown>, resolve: (v: unknown) => void, reject: (e: unknown) => void }>} */
  const wikiQueue = [];

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

  /** @param {CircuitCoverCtx} ctx */
  function buildCircuitBasenames(ctx) {
    const out = [];
    const seen = new Set();
    const push = (stem) => {
      const n = normalizeCircuitBasename(stem);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    };
    const id = ctx?.circuitId ? String(ctx.circuitId).trim().toLowerCase() : '';
    if (id) {
      push(id);
      const aliases = CIRCUIT_ASSET_ALIASES[id];
      if (aliases) for (const a of aliases) push(a);
    }
    if (ctx?.name) push(String(ctx.name).replace(/\s+/g, '_'));
    if (ctx?.circuit_svg) push(String(ctx.circuit_svg).replace(/\.svg$/i, ''));
    return out;
  }

  function isImageSrcAllowed(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return false;
    if (s.startsWith('//')) s = `https:${s}`;
    const lower = s.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
    if (s.startsWith('/')) {
      if (s.includes('..') || s.includes('\\') || s.includes('\0')) return false;
      return s.startsWith('/circuits/');
    }
    if (s.startsWith('../')) {
      if (s.includes('\0') || s.includes('..\\')) return false;
      if (/\.\.\/\.\./.test(s)) return false;
      return s.startsWith('../circuits/');
    }
    if (!lower.startsWith('https://')) return false;
    try {
      return SAFE_IMAGE_HOSTS.has(new URL(s).hostname.toLowerCase());
    } catch {
      return false;
    }
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
            img.src = url;
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

        img.addEventListener('load', onLoad);
        img.addEventListener('error', onErr);
        img.src = url;

        if (img.complete) {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          if (img.naturalWidth > 0) {
            if (shouldApply()) {
              img.src = url;
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

  function wikiThumbFromQueryJson(j) {
    const pages = j?.query?.pages || {};
    const first = pages[Object.keys(pages)[0]];
    const src = first?.thumbnail?.source || '';
    if (!src || !isImageSrcAllowed(src)) return '';
    return src;
  }

  function wikiCoverMissKey(title) {
    return `${WIKI_COVER_MISS_PREFIX}${title.toLowerCase()}`;
  }

  function isWikiCoverMiss(title) {
    try {
      return sessionStorage.getItem(wikiCoverMissKey(title)) === '1';
    } catch {
      return false;
    }
  }

  function markWikiCoverMiss(title) {
    try {
      sessionStorage.setItem(wikiCoverMissKey(title), '1');
    } catch {
      // ignore quota / private mode
    }
  }

  function pumpWikiQueue() {
    while (wikiInFlight < WIKI_MAX_CONCURRENT && wikiQueue.length > 0) {
      const job = wikiQueue.shift();
      if (!job) break;
      wikiInFlight += 1;
      void (async () => {
        try {
          const wait = Math.max(0, wikiNextAt - Date.now());
          if (wait) await new Promise((r) => window.setTimeout(r, wait));
          const result = await job.task();
          wikiNextAt = Date.now() + WIKI_GAP_MS;
          job.resolve(result);
        } catch (err) {
          job.reject(err);
        } finally {
          wikiInFlight -= 1;
          pumpWikiQueue();
        }
      })();
    }
  }

  function enqueueWiki(task) {
    return new Promise((resolve, reject) => {
      wikiQueue.push({ task, resolve, reject });
      pumpWikiQueue();
    });
  }

  function wikiCoverTitleCandidates(wikiTitle) {
    const base = String(wikiTitle || '').trim();
    if (!base) return [];
    const out = [];
    const seen = new Set();
    const push = (t) => {
      const s = String(t || '').trim();
      if (!s || seen.has(s.toLowerCase())) return;
      seen.add(s.toLowerCase());
      out.push(s);
    };
    push(base);
    if (!/grand prix$/i.test(base)) push(`${base} Grand Prix`);
    return out;
  }

  async function fetchWikiThumbForTitle(title, signal) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=1200&titles=${encodeURIComponent(title)}`;
    const r = await fetch(url, { signal });
    if (!r.ok) return '';
    const j = await r.json();
    return wikiThumbFromQueryJson(j);
  }

  async function loadCoverFromWiki(wikiTitle) {
    const titles = wikiCoverTitleCandidates(wikiTitle);
    if (titles.length === 0) return '';

    return enqueueWiki(async () => {
      const missKey = titles.join('|');
      if (isWikiCoverMiss(missKey)) return '';

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      try {
        for (const title of titles) {
          const thumb = await fetchWikiThumbForTitle(title, controller.signal);
          if (thumb) return thumb;
        }
        markWikiCoverMiss(missKey);
        return '';
      } catch {
        markWikiCoverMiss(missKey);
        return '';
      } finally {
        window.clearTimeout(timer);
      }
    });
  }

  /** @param {CircuitCoverCtx} ctx */
  function circuitRasterCandidates(ctx) {
    const urls = [];
    for (const b of buildCircuitBasenames(ctx)) {
      for (const root of CIRCUIT_ROOTS) {
        for (const ext of RASTER_EXTS) {
          urls.push(`${root}${b}.${ext}`);
        }
      }
    }
    return urls;
  }

  /** @param {CircuitCoverCtx} ctx */
  function circuitSvgCandidates(ctx) {
    const urls = [];
    for (const b of buildCircuitBasenames(ctx)) {
      for (const root of CIRCUIT_ROOTS) {
        urls.push(`${root}${b}.svg`);
      }
    }
    return urls;
  }

  /**
   * Photo-first cover: manifest/extra → raster → Wikimedia → gradient/flag fallback (no SVG as main cover).
   * @param {{ host?: HTMLElement, img: HTMLImageElement, fallbackEl?: HTMLElement | null, ctx: CircuitCoverCtx, wikiTitle: string, alt?: string, loading?: string, extraCandidates?: string[] }} opts
   * @returns {Promise<boolean>}
   */
  async function attachCircuitCover(opts) {
    const { host, img, fallbackEl, ctx, wikiTitle } = opts;
    const imgOpts = {
      alt: opts.alt ?? '',
      loading: opts.loading ?? 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
    };

    const markPhoto = () => {
      img.classList.add('is-loaded');
      if (host instanceof HTMLElement) {
        host.classList.add('has-photo');
        host.classList.remove('is-fallback', 'is-cover-fallback');
      }
      if (fallbackEl instanceof HTMLElement) fallbackEl.hidden = true;
    };

    const showFallback = () => {
      if (host instanceof HTMLElement) {
        host.classList.add('is-fallback', 'is-cover-fallback');
        host.classList.remove('has-photo');
      }
      if (fallbackEl instanceof HTMLElement) fallbackEl.hidden = false;
    };

    const rasterUrls = dedupePreserveOrder([
      ...(opts.extraCandidates || []),
      ...circuitRasterCandidates(ctx),
    ]);

    const ok = await setImageWithFallbacks(img, rasterUrls, {
      ...imgOpts,
      onSuccess: markPhoto,
      onShowPlaceholder: showFallback,
    });
    if (ok) return true;

    const wiki = await loadCoverFromWiki(wikiTitle);
    if (wiki) {
      const wikiOk = await setImageWithFallbacks(img, [wiki], {
        ...imgOpts,
        onSuccess: markPhoto,
        onShowPlaceholder: showFallback,
      });
      if (wikiOk) return true;
    }

    showFallback();
    return false;
  }

  /** Small decorative corner SVG — not a cover substitute. @param {HTMLImageElement} img @param {CircuitCoverCtx} ctx */
  async function attachCircuitSvgOverlay(img, ctx) {
    const ok = await setImageWithFallbacks(img, circuitSvgCandidates(ctx), {
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      onSuccess: () => {
        img.hidden = false;
      },
    });
    if (!ok) img.remove();
  }

  window.AnthologyCircuitCovers = {
    CIRCUIT_ASSET_ALIASES,
    normalizeCircuitBasename,
    buildCircuitBasenames,
    circuitRasterCandidates,
    circuitSvgCandidates,
    isImageSrcAllowed,
    setImageWithFallbacks,
    loadCoverFromWiki,
    attachCircuitCover,
    attachCircuitSvgOverlay,
  };
})();
