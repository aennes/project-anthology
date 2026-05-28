import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ArchiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const NewsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="7.5" x2="15" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const LiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 2v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 3h10l-2.5 4.5H14L11.5 12H4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const AboutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 18c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const NAV_ITEMS = [
  { label: 'ARCHIVE', path: '/', href: null as string | null, Icon: ArchiveIcon, exact: true },
  { label: 'NEWS',    path: '/news', href: null, Icon: NewsIcon, exact: false },
  { label: 'LIVE',   path: '/season-tracker', href: '/season-tracker', Icon: LiveIcon, exact: false },
  { label: 'ABOUT',  path: '/about', href: null, Icon: AboutIcon, exact: false },
] as const;

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full z-[60]"
      style={{
        height: '64px',
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
      aria-label="Mobile bottom navigation"
    >
      <ul className="flex h-full">
        {NAV_ITEMS.map(({ label, path, href, Icon, exact }) => {
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
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center h-full gap-[3px] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1801]"
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
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
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
