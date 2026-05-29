import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDefaultSeasonYear,
  getSeasonSnapshotFromCache,
  loadSeasonSnapshot,
  type RaceWeekend,
  type SeasonSnapshot,
} from './f1Data';

type RaceStatus = 'completed' | 'next' | 'upcoming';

type RaceDetail = {
  podium: Array<{ position: number; code: string; team: string }>;
  pole: { code: string; time: string };
  fastestLap: { code: string; time: string };
  sprintWinner?: string;
  tyreCompounds: Array<'soft' | 'medium' | 'hard'>;
};

const SEASONS = [2022, 2023, 2024, 2025, 2026] as const;

const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6',
  'Red Bull Racing': '#3671C6',
  Ferrari: '#E8002D',
  Mercedes: '#27F4D2',
  McLaren: '#FF8700',
  Alpine: '#0090FF',
  'Aston Martin': '#229971',
  Williams: '#64C4FF',
  'RB F1 Team': '#6692FF',
  RB: '#6692FF',
  'Kick Sauber': '#52E252',
  Sauber: '#52E252',
  Haas: '#B6BABD',
  'AlphaTauri': '#5E8FAA',
  'Alfa Romeo': '#900000',
  'Racing Point': '#F596C8',
  Renault: '#FFF500',
  'Toro Rosso': '#2B4562',
};

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: '🇦🇺',
  Austria: '🇦🇹',
  Azerbaijan: '🇦🇿',
  Bahrain: '🇧🇭',
  Belgium: '🇧🇪',
  Brazil: '🇧🇷',
  Canada: '🇨🇦',
  China: '🇨🇳',
  France: '🇫🇷',
  Hungary: '🇭🇺',
  Italy: '🇮🇹',
  Japan: '🇯🇵',
  Mexico: '🇲🇽',
  Monaco: '🇲🇨',
  Netherlands: '🇳🇱',
  Qatar: '🇶🇦',
  Saudi: '🇸🇦',
  Singapore: '🇸🇬',
  Spain: '🇪🇸',
  UAE: '🇦🇪',
  'United Arab Emirates': '🇦🇪',
  UK: '🇬🇧',
  'United Kingdom': '🇬🇧',
  USA: '🇺🇸',
  'United States': '🇺🇸',
};

const TYRE_META: Array<{ key: 'soft' | 'medium' | 'hard'; fallback: string; label: string }> = [
  { key: 'soft', fallback: '#E10600', label: 'SOFT' },
  { key: 'medium', fallback: '#FFD300', label: 'MEDIUM' },
  { key: 'hard', fallback: '#FFFFFF', label: 'HARD' },
];

const cloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo');

function clampSeason(year: number): number {
  if (year <= SEASONS[0]) return SEASONS[0];
  if (year >= SEASONS[SEASONS.length - 1]) return SEASONS[SEASONS.length - 1];
  return year;
}

function parseRaceDate(race: RaceWeekend): Date | null {
  if (!race.date) return null;
  const iso = race.time ? `${race.date}T${race.time}` : `${race.date}T00:00:00Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toCircuitId(race: RaceWeekend): string {
  if (race.circuitId) return race.circuitId;
  return race.circuitName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCloudinaryCircuitImage(race: RaceWeekend): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f1-anthology/circuit/${toCircuitId(race)}`;
}

function formatMonoDate(rawDate: string): string {
  if (!rawDate) return 'TBA';
  const parsed = new Date(`${rawDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .toUpperCase()
    .replace(' ', ' ');
}

function flagFromCountry(country: string): string {
  if (!country) return '🏁';
  const direct = COUNTRY_FLAGS[country];
  if (direct) return direct;
  const fromContains = Object.entries(COUNTRY_FLAGS).find(([name]) => country.includes(name));
  return fromContains?.[1] ?? '🏁';
}

function constructorColor(constructorName: string): string {
  const exact = TEAM_COLORS[constructorName];
  if (exact) return exact;
  const found = Object.entries(TEAM_COLORS).find(([name]) => constructorName.includes(name));
  return found?.[1] ?? '#ff1801';
}

function constructorCode(name: string): string {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

async function fetchSeasonProxy(path: string): Promise<any> {
  const response = await fetch(`/api/f1-season?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Race details fetch failed (${response.status})`);
  }
  return response.json();
}

function readRaceDetailCache(season: number, round: number): RaceDetail | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(`f1-race-detail:${season}:${round}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RaceDetail;
  } catch {
    return null;
  }
}

