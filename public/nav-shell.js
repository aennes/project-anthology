/**
 * Shared fixed nav for vanilla mini-apps — mirrors the React NavBar.
 * Injects a desktop/tablet top bar (all 7 links) and a mobile bottom bar
 * (5 cells + "More" popup). Auto-inits when #anthology-nav-root is present.
 */
(function anthologyNavShell(global) {
  const ROOT_ID = 'anthology-nav-root';

  // Canonical destinations (shared with React NavBar).
  const TOP_LINKS = [
    { label: 'Home', href: '/' },
    { label: 'Timeline', href: '/timeline' },
    { label: 'News', href: '/news' },
    { label: 'About', href: '/about' },
    { label: 'Season', href: '/season-tracker' },
    { label: 'Circuits', href: '/tracks' },
    { label: 'Radio', href: '/radio-anthology' },
  ];

  const ICONS = {
    home:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8.5L10 3l7 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 8v8.5h11V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    season:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 2v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 3h10l-2.5 4.5H14L11.5 12H4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    circuits:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 14c-2 0-3-1-3-2.5S3.5 9 6 9h6c2 0 3-.8 3-2s-1-2-3-2H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="14" r="1.6" stroke="currentColor" stroke-width="1.5"/></svg>',
    radio:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 6.5a5 5 0 000 7M13.5 6.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4.5 4.5a8 8 0 000 11M15.5 4.5a8 8 0 010 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    more:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="4" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/><circle cx="16" cy="10" r="1.3" fill="currentColor"/></svg>',
    close:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    timeline:
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><line x1="4" y1="3" x2="4" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="4" cy="6" r="1.6" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="14" r="1.6" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    about:
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M4 18c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  const BOTTOM_CELLS = [
    { label: 'Home', href: '/', icon: ICONS.home, exact: true },
    { label: 'Season', href: '/season-tracker', icon: ICONS.season, exact: false },
    { label: 'Circuits', href: '/tracks', icon: ICONS.circuits, exact: false },
    { label: 'Radio', href: '/radio-anthology', icon: ICONS.radio, exact: false },
  ];

  const POPUP_ITEMS = [
    { label: 'Timeline', href: '/timeline', icon: ICONS.timeline },
    { label: 'About', href: '/about', icon: ICONS.about },
  ];

  /** @type {{ popupOpen: boolean, moreBtn: HTMLButtonElement | null, moreCell: HTMLElement | null, popup: HTMLElement | null, onEscapeDetail: (() => boolean) | null }} */
  const state = {
    popupOpen: false,
    moreBtn: null,
    moreCell: null,
    popup: null,
    onEscapeDetail: null,
  };

  function isActive(href, exact) {
    const path = global.location.pathname || '/';
    if (exact || href === '/') return path === '/' ? href === '/' : false;
    return path.startsWith(href);
  }

  function isHashDetailView() {
    const hash = (global.location.hash || '').replace(/^#/, '').trim();
    if (!hash) return false;
    const path = global.location.pathname || '';
    return path.includes('radio-anthology') || path.includes('tracks');
  }

  function clearHashDetail() {
    if (!isHashDetailView()) return false;
    global.history.replaceState(null, '', `${global.location.pathname}${global.location.search}`);
    global.dispatchEvent(new HashChangeEvent('hashchange'));
    return true;
  }

  function setPopupOpen(open) {
    state.popupOpen = open;
    const { moreBtn, popup } = state;
    if (popup) popup.hidden = !open;
    if (moreBtn) {
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      const icon = moreBtn.querySelector('.anthology-bottomnav__icon');
      if (icon) icon.innerHTML = open ? ICONS.close : ICONS.more;
      moreBtn.classList.toggle('is-active', open);
    }
  }

  function closePopup() {
    if (state.popupOpen) setPopupOpen(false);
  }

  function togglePopup() {
    setPopupOpen(!state.popupOpen);
  }

  function onDocumentPointerDown(e) {
    if (!state.popupOpen) return;
    if (state.moreCell && state.moreCell.contains(e.target)) return;
    closePopup();
  }

  function onDocumentKeydown(e) {
    if (e.key !== 'Escape') return;

    if (state.popupOpen) {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      return;
    }

    if (state.onEscapeDetail?.()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (clearHashDetail()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function buildTopBar() {
    const bar = document.createElement('nav');
    bar.className = 'anthology-topbar';
    bar.setAttribute('aria-label', 'Main navigation');

    const home = document.createElement('a');
    home.className = 'anthology-topbar__home';
    home.href = '/';
    home.textContent = 'Anthology';
    home.setAttribute('aria-label', 'Go to home page');

    const links = document.createElement('div');
    links.className = 'anthology-topbar__links';
    for (const item of TOP_LINKS) {
      const link = document.createElement('a');
      const active = isActive(item.href, item.href === '/');
      link.className = `anthology-topbar__link${active ? ' is-active' : ''}`;
      link.href = item.href;
      if (active) link.setAttribute('aria-current', 'page');
      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      link.append(labelSpan);
      if (active) {
        const dot = document.createElement('span');
        dot.className = 'anthology-topbar__dot';
        dot.setAttribute('aria-hidden', 'true');
        link.append(dot);
      }
      links.append(link);
    }

    bar.append(home, links);
    return bar;
  }

  function buildCell(item) {
    const link = document.createElement('a');
    const active = isActive(item.href, item.exact);
    link.className = `anthology-bottomnav__cell${active ? ' is-active' : ''}`;
    link.href = item.href;
    link.setAttribute('aria-label', item.label);
    if (active) link.setAttribute('aria-current', 'page');

    const dot = document.createElement('span');
    dot.className = 'anthology-bottomnav__dot';
    dot.setAttribute('aria-hidden', 'true');

    const icon = document.createElement('span');
    icon.className = 'anthology-bottomnav__icon';
    icon.innerHTML = item.icon;

    const label = document.createElement('span');
    label.className = 'anthology-bottomnav__label';
    label.textContent = item.label;

    link.append(dot, icon, label);
    return link;
  }

  function buildBottomBar() {
    const bar = document.createElement('nav');
    bar.className = 'anthology-bottomnav';
    bar.setAttribute('aria-label', 'Mobile bottom navigation');

    for (const item of BOTTOM_CELLS) {
      bar.append(buildCell(item));
    }

    // More cell (popup trigger).
    const moreCell = document.createElement('div');
    moreCell.className = 'anthology-bottomnav__more';

    const popupActive = POPUP_ITEMS.some((item) => isActive(item.href, false));

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = `anthology-bottomnav__cell${popupActive ? ' is-active' : ''}`;
    moreBtn.setAttribute('aria-label', 'More');
    moreBtn.setAttribute('aria-haspopup', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');

    const moreDot = document.createElement('span');
    moreDot.className = 'anthology-bottomnav__dot';
    moreDot.setAttribute('aria-hidden', 'true');

    const moreIcon = document.createElement('span');
    moreIcon.className = 'anthology-bottomnav__icon';
    moreIcon.innerHTML = ICONS.more;

    const moreLabel = document.createElement('span');
    moreLabel.className = 'anthology-bottomnav__label';
    moreLabel.textContent = 'More';

    moreBtn.append(moreDot, moreIcon, moreLabel);
    moreBtn.addEventListener('click', togglePopup);

    const popup = document.createElement('div');
    popup.className = 'anthology-bottomnav__popup';
    popup.setAttribute('role', 'menu');
    popup.setAttribute('aria-label', 'More navigation');
    popup.hidden = true;
    for (const item of POPUP_ITEMS) {
      const link = document.createElement('a');
      const active = isActive(item.href, false);
      link.className = `anthology-bottomnav__popupItem${active ? ' is-active' : ''}`;
      link.href = item.href;
      link.setAttribute('role', 'menuitem');
      link.setAttribute('aria-label', item.label);
      if (active) link.setAttribute('aria-current', 'page');
      const icon = document.createElement('span');
      icon.className = 'anthology-bottomnav__popupIcon';
      icon.innerHTML = item.icon;
      const label = document.createElement('span');
      label.className = 'anthology-bottomnav__popupLabel';
      label.textContent = item.label;
      link.append(icon, label);
      popup.append(link);
    }

    moreCell.append(moreBtn, popup);
    bar.append(moreCell);

    state.moreBtn = moreBtn;
    state.moreCell = moreCell;
    state.popup = popup;
    return bar;
  }

  function buildNav(root) {
    root.append(buildTopBar(), buildBottomBar());
  }

  function init(options = {}) {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.anthologyNavInit === 'true') return;
    root.dataset.anthologyNavInit = 'true';
    document.body.classList.add('has-anthology-nav');
    state.onEscapeDetail = typeof options.onEscapeDetail === 'function' ? options.onEscapeDetail : null;
    buildNav(root);
    document.addEventListener('keydown', onDocumentKeydown, true);
    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('touchstart', onDocumentPointerDown);
  }

  global.AnthologyNav = {
    init,
    // Retained for backwards compatibility with existing app.js callers.
    closeMenu: closePopup,
    isMenuOpen: () => false,
    clearHashDetail,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById(ROOT_ID)) init();
    });
  } else if (document.getElementById(ROOT_ID)) {
    init();
  }
})(window);
