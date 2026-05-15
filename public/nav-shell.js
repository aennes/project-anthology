/**
 * Shared fixed nav + slide-out menu for vanilla mini-apps.
 * Auto-inits when #anthology-nav-root is present.
 */
(function anthologyNavShell(global) {
  const ROOT_ID = 'anthology-nav-root';
  const NAV_LINKS = [
    { label: 'Anthology', href: '/' },
    { label: 'Timeline', href: '/timeline' },
    { label: 'Season Tracker', href: '/season-tracker' },
    { label: 'Circuit Atlas', href: '/tracks' },
    { label: 'Radio Anthology', href: '/radio-anthology' },
    { label: 'News', href: '/news' },
  ];

  /** @type {{ menuOpen: boolean, menuBtn: HTMLButtonElement | null, backdrop: HTMLButtonElement | null, drawer: HTMLDialogElement | null, focusTrapCleanup: (() => void) | null, scrollY: number, onEscapeDetail: (() => boolean) | null }} */
  const state = {
    menuOpen: false,
    menuBtn: null,
    backdrop: null,
    drawer: null,
    focusTrapCleanup: null,
    scrollY: 0,
    onEscapeDetail: null,
  };

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

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function lockBodyScroll() {
    state.scrollY = global.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${state.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    global.scrollTo(0, state.scrollY);
  }

  function installFocusTrap(container) {
    const onKey = (e) => {
      if (e.key !== 'Tab' || !state.menuOpen) return;
      const nodes = getFocusable(container);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKey);
    return () => container.removeEventListener('keydown', onKey);
  }

  function setMenuOpen(open) {
    state.menuOpen = open;
    const { menuBtn, backdrop, drawer } = state;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) backdrop.hidden = !open;
    if (drawer) {
      if (open) {
        drawer.removeAttribute('hidden');
        drawer.setAttribute('open', '');
      } else {
        drawer.removeAttribute('open');
        drawer.setAttribute('hidden', '');
      }
    }
    if (open) {
      lockBodyScroll();
      state.focusTrapCleanup = drawer ? installFocusTrap(drawer) : null;
      const closeBtn = drawer?.querySelector('.anthology-nav__drawerClose');
      if (closeBtn instanceof HTMLElement) {
        requestAnimationFrame(() => closeBtn.focus());
      }
    } else {
      state.focusTrapCleanup?.();
      state.focusTrapCleanup = null;
      unlockBodyScroll();
      menuBtn?.focus();
    }
  }

  function closeMenu() {
    if (!state.menuOpen) return;
    setMenuOpen(false);
  }

  function openMenu() {
    if (state.menuOpen) return;
    setMenuOpen(true);
  }

  function toggleMenu() {
    if (state.menuOpen) closeMenu();
    else openMenu();
  }

  function onDocumentKeydown(e) {
    if (e.key !== 'Escape') return;

    if (state.menuOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
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

  function buildNav(root) {
    const nav = document.createElement('nav');
    nav.className = 'anthology-nav is-solid';
    nav.setAttribute('aria-label', 'Main navigation');

    const home = document.createElement('a');
    home.className = 'anthology-nav__home';
    home.href = '/';
    home.setAttribute('aria-label', 'Go to home page');
    home.innerHTML = 'Project Anthology <em>///</em> EST. 2026';

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'anthology-nav__menu';
    menuBtn.textContent = 'Menu';
    menuBtn.setAttribute('aria-label', 'Toggle menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-controls', 'anthology-nav-drawer');
    state.menuBtn = menuBtn;

    nav.append(home, menuBtn);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'anthology-nav__backdrop';
    backdrop.setAttribute('aria-label', 'Close menu');
    backdrop.hidden = true;
    backdrop.addEventListener('click', closeMenu);
    state.backdrop = backdrop;

    const drawer = document.createElement('aside');
    drawer.id = 'anthology-nav-drawer';
    drawer.className = 'anthology-nav__drawer';
    drawer.setAttribute('aria-label', 'Site navigation');
    drawer.hidden = true;

    const head = document.createElement('div');
    head.className = 'anthology-nav__drawerHead';
    const title = document.createElement('h2');
    title.className = 'anthology-nav__drawerTitle';
    title.textContent = 'Navigation';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'anthology-nav__drawerClose';
    closeBtn.textContent = 'Close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.addEventListener('click', closeMenu);
    head.append(title, closeBtn);

    const body = document.createElement('div');
    body.className = 'anthology-nav__drawerBody';
    const sectionLabel = document.createElement('p');
    sectionLabel.className = 'anthology-nav__sectionLabel';
    sectionLabel.textContent = 'Navigation';
    const list = document.createElement('ul');
    list.className = 'anthology-nav__links';
    for (const item of NAV_LINKS) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'anthology-nav__link';
      link.href = item.href;
      link.textContent = item.label;
      link.addEventListener('click', closeMenu);
      li.append(link);
      list.append(li);
    }
    body.append(sectionLabel, list);

    const foot = document.createElement('div');
    foot.className = 'anthology-nav__drawerFoot';
    foot.innerHTML = 'Project Anthology <em>///</em> EST. 2026';

    drawer.append(head, body, foot);
    state.drawer = drawer;

    menuBtn.addEventListener('click', toggleMenu);

    root.append(nav, backdrop, drawer);
  }

  function init(options = {}) {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.anthologyNavInit === 'true') return;
    root.dataset.anthologyNavInit = 'true';
    document.body.classList.add('has-anthology-nav');
    state.onEscapeDetail = typeof options.onEscapeDetail === 'function' ? options.onEscapeDetail : null;
    buildNav(root);
    document.addEventListener('keydown', onDocumentKeydown, true);
  }

  global.AnthologyNav = {
    init,
    closeMenu,
    isMenuOpen: () => state.menuOpen,
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