function writeRaceDetailCache(season: number, round: number, detail: RaceDetail): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(`f1-race-detail:${season}:${round}`, JSON.stringify(detail));
}

async function loadRaceDetail(season: number, round: number): Promise<RaceDetail> {
  const cached = readRaceDetailCache(season, round);
  if (cached) return cached;

  const [results, qualifying, sprint] = await Promise.all([
    fetchSeasonProxy(`${season}/${round}/results.json`),
    fetchSeasonProxy(`${season}/${round}/qualifying.json`),
    fetchSeasonProxy(`${season}/${round}/sprint.json`).catch(() => null),
  ]);

  const raceEntry = results?.MRData?.RaceTable?.Races?.[0];
  const resultRows = Array.isArray(raceEntry?.Results) ? raceEntry.Results : [];
  const podium = resultRows.slice(0, 3).map((row: any, index: number) => ({
    position: index + 1,
    code: row?.Driver?.code ?? row?.Driver?.familyName ?? 'UNK',
    team: row?.Constructor?.name ?? 'Unknown Team',
  }));

  const poleEntry = qualifying?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.[0];
  const pole = {
    code: poleEntry?.Driver?.code ?? poleEntry?.Driver?.familyName ?? 'TBA',
    time: poleEntry?.Q3 ?? poleEntry?.Q2 ?? poleEntry?.Q1 ?? '—',
  };

  const fastestEntry = resultRows.find((row: any) => String(row?.FastestLap?.rank ?? '') === '1');
  const fastestLap = {
    code: fastestEntry?.Driver?.code ?? fastestEntry?.Driver?.familyName ?? '—',
    time: fastestEntry?.FastestLap?.Time?.time ?? '—',
  };

  const sprintWinner =
    sprint?.MRData?.RaceTable?.Races?.[0]?.SprintResults?.[0]?.Driver?.code ??
    sprint?.MRData?.RaceTable?.Races?.[0]?.SprintResults?.[0]?.Driver?.familyName;

  const detail: RaceDetail = {
    podium,
    pole,
    fastestLap,
    sprintWinner,
    tyreCompounds: ['soft', 'medium', 'hard'],
  };

  writeRaceDetailCache(season, round, detail);
  return detail;
}

const TyreChip: React.FC<{ compound: 'soft' | 'medium' | 'hard' }> = ({ compound }) => {
  const [iconFailed, setIconFailed] = useState(false);
  const config = TYRE_META.find((entry) => entry.key === compound) ?? TYRE_META[0];

  return (
    <span className="inline-flex items-center gap-2 border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80">
      {!iconFailed ? (
        <img
          src={`/tyres/${compound}.svg`}
          alt={`${compound} tyre`}
          className="h-3 w-3 object-contain"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: config.fallback }} />
      )}
      {config.label}
    </span>
  );
};

