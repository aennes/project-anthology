/**
 * Minimal cinematic helpers: parallax on [data-cine-parallax] / [data-cine-depth].
 * Respects prefers-reduced-motion. Safe to load on all static mini-apps.
 */
(() => {
  'use strict';

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {{ el: HTMLElement; depth: number; root: Element }[]} */
  let layers = [];

  function collectLayers() {
    layers = [];
    document.querySelectorAll('[data-cine-parallax]').forEach((root) => {
      const kids = root.querySelectorAll('[data-cine-depth]');
      if (kids.length) {
        kids.forEach((el) => {
          if (el instanceof HTMLElement) {
            layers.push({
              el,
              depth: Number.parseFloat(el.getAttribute('data-cine-depth') || '0.2') || 0.2,
              root,
            });
          }
        });
      } else if (root instanceof HTMLElement) {
        layers.push({ el: root, depth: 0.14, root });
      }
    });
  }

  let ticking = false;

  function applyParallax() {
    if (reduceMq.matches || !layers.length) return;
    const vh = window.innerHeight;
    for (const { el, depth, root } of layers) {
      const rect = root.getBoundingClientRect();
      const progress = (rect.top + rect.height * 0.5 - vh * 0.5) / vh;
      const offset = progress * depth * -42;
      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      applyParallax();
    });
  }

  function init() {
    if (reduceMq.matches) return;
    collectLayers();
    if (!layers.length) return;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    applyParallax();
  }

  function resetParallax() {
    for (const { el } of layers) {
      el.style.removeProperty('transform');
    }
    layers = [];
    if (!reduceMq.matches) init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hashchange', () => {
    window.setTimeout(resetParallax, 80);
  });

  reduceMq.addEventListener('change', () => {
    if (reduceMq.matches) {
      for (const { el } of layers) el.style.removeProperty('transform');
      layers = [];
    } else {
      init();
    }
  });

  window.AnthologyCinematic = { refresh: resetParallax };
})();
