import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

type NavBarVariant = 'overlay' | 'solid';

interface NavBarProps {
  /**
   * 'overlay' — transparent nav on top of hero; switches to blurred dark when scrolled.
   * 'solid'   — always the dark, blurred top bar (used by routed pages).
   */
  variant?: NavBarVariant;
  /**
   * When true, the sidebar drawer also renders the F1 category shortcuts
   * (Rivalry / Tragedy / Myth). Only used by the home Shell.
   */
  showCategories?: boolean;
}

const CATEGORIES = ['Rivalry', 'Tragedy', 'Myth'] as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

const NavBar: React.FC<NavBarProps> = ({ variant = 'solid', showCategories = false }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollLockY = useRef(0);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

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
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY.current}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
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

  const overlayClass =
    variant === 'overlay'
      ? scrolled
        ? 'bg-f1-black/95 backdrop-blur-md border-b border-white/10 text-white mix-blend-normal'
        : 'mix-blend-difference text-white'
      : 'bg-f1-black/95 backdrop-blur-md border-b border-white/10 text-white';

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 w-full z-[60] flex justify-between items-center px-4 sm:px-8 py-4 sm:py-6 ${overlayClass}`}
        aria-label="Main navigation"
        initial={false}
        animate={
          variant === 'overlay'
            ? {
                backgroundColor: scrolled
                  ? 'rgba(10, 10, 10, 0.95)'
                  : 'rgba(0, 0, 0, 0)',
              }
            : { backgroundColor: 'rgba(10, 10, 10, 0.95)' }
        }
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-condensed text-[0.65rem] sm:text-xs tracking-widest uppercase opacity-90 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black rounded px-2 py-2 min-h-[44px] cursor-pointer text-left max-w-[58vw] sm:max-w-none"
          aria-label="Go to home page"
          data-testid="home-button"
        >
          Project Anthology <span className="text-f1-red">///</span> EST. 2026
        </button>
        <motion.div className="flex items-center gap-3 md:gap-4">
          <Button
            type="button"
            variant="glow"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            aria-controls="anthology-react-nav-drawer"
            data-testid="menu-button"
            className={`text-xs tracking-[0.2em] min-h-[44px] min-w-[44px] px-5 py-2.5 cursor-pointer ${
              isMenuOpen
                ? '!bg-f1-red !border-f1-red !text-white opacity-100 shadow-[0_0_12px_rgba(255,24,1,0.5)]'
                : ''
            }`}
          >
            Menu
          </Button>
        </motion.div>
      </motion.nav>

      <AnimatePresence>
        {isMenuOpen && (
          <>
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
                <div className="flex justify-between items-center p-6 sm:p-8 border-b border-white/10">
                  <h2 className="font-display text-2xl text-white tracking-wide">Navigation</h2>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close menu"
                    data-testid="menu-close"
                    className="font-condensed text-sm uppercase tracking-widest text-white hover:text-f1-red transition-colors p-2 min-h-[44px] min-w-[44px]"
                  >
                    Close
                  </button>
                </div>

                <nav className="flex-1 p-6 sm:p-8 space-y-6" aria-label="Site links">
                  <div>
                    <h3 className="font-mono text-xs text-f1-red uppercase tracking-widest mb-4">
                      Navigation
                    </h3>
                    <ul className="space-y-2">
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            navigate('/');
                          }}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide min-h-[44px] py-1"
                        >
                          Anthology
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            navigate('/timeline');
                          }}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide min-h-[44px] py-1"
                        >
                          Timeline
                        </button>
                      </li>
                      <li>
                        <a
                          href="/season-tracker"
                          onClick={closeMenu}
                          onMouseEnter={() => prefetchMiniApp('/season-tracker/')}
                          onFocus={() => prefetchMiniApp('/season-tracker/')}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide flex items-center min-h-[44px] py-1"
                        >
                          Season Tracker
                        </a>
                      </li>
                      <li>
                        <a
                          href="/tracks"
                          onClick={closeMenu}
                          onMouseEnter={() => prefetchMiniApp('/tracks/')}
                          onFocus={() => prefetchMiniApp('/tracks/')}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide flex items-center min-h-[44px] py-1"
                        >
                          Circuit Atlas
                        </a>
                      </li>
                      <li>
                        <a
                          href="/radio-anthology"
                          onClick={closeMenu}
                          onMouseEnter={() => prefetchMiniApp('/radio-anthology/')}
                          onFocus={() => prefetchMiniApp('/radio-anthology/')}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide flex items-center min-h-[44px] py-1"
                        >
                          Radio Anthology
                        </a>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            navigate('/news');
                          }}
                          onMouseEnter={() => {
                            import('../News');
                            import('../../utils/newsService').then(({ fetchNews }) => {
                              fetchNews().catch(() => {});
                            });
                          }}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide min-h-[44px] py-1"
                        >
                          News
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            navigate('/about');
                          }}
                          className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide min-h-[44px] py-1"
                        >
                          About
                        </button>
                      </li>
                    </ul>
                  </div>

                  {showCategories && (
                    <div>
                      <h3 className="font-mono text-xs text-f1-red uppercase tracking-widest mb-4">
                        Categories
                      </h3>
                      <ul className="space-y-2">
                        {CATEGORIES.map((category) => (
                          <li key={category}>
                            <button
                              type="button"
                              onClick={() => {
                                closeMenu();
                                navigate(`/?category=${encodeURIComponent(category)}`);
                                setTimeout(() => {
                                  const archiveSection = document.querySelector('[data-archive-section]');
                                  if (archiveSection) {
                                    archiveSection.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }, 150);
                              }}
                              className="font-condensed text-lg text-white hover:text-f1-red transition-colors w-full text-left tracking-wide min-h-[44px] py-1"
                            >
                              {category}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </nav>

                <div className="p-6 sm:p-8 border-t border-white/10">
                  <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                    Project Anthology <span className="text-f1-red">///</span> EST. 2026
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NavBar;