const SeasonTracker: React.FC = () => {
  const defaultSeason = useMemo(() => clampSeason(getDefaultSeasonYear()), []);
  const initialSnapshot = useMemo(() => getSeasonSnapshotFromCache(defaultSeason), [defaultSeason]);
  const [season, setSeason] = useState<number>(defaultSeason);
  const [snapshot, setSnapshot] = useState<SeasonSnapshot | null>(initialSnapshot);
  const [loading, setLoading] = useState<boolean>(!initialSnapshot);
  const [error, setError] = useState<string>('');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [detailsByRound, setDetailsByRound] = useState<Record<number, RaceDetail | null>>({});
  const [detailLoadingRound, setDetailLoadingRound] = useState<number | null>(null);
  const [barsVisible, setBarsVisible] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const constructorSectionRef = useRef<HTMLDivElement | null>(null);
  const calendarRailRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cachedSnapshot = getSeasonSnapshotFromCache(season);
    const hasCachedSnapshot = Boolean(cachedSnapshot);

    if (cachedSnapshot) {
      setSnapshot((current) => (current?.fetchedAt === cachedSnapshot.fetchedAt ? current : cachedSnapshot));
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');
    setExpandedRound(null);
    setDetailsByRound({});

    loadSeasonSnapshot(season, {
      revalidate: true,
      onRevalidated: (freshSnapshot) => {
        if (cancelled) return;
        setSnapshot((current) => (current?.fetchedAt === freshSnapshot.fetchedAt ? current : freshSnapshot));
      },
    })
      .then((data) => {
        if (cancelled) return;
        setSnapshot((current) => (current?.fetchedAt === data.fetchedAt ? current : data));
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        const message = fetchError instanceof Error ? fetchError.message : 'Unable to load season data.';
        setError(hasCachedSnapshot ? 'Live refresh failed. Showing cached season data.' : message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [season]);

  useEffect(() => {
    const target = constructorSectionRef.current;
    if (!target || barsVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setBarsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [barsVisible, snapshot]);

  const raceStatusByRound = useMemo(() => {
    const statusMap: Record<number, RaceStatus> = {};
    if (!snapshot?.races?.length) return statusMap;

    const racesWithTime = snapshot.races.map((race) => ({
      race,
      startMs: parseRaceDate(race)?.getTime() ?? Number.MAX_SAFE_INTEGER,
    }));

    let nextRound: number | null = null;
    for (const item of racesWithTime) {
      if (item.startMs >= nowMs) {
        nextRound = item.race.round;
        break;
      }
    }

    for (const item of racesWithTime) {
      if (nextRound !== null && item.race.round === nextRound) {
        statusMap[item.race.round] = 'next';
      } else if (item.startMs < nowMs) {
        statusMap[item.race.round] = 'completed';
      } else {
        statusMap[item.race.round] = 'upcoming';
      }
    }
    return statusMap;
  }, [snapshot, nowMs]);

  const nextRace = useMemo(() => {
    if (!snapshot?.races?.length) return null;
    for (const race of snapshot.races) {
      const when = parseRaceDate(race);
      if (!when) continue;
      if (when.getTime() >= nowMs) return race;
    }
    return null;
  }, [snapshot, nowMs]);

  const countdown = useMemo(() => {
    const targetMs = nextRace ? parseRaceDate(nextRace)?.getTime() ?? 0 : 0;
    const remaining = Math.max(0, targetMs - nowMs);
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return { days, hours, minutes, seconds };
  }, [nextRace, nowMs]);

  const autoScrollRound = useMemo(() => {
    if (!snapshot?.races?.length) return null;
    return nextRace?.round ?? snapshot.races[snapshot.races.length - 1]?.round ?? null;
  }, [snapshot, nextRace]);

  useEffect(() => {
    if (!snapshot?.races?.length || !autoScrollRound) return;
    const rail = calendarRailRef.current;
    const card = cardRefs.current[autoScrollRound];
    if (!rail || !card) return;

    window.requestAnimationFrame(() => {
      const targetLeft = card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2;
      rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    });
  }, [snapshot, autoScrollRound]);

  useEffect(() => {
    if (expandedRound === null) return;

    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const container = cardRefs.current[expandedRound];
      if (!container) return;
      if (!container.contains(target)) {
        setExpandedRound(null);
      }
    };

    document.addEventListener('mousedown', onDocumentPointerDown);
    return () => document.removeEventListener('mousedown', onDocumentPointerDown);
  }, [expandedRound]);

  const leader = snapshot?.drivers?.[0] ?? null;
  const driverRows = snapshot?.drivers?.slice(0, 10) ?? [];
  const constructorRows = snapshot?.constructors?.slice(0, 8) ?? [];
  const maxConstructorPoints = Math.max(...constructorRows.map((item) => item.points), 1);
  const totalRounds = snapshot?.races?.length ?? 24;
  const nextRoundLabel = nextRace ? `ROUND ${nextRace.round}` : `ROUND ${totalRounds}`;

  const handleCompletedRaceClick = async (round: number): Promise<void> => {
    if (expandedRound === round) {
      setExpandedRound(null);
      return;
    }
    setExpandedRound(round);
    if (detailsByRound[round]) return;

    try {
      setDetailLoadingRound(round);
      const detail = await loadRaceDetail(season, round);
      setDetailsByRound((prev) => ({ ...prev, [round]: detail }));
    } catch {
      setDetailsByRound((prev) => ({
        ...prev,
        [round]: {
          podium: [],
          pole: { code: 'TBA', time: '—' },
          fastestLap: { code: '—', time: '—' },
          tyreCompounds: ['soft', 'medium', 'hard'],
        },
      }));
    } finally {
      setDetailLoadingRound((current) => (current === round ? null : current));
    }
  };

  return (
    <section className="season-tracker-page relative bg-f1-black text-paper">
      <style>{`
        .season-tracker-page .st-carbon-texture {
          background-image:
            linear-gradient(45deg, rgba(255, 255, 255, 0.02) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255, 255, 255, 0.02) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.02) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.02) 75%);
          background-size: 4px 4px;
          background-position: 0 0, 0 2px, 2px -2px, -2px 0;
        }
        .season-tracker-page .st-film-grain::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.04;
          background-image: url("https://www.transparenttextures.com/patterns/stardust.png");
          mix-blend-mode: screen;
        }
        .season-tracker-page .st-light-streak {
          position: absolute;
          top: 22%;
          left: -30%;
          width: 160%;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.24) 52%, transparent 100%);
          animation: st-streak 8s linear infinite;
        }
        .season-tracker-page .st-shimmer {
          background: linear-gradient(100deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: st-shimmer 1.4s ease infinite;
        }
        .season-tracker-page .st-scroll-bounce {
          animation: st-bounce 2s infinite;
        }
        @keyframes st-streak {
          from { transform: translateX(-15%); opacity: 0; }
          20% { opacity: 1; }
          to { transform: translateX(15%); opacity: 0; }
        }
        @keyframes st-shimmer {
          from { background-position: 100% 0; }
          to { background-position: -100% 0; }
        }
        @keyframes st-bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
          60% { transform: translateY(-3px); }
        }
      `}</style>

      <header className="st-carbon-texture st-film-grain relative isolate min-h-[100svh] overflow-hidden border-b border-white/10 px-4 pb-8 pt-24 md:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.08)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08)_0%,transparent_52%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,24,1,0.18)_0%,transparent_68%)]" />
          <div className="st-light-streak" />
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-screen-2xl flex-col justify-between">
          <div className="mt-6 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-12 bg-f1-red" />
                <p className="font-condensed text-section-divider uppercase tracking-[0.2em] text-f1-red">
                  SEASON TRACKER · {season}
                </p>
                <span className="h-px w-12 bg-f1-red" />
              </div>
              {loading ? (
                <div className="st-shimmer mb-5 h-[56px] w-[85%] md:h-[12vw]" />
              ) : (
                <h1 className="font-display text-[56px] uppercase leading-[0.92] md:text-[14vw]">
                  {leader?.name ?? 'CHAMPIONSHIP LEADER'}
                </h1>
              )}
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/72 md:text-stats-mono">
                {leader
                  ? `${leader.constructor} · ${leader.points} PTS · ${leader.wins} WINS`
                  : 'No standings available for this season yet.'}
              </p>
            </div>

            <aside className="hidden w-full max-w-[420px] border-l-4 border-f1-red bg-[#141414]/95 p-6 md:block">
              <p className="font-condensed text-nav-link uppercase tracking-[0.2em] text-f1-red">NEXT RACE</p>
              <h2 className="mt-3 font-display text-[2.5rem] uppercase leading-[0.95]">
                {nextRace?.raceName ?? 'SEASON COMPLETE'}
              </h2>
              <div className="mt-6 grid grid-cols-4 gap-3">
                {[
                  { label: 'DAYS', value: countdown.days },
                  { label: 'HRS', value: countdown.hours },
                  { label: 'MINS', value: countdown.minutes },
                  { label: 'SECS', value: countdown.seconds },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="font-mono text-2xl text-white">{String(item.value).padStart(2, '0')}</p>
                    <p className="font-condensed text-[10px] uppercase tracking-[0.16em] text-white/50">{item.label}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/season-tracker/live"
                className="mt-6 inline-flex border border-f1-red px-4 py-2 font-condensed text-nav-link uppercase tracking-[0.16em] text-f1-red transition hover:bg-f1-red hover:text-white"
              >
                ACCESS LIVE TIMING
              </Link>
            </aside>
          </div>

          <div className="mt-10 border-t border-white/10 pt-4">
            <div className="grid grid-cols-1 gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/58 md:grid-cols-3">
              <p>LIVE FEED: {nextRoundLabel} / {totalRounds}</p>
              <p className="md:text-center">NEXT CIRCUIT: {nextRace?.circuitName ?? 'SEASON COMPLETE'}</p>
              <p className="md:text-right">{season} SEASON</p>
            </div>
          </div>
        </div>

        <span className="st-scroll-bounce absolute bottom-5 left-1/2 block -translate-x-1/2 text-f1-red md:hidden">⌄</span>
      </header>

      <nav className="sticky top-[52px] z-40 h-[44px] border-y border-white/10 bg-[#131313]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-2 overflow-x-auto px-4 hide-scrollbar md:px-8">
          {SEASONS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => {
                if (year !== season) setSeason(year);
              }}
              className={`h-[44px] shrink-0 border px-6 font-condensed text-nav-link uppercase tracking-[0.15em] transition-colors ${
                year === season
                  ? 'border-f1-red bg-f1-red text-white'
                  : 'border-white/10 bg-transparent text-white/55 hover:text-white'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-section-gap px-4 py-section-gap md:px-8">
        {error ? (
          <div className="border border-white/10 bg-[#141414] p-6 font-mono text-xs uppercase tracking-[0.14em] text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <article>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="font-display text-headline-lg uppercase">Driver Standings</h3>
              <p className="font-condensed text-nav-link uppercase tracking-[0.15em] text-f1-red">
                Leader: {leader?.code ?? 'TBA'}
              </p>
            </div>
            <div className="space-y-2">
              {(loading ? new Array(8).fill(null) : driverRows).map((driver, index) => {
                if (!driver) {
                  return <div key={`driver-skeleton-${index}`} className="st-shimmer h-14 border border-white/10 bg-[#141414]" />;
                }
                const gap = Math.max((leader?.points ?? driver.points) - driver.points, 0);
                return (
                  <div
                    key={`${driver.position}-${driver.code}`}
                    className="group flex h-14 items-center border-l-[4px] bg-[#141414] px-3 transition-all hover:border-l-[8px]"
                    style={{ borderLeftColor: constructorColor(driver.constructor) }}
                  >
                    <span className="w-10 font-display text-2xl uppercase text-white/42">
                      {driver.position.toString().padStart(2, '0')}
                    </span>
                    <span className="ml-2 flex-1 font-display text-[1.4rem] uppercase tracking-[0.06em]">{driver.code}</span>
                    <span className="pr-4 font-mono text-xs uppercase text-white/42">{gap === 0 ? 'LEADER' : `+${gap}`}</span>
                    <span className="font-mono text-sm text-white/90">{driver.points}</span>
                  </div>
                );
              })}
              {!loading && driverRows.length === 0 ? (
                <p className="border border-white/10 bg-[#141414] px-4 py-6 font-mono text-xs uppercase tracking-[0.14em] text-white/50">
                  Standings unavailable for this season.
                </p>
              ) : null}
            </div>
          </article>

          <article ref={constructorSectionRef}>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="font-display text-headline-lg uppercase">Constructor Power</h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/45">Points Spread</p>
            </div>

            <div className="h-[340px] border border-white/10 bg-[#141414] p-5">
              <div className="flex h-full items-end justify-between gap-2">
                {(loading ? new Array(6).fill(null) : constructorRows).map((constructor, index) => {
                  if (!constructor) {
                    return <div key={`bar-skeleton-${index}`} className="st-shimmer h-full w-full max-w-[46px]" />;
                  }
                  const pct = Math.max(10, Math.round((constructor.points / maxConstructorPoints) * 100));
                  const fillHeight = barsVisible ? `${pct}%` : '0%';
                  return (
                    <div key={constructor.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="font-mono text-[11px] text-white/75">{constructor.points}</span>
                      <div className="relative flex h-[240px] w-full max-w-[48px] items-end border border-white/10 bg-black/30">
                        <div
                          className="w-full transition-[height] duration-700 ease-out"
                          style={{ height: fillHeight, backgroundColor: constructorColor(constructor.name) }}
                        />
                      </div>
                      <span className="font-condensed text-[10px] uppercase tracking-[0.16em] text-white/55">
                        {constructorCode(constructor.name)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!loading && constructorRows.length === 0 ? (
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-white/50">
                  Constructor data unavailable.
                </p>
              ) : null}
            </div>
          </article>
        </section>

        <section>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="font-condensed text-section-divider uppercase tracking-[0.2em] text-f1-red">Broadcast Schedule</p>
              <h3 className="font-display text-headline-lg uppercase">Race Calendar Rail</h3>
            </div>
          </div>

          <div ref={calendarRailRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 hide-scrollbar">
            {(loading ? new Array(6).fill(null) : snapshot?.races ?? []).map((race, index) => {
              if (!race) {
                return (
                  <div key={`race-skeleton-${index}`} className="w-[72vw] max-w-[280px] shrink-0 snap-center md:w-[280px]">
                    <div className="st-shimmer h-[360px] border border-white/10 bg-[#141414]" />
                  </div>
                );
              }

              const status = raceStatusByRound[race.round] ?? 'upcoming';
              const isExpanded = expandedRound === race.round;
              const isCompleted = status === 'completed';
              const detail = detailsByRound[race.round];
              const detailLoading = detailLoadingRound === race.round;
              const nextCard = status === 'next';
              const cardClasses =
                status === 'completed'
                  ? 'grayscale opacity-60 border-white/20'
                  : nextCard
                    ? 'opacity-100 border-f1-red shadow-[0_0_24px_rgba(255,24,1,0.3)]'
                    : 'grayscale-[30%] opacity-85 border-white/10';

              return (
                <div
                  key={`${race.round}-${race.raceName}`}
                  ref={(node) => {
                    cardRefs.current[race.round] = node;
                  }}
                  className="w-[72vw] max-w-[280px] shrink-0 snap-center md:w-[280px]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) void handleCompletedRaceClick(race.round);
                    }}
                    className={`group relative h-[360px] w-full overflow-hidden border-l-[3px] bg-[#141414] text-left transition-colors ${cardClasses} ${
                      isCompleted ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <img
                      src={toCloudinaryCircuitImage(race)}
                      alt={race.circuitName}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                    <p className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/72">
                      RND {String(race.round).padStart(2, '0')}
                    </p>
                    <p className="absolute right-3 top-3 text-xl">{flagFromCountry(race.country)}</p>
                    {race.winnerCode && isCompleted ? (
                      <p className="absolute left-3 top-10 border border-white/15 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/85">
                        WIN {race.winnerCode}
                      </p>
                    ) : null}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-display text-[1.4rem] uppercase leading-none">{race.circuitName}</p>
                        <p className="mt-1 font-condensed text-[11px] uppercase tracking-[0.14em] text-white/58">{race.raceName}</p>
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">{formatMonoDate(race.date)}</p>
                    </div>
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[440px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="mt-2 border-l-[3px] border-f1-red bg-[#141414] p-4">
                      {detailLoading ? (
                        <div className="space-y-2">
                          <div className="st-shimmer h-10" />
                          <div className="st-shimmer h-10" />
                          <div className="st-shimmer h-10" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            {(detail?.podium ?? []).length > 0 ? (
                              detail?.podium.map((entry) => (
                                <div key={`${entry.position}-${entry.code}`} className="flex items-center justify-between border-b border-white/10 pb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-f1-red">P{entry.position}</span>
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: constructorColor(entry.team) }} />
                                    <span className="font-display text-xl uppercase">{entry.code}</span>
                                  </div>
                                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">{constructorCode(entry.team)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">No race detail available.</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                            <div>
                              <p className="font-condensed text-[10px] uppercase tracking-[0.16em] text-white/50">POLE</p>
                              <p className="font-mono text-xs text-white">{detail?.pole.code ?? 'TBA'} · {detail?.pole.time ?? '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-condensed text-[10px] uppercase tracking-[0.16em] text-white/50">FASTEST LAP</p>
                              <p className="font-mono text-xs text-[#b042ff]">
                                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#b042ff]" />
                                {detail?.fastestLap.code ?? '—'} · {detail?.fastestLap.time ?? '—'}
                              </p>
                            </div>
                          </div>

                          {detail?.sprintWinner ? (
                            <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-white/80">
                              {detail.sprintWinner}
                              <span className="border border-f1-red px-2 py-1 text-[10px] text-f1-red">SPRINT</span>
                            </p>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {(detail?.tyreCompounds ?? ['soft', 'medium', 'hard']).map((compound) => (
                              <TyreChip key={`${race.round}-${compound}`} compound={compound} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!loading && (!snapshot?.races || snapshot.races.length === 0) ? (
            <p className="border border-white/10 bg-[#141414] px-4 py-6 font-mono text-xs uppercase tracking-[0.14em] text-white/55">
              Calendar is not published for this season yet.
            </p>
          ) : null}
        </section>
      </main>
    </section>
  );
};

export default SeasonTracker;
