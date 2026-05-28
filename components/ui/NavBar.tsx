import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

type NavBarVariant = 'overlay' | 'solid';

interface NavBarProps {
  variant?: NavBarVariant;
  showCategories?: boolean;
  backLabel?: string;
  onBack?: () => void;
}

const CATEGORIES = ['Rivalry', 'Tragedy', 'Myth'] as const;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  );
}

const MINI_APP_PREFETCH = ['/season-tracker/', '/tracks/', '/radio-anthology/'] as const;
const prefetchedMiniApps = new Set<string>();

function prefetchMiniApp(href: string) {
  if (prefetchedMiniApps.has(href)) return;
  prefetchedMiniApps.add(href);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

function preloadNews() {
  import('../News');
  import('../../utils/newsService').then(({ fetchNews }) => {
    fetchNews().catch(() => {});
  });
}

const ROUTER_LINKS = [
  { label: 'Anthology', path: '/' as string, preload: undefined as (() => void) | undefined },
  { label: 'Timeline', path: '/timeline' },
  { label: 'News', path: '/news', preload: preloadNews },
  { label: 'About', path: '/about' },
];

const HREF_LINKS = [
  { label: 'Season', path: '/season-tracker', full: 'Season Tracker' },
  { label: 'Circuits', path: '/tracks', full: 'Circuit Atlas' },
  { label: 'Radio', path: '/radio-anthology', full: 'Radio Anthology' },
];

const HamburgerBars: React.FC<{ open: boolean }> = ({ open }) => (
  <>
    <span
      className={`block w-[18px] h-[1.5px] bg-white transition-all duration-200 origin-center ${
        open ? 'translate-y-[6.5px] rotate-45' : ''
      }`}
    />
    <span
      className={`block w-[18px] h-[1.5px] bg-white transition-all duration-200 ${
        open ? 'opacity-0 scale-x-0' : ''
      }`}
    />
    <span
      className={`block w-[18px] h-[1.5px] bg-white transition-all duration-200 origin-center ${
        open ? '-translate-y-[6.5px] -rotate-45' : ''
      }`}
    />
  </>
);

const NavBar: React.FC<NavBarProps> = ({
  variant = 'solid',
  showCategories = false,
  backLabel,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollLockY = useRef(0);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useEffect(() => {
    if (variant !== 'overlay') return;
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  useEffect(() => {
    const idle = () => MINI_APP_PREFETCH.forEach(prefetchMiniApp);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(idle, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(idle, 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    scrollLockY.current = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY.current}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollLockY.current);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable(drawer);
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
    drawer.addEventListener('keydown', onKey);
    const closeBtn = drawer.querySelector<HTMLElement>('[data-testid="menu-close"]');
    requestAnimationFrame(() => closeBtn?.focus());
    return () => drawer.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-shortcuts-modal]')) return;
      if (document.querySelector('[data-anthology-story-modal]')) return;
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isMenuOpen, closeMenu]);

  useEffect(() => {
    if (isMenuOpen) return;
    document.querySelector<HTMLButtonElement>('[data-testid="menu-button"]')?.focus();
  }, [isMenuOpen]);

  const isTransparent = variant === 'overlay' && !scrolled;

  const navLinkClass = (active: boolean) =>
    `font-nav-link text-nav-link uppercase transition-colors duration-[150ms]
     focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-1 focus:ring-offset-f1-black
     relative min-h-[44px] flex flex-col items-center justify-center cursor-pointer pb-[3px]
     ${active ? 'text-white' : 'text-white/50 hover:text-[#ffb4a7]'}`;

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 w-full z-[60] flex items-center h-[52px] px-5 sm:px-8 border-b-2 border-[#ff1801]"
        aria-label="Main navigation"
        initial={false}
        animate={{
          backgroundColor: isTransparent ? 'rgba(0,0,0,0)' : 'rgba(10,10,10,0.95)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ backdropFilter: isTransparent ? 'none' : 'blur(12px)' }}
      >
        {/* ── Left slot ── */}
        <div className="flex items-center shrink-0">
          {backLabel && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 font-nav-link text-nav-link uppercase text-white/60 hover:text-white
                         transition-colors focus:outline-none focus:ring-2 focus:ring-f1-red
                         focus:ring-offset-1 focus:ring-offset-f1-black min-h-[44px] cursor-pointer"
              aria-label={`Back to ${backLabel}`}
              data-testid="nav-back-button"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
                <path d="M7.5 2L3 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {backLabel}
            </button>
          ) : (
            <>
              {/* Mobile hamburger — hidden on lg+ */}
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
                aria-controls="anthology-react-nav-drawer"
                data-testid="menu-button"
                className="lg:hidden flex flex-col justify-center items-center gap-[5px]
                           w-[44px] h-[44px] -ml-2 cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-1 focus:ring-offset-f1-black"
              >
                <HamburgerBars open={isMenuOpen} />
              </button>

              {/* Desktop logo — hidden below lg */}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="hidden lg:flex items-center font-nav-link text-nav-link uppercase text-f1-red
                           hover:text-white/80 transition-colors
                           focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-1 focus:ring-offset-f1-black
                           min-h-[44px] cursor-pointer whitespace-nowrap"
                aria-label="Go to home page"
                data-testid="home-button"
              >
                Anthology
              </button>
            </>
          )}
        </div>

        {/* ── Mobile: centered logo (absolute) — hidden when back button is shown ── */}
        {!backLabel && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="lg:hidden absolute left-1/2 -translate-x-1/2
                       font-nav-link text-nav-link uppercase text-f1-red hover:text-white/80
                       transition-colors focus:outline-none min-h-[44px] flex items-center
                       cursor-pointer whitespace-nowrap"
            aria-label="Go to home page"
          >
            Anthology
          </button>
        )}

        {/* ── Desktop: right-aligned nav ── */}
        <nav
          className="hidden lg:flex items-center gap-10 ml-auto"
          aria-label="Desktop navigation"
        >
          {ROUTER_LINKS.map(({ label, path, preload }) => {
            const active = isActive(path);
            return (
              <button
                key={label}
                type="button"
                onClick={() => { preload?.(); navigate(path); }}
                onMouseEnter={preload}
                onFocus={preload}
                className={navLinkClass(active)}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff1801]" aria-hidden="true" />
                )}
              </button>
            );
          })}
          {HREF_LINKS.map(({ label, path }) => {
            const active = isActive(path);
            return (
              <a
                key={label}
                href={path}
                onMouseEnter={() => prefetchMiniApp(`${path}/`)}
                onFocus={() => prefetchMiniApp(`${path}/`)}
                className={navLinkClass(active)}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff1801]" aria-hidden="true" />
                )}
              </a>
            );
          })}
        </nav>

        {/* ── Right slot — balances mobile layout ── */}
        <div className="ml-auto lg:hidden w-[44px] shrink-0" />
      </motion.nav>

      {/* ── Drawer ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[65] border-0 p-0 cursor-pointer"
              aria-label="Close menu"
              onClick={closeMenu}
            />

            {/* Panel */}
            <motion.div
              ref={drawerRef}
              id="anthology-react-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] sm:w-full max-w-md bg-f1-black border-l border-white/10 z-[70] overflow-y-auto"
            >
              <div className="flex flex-col h-full">
                {/* Drawer header — matches nav bar height */}
                <div className="flex justify-between items-center px-6 sm:px-8 h-[52px] border-b border-white/10 shrink-0">
                  <span className="font-nav-link text-nav-link uppercase text-f1-red">
                    Anthology
                  </span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close menu"
                    data-testid="menu-close"
                    className="flex flex-col justify-center items-center gap-[5px]
                               w-[44px] h-[44px] -mr-2 cursor-pointer
                               focus:outline-none focus:ring-2 focus:ring-f1-red"
                  >
                    <HamburgerBars open={true} />
                  </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-6 sm:px-8 py-6" aria-label="Site links">
                  <ul>
                    {ROUTER_LINKS.map(({ label, path, preload }) => {
                      const active = isActive(path);
                      return (
                        <li key={label}>
                          <button
                            type="button"
                            onClick={() => { closeMenu(); preload?.(); navigate(path); }}
                            onMouseEnter={preload}
                            className={`font-condensed text-2xl w-full text-left tracking-wide
                                        min-h-[52px] flex items-center gap-3
                                        border-b border-white/[0.06] transition-colors
                                        ${active ? 'text-white' : 'text-white/50 hover:text-white'}`}
                          >
                            {active && <span className="w-1 h-1 rounded-full bg-f1-red shrink-0" />}
                            {label}
                          </button>
                        </li>
                      );
                    })}
                    {HREF_LINKS.map(({ label, path, full }) => (
                      <li key={label}>
                        <a
                          href={path}
                          onClick={closeMenu}
                          onMouseEnter={() => prefetchMiniApp(`${path}/`)}
                          onFocus={() => prefetchMiniApp(`${path}/`)}
                          className="font-condensed text-2xl text-white/50 hover:text-white
                                     transition-colors w-full text-left tracking-wide
                                     flex items-center min-h-[52px] border-b border-white/[0.06]"
                        >
                          {full}
                        </a>
                      </li>
                    ))}
                  </ul>

                  {showCategories && (
                    <div className="mt-8">
                      <p className="font-mono text-[10px] text-f1-red uppercase tracking-widest mb-4">
                        Categories
                      </p>
                      <ul>
                        {CATEGORIES.map((category) => (
                          <li key={category}>
                            <button
                              type="button"
                              onClick={() => {
                                closeMenu();
                                navigate(`/?category=${encodeURIComponent(category)}`);
                                setTimeout(() => {
                                  document
                                    .querySelector('[data-archive-section]')
                                    ?.scrollIntoView({ behavior: 'smooth' });
                                }, 150);
                              }}
                              className="font-condensed text-2xl text-white/50 hover:text-white
                                         transition-colors w-full text-left tracking-wide
                                         min-h-[52px] flex items-center border-b border-white/[0.06]"
                            >
                              {category}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </nav>

                {/* Footer */}
                <div className="px-6 sm:px-8 py-5 border-t border-white/10 shrink-0">
                  <p className="font-mono text-[10px] text-white/30 uppercase tracking-widest">
                    Project Anthology <span className="text-f1-red">///</span> EST. 2026
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <MobileBottomNav />
    </>
  );
};

export default NavBar;
