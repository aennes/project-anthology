import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

type NavBarVariant = 'overlay' | 'solid';

interface NavBarProps {
  variant?: NavBarVariant;
  showCategories?: boolean;
  backLabel?: string;
  onBack?: () => void;
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
  { label: 'Home', path: '/' as string, preload: undefined as (() => void) | undefined },
  { label: 'Timeline', path: '/timeline' },
  { label: 'News', path: '/news', preload: preloadNews },
  { label: 'About', path: '/about' },
];

const HREF_LINKS = [
  { label: 'Season', path: '/season-tracker', full: 'Season Tracker' },
  { label: 'Circuits', path: '/tracks', full: 'Circuit Atlas' },
  { label: 'Radio', path: '/radio-anthology', full: 'Radio Anthology' },
];

const NavBar: React.FC<NavBarProps> = ({
  variant = 'solid',
  backLabel,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

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

  const isTransparent = variant === 'overlay' && !scrolled;

  const navLinkClass = (active: boolean) =>
    `font-nav-link text-nav-link uppercase transition-colors duration-[150ms]
     focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-1 focus:ring-offset-f1-black
     relative min-h-[44px] flex flex-col items-center justify-center cursor-pointer pb-[3px]
     ${active ? 'text-white' : 'text-white/50 hover:text-[#ffb4a7]'}`;

  const activeDot = (
    <span
      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff1801]"
      aria-hidden="true"
    />
  );

  return (
    <>
      {/* ── Desktop / tablet top bar (hidden on mobile; bottom bar covers mobile) ── */}
      <motion.nav
        className="hidden md:flex fixed top-0 left-0 w-full z-[60] items-center h-[52px] px-5 sm:px-8 border-b-2 border-[#ff1801]"
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
              {backLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center font-nav-link text-nav-link uppercase text-f1-red
                         hover:text-white/80 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-1 focus:ring-offset-f1-black
                         min-h-[44px] cursor-pointer whitespace-nowrap"
              aria-label="Go to home page"
              data-testid="home-button"
            >
              Anthology
            </button>
          )}
        </div>

        {/* ── Right-aligned inline links (always shown on top bar) ── */}
        <nav
          className="flex items-center gap-6 lg:gap-10 ml-auto"
          aria-label="Site navigation"
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
                {active && activeDot}
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
                {active && activeDot}
              </a>
            );
          })}
        </nav>
      </motion.nav>

      <MobileBottomNav />
    </>
  );
};

export default NavBar;
