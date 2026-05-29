import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 8.5L10 3l7 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 8v8.5h11V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SeasonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 2v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 3h10l-2.5 4.5H14L11.5 12H4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const CircuitsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M5 14c-2 0-3-1-3-2.5S3.5 9 6 9h6c2 0 3-.8 3-2s-1-2-3-2H7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="5" cy="14" r="1.6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const RadioIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.5 6.5a5 5 0 000 7M13.5 6.5a5 5 0 010 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4.5 4.5a8 8 0 000 11M15.5 4.5a8 8 0 010 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="4" cy="10" r="1.3" fill="currentColor" />
    <circle cx="10" cy="10" r="1.3" fill="currentColor" />
    <circle cx="16" cy="10" r="1.3" fill="currentColor" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TimelineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <line x1="4" y1="3" x2="4" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="4" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="4" cy="14" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const AboutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 18c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PRIMARY_CELLS = [
  { label: 'HOME', path: '/', href: null as string | null, Icon: HomeIcon, exact: true },
  { label: 'SEASON', path: '/season-tracker', href: '/season-tracker', Icon: SeasonIcon, exact: false },
  { label: 'CIRCUITS', path: '/tracks', href: '/tracks', Icon: CircuitsIcon, exact: false },
  { label: 'RADIO', path: '/radio-anthology', href: '/radio-anthology', Icon: RadioIcon, exact: false },
] as const;

const POPUP_ITEMS = [
  { label: 'TIMELINE', path: '/timeline', Icon: TimelineIcon },
  { label: 'ABOUT', path: '/about', Icon: AboutIcon },
] as const;

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen]);

  const cellContent = (Icon: React.FC, label: string, active: boolean) => (
    <>
      <span
        className="w-[5px] h-[5px] rounded-full mb-[1px]"
        style={{ backgroundColor: active ? '#ff1801' : 'transparent' }}
        aria-hidden="true"
      />
      <span style={{ color: active ? '#ff1801' : 'rgba(255,255,255,0.45)' }}>
        <Icon />
      </span>
      <span
        className="font-condensed uppercase"
        style={{
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: active ? '#ff1801' : 'rgba(255,255,255,0.45)',
        }}
      >
        {label}
      </span>
    </>
  );

  const popupActive = POPUP_ITEMS.some((item) => isActive(item.path, false));

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 w-full z-[60]"
      style={{
        height: '64px',
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
      aria-label="Mobile bottom navigation"
    >
      <ul className="flex h-full">
        {PRIMARY_CELLS.map(({ label, path, href, Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <li key={label} className="flex-1">
              {href ? (
                <a
                  href={href}
                  className="flex flex-col items-center justify-center h-full gap-[3px] w-full"
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
                  {cellContent(Icon, label, active)}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center h-full gap-[3px] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1801]"
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
                  {cellContent(Icon, label, active)}
                </button>
              )}
            </li>
          );
        })}

        {/* ── More (popup trigger) ── */}
        <li key="MORE" className="flex-1 relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex flex-col items-center justify-center h-full gap-[3px] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1801]"
            aria-label="More"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {cellContent(menuOpen ? CloseIcon : MoreIcon, 'MORE', menuOpen || popupActive)}
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="More navigation"
              style={{
                position: 'absolute',
                bottom: '64px',
                right: '4px',
                width: '140px',
                background: '#161616',
                border: '0.5px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                boxShadow: 'none',
                overflow: 'hidden',
              }}
            >
              {POPUP_ITEMS.map(({ label, path, Icon }) => {
                const active = isActive(path, false);
                return (
                  <a
                    key={label}
                    href={path}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 w-full"
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    style={{ color: active ? '#ff1801' : 'rgba(255,255,255,0.8)' }}
                  >
                    <Icon />
                    <span
                      className="font-condensed uppercase tracking-[0.08em]"
                      style={{ fontSize: '10px' }}
                    >
                      {label}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
