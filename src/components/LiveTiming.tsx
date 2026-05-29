import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadLiveTimingSnapshot, type LiveDriver, type LiveTimingSnapshot } from './f1Data';

const POLL_MS = 5000;

const tyreColor: Record<string, string> = {
  S: '#ff1801',
  M: '#ffd84d',
  H: '#f5f5f5',
  I: '#4dd178',
  W: '#4fa8ff',
};

const sectorColor: Record<LiveDriver['sectors'][number], string> = {
  fastest: '#b86cff',
  personal: '#4dd178',
  slower: '#ffce4d',
  neutral: 'rgba(244,241,234,0.2)',
};

function formatAtmosphereValue(value: number | null, unit: string): string {
  return value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;
}

function RaceControlBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-5 w-full bg-f1-red px-4 py-3 text-white md:px-6">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] md:text-xs">
          {message}
        </p>
        <button
          type="button"
          aria-label="Dismiss race control banner"
          onClick={onDismiss}
          className="font-mono text-base font-bold leading-none text-white/90 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          X
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`live-tower-skeleton-${index}`}
          className="grid animate-pulse grid-cols-[44px,1fr,104px] gap-3 border border-white/10 bg-surface-container-low px-3 py-3"
        >
          <div className="h-8 w-8 bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-24 bg-white/10" />
            <div className="h-3 w-36 bg-white/10" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-white/10" />
            <div className="h-3 w-14 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

const LiveTiming: React.FC = () => {
  const [snapshot, setSnapshot] = useState<LiveTimingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dismissedRaceControl, setDismissedRaceControl] = useState('');
  const pollHandle = useRef<number | null>(null);
  const mounted = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollHandle.current != null) {
      window.clearInterval(pollHandle.current);
      pollHandle.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await loadLiveTimingSnapshot();
      if (!mounted.current) return;
      setSnapshot(data);
      setError('');
    } catch (fetchError: unknown) {
      if (!mounted.current) return;
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load live timing.';
      setError(message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollHandle.current != null) return;
    pollHandle.current = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    if (document.visibilityState === 'visible') startPolling();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
        return;
      }
      void refresh();
      startPolling();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mounted.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, startPolling, stopPolling]);

  const isActive = snapshot?.active ?? false;
  const raceControlMessage = snapshot?.raceControl ?? '';
  const raceControlVisible =
    !!raceControlMessage &&
    snapshot?.raceControlStatus !== 'none' &&
    dismissedRaceControl !== raceControlMessage;
  const tower = snapshot?.tower ?? [];
  const hasAtmosphere = !!snapshot?.atmosphere;

  useEffect(() => {
    if (dismissedRaceControl && dismissedRaceControl !== raceControlMessage) {
      setDismissedRaceControl('');
    }
  }, [dismissedRaceControl, raceControlMessage]);

  return (
    <section className="pb-16 pt-[72px]">
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8">
        <header className="mb-6 flex min-h-[40vh] flex-col justify-center border border-white/10 bg-surface-container-low px-5 py-8 md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-[3.2rem] uppercase leading-[0.9] tracking-[0.06em] md:text-[5.5rem]">
                LIVE TIMING
              </h1>
              <span className="mt-2 block h-[1px] w-36 bg-f1-red md:w-52" />
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Lap Counter
              </p>
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-white/85">
                {snapshot?.lapLabel ?? 'LAP —'}
              </p>
            </div>
          </div>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/80">
            {snapshot?.meetingName || 'Grand Prix Session'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isActive ? 'animate-pulse bg-f1-red' : 'bg-white/35'
              }`}
              aria-hidden="true"
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">
              {isActive
                ? 'SESSION ACTIVE'
                : `NO ACTIVE SESSION · NEXT: ${snapshot?.nextRaceLabel ?? 'TBC'}`}
            </p>
          </div>
        </header>
      </div>

      {raceControlVisible && (
        <RaceControlBanner message={raceControlMessage} onDismiss={() => setDismissedRaceControl(raceControlMessage)} />
      )}

      <div className="mx-auto grid max-w-screen-2xl gap-6 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-3">
          {loading && <LoadingSkeleton />}

          {!loading && tower.length === 0 && (
            <div className="border border-white/10 bg-surface-container-low px-5 py-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/55">
                No timing rows are currently available.
              </p>
              <div className="mt-4">
                <LoadingSkeleton />
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {!loading &&
              tower.map((entry) => (
                <motion.article
                  key={entry.driverNumber}
                  layout
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`grid items-center gap-3 border border-white/10 px-3 py-3 transition-[transform,background-color,border-color] duration-300 md:grid-cols-[44px,1fr,108px,96px,96px] ${
                    entry.position === 1 ? 'bg-f1-red/10' : 'bg-surface-container-low'
                  }`}
                  style={{ borderLeftWidth: 4, borderLeftColor: entry.teamColour }}
                >
                  <div className="flex items-end gap-1">
                    <span className="font-display text-[2rem] leading-none text-white/55">{entry.position}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">#{entry.driverNumber}</span>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-display text-[1.2rem] uppercase leading-none tracking-[0.06em]">
                      {entry.code}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
                      {entry.teamName}
                    </p>
                  </div>

                  <div className="font-mono text-[10px] uppercase tracking-[0.12em]">
                    <p className="text-f1-red">{entry.gap}</p>
                    <p className="text-white/45">{entry.interval}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-3 w-3 rounded-full border border-white/30"
                      style={{ backgroundColor: tyreColor[entry.tyre] ?? 'rgba(244,241,234,0.5)' }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/75">
                      {entry.tyre}
                    </span>
                    {entry.inPit && (
                      <span className="animate-pulse font-mono text-[10px] uppercase tracking-[0.16em] text-f1-red">
                        PIT
                      </span>
                    )}
                    {entry.drs && <span className="h-2 w-2 rounded-full bg-[#23d561]" aria-label="DRS enabled" />}
                  </div>

                  <div className="flex items-center gap-1">
                    {entry.sectors.map((sector, idx) => (
                      <span
                        key={`${entry.driverNumber}-sector-${idx}`}
                        className="h-2.5 w-5"
                        style={{ backgroundColor: sectorColor[sector] }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </motion.article>
              ))}
          </AnimatePresence>

          {!loading && !!error && (
            <div className="border border-f1-red/40 bg-f1-red/10 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-f1-red">
                Live feed unavailable: {error}
              </p>
            </div>
          )}
        </div>

        <aside className="hidden space-y-4 lg:block">
          <section className="border border-white/10 bg-surface-container-low px-4 py-4">
            <h2 className="font-display text-[1.6rem] uppercase tracking-[0.05em]">Constructors</h2>
            <div className="mt-3 space-y-2">
              {(snapshot?.constructors?.length ? snapshot.constructors : [{ name: 'No constructor data', color: '#5a5a5a', points: 0 }]).map((team) => (
                <div key={team.name} className="border border-white/10 bg-black/20 px-3 py-2">
                  <div className="mb-1 h-1.5 w-full" style={{ backgroundColor: team.color }} />
                  <div className="flex items-center justify-between">
                    <p className="truncate pr-2 font-condensed text-sm uppercase tracking-[0.1em] text-white/80">
                      {team.name}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-f1-red">
                      {team.points} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-white/10 bg-surface-container-low px-4 py-4">
            <h2 className="font-display text-[1.6rem] uppercase tracking-[0.05em]">Atmosphere</h2>
            {!hasAtmosphere ? (
              <div className="mt-3 animate-pulse space-y-2">
                <div className="h-4 w-2/3 bg-white/10" />
                <div className="h-4 w-3/4 bg-white/10" />
                <div className="h-4 w-1/2 bg-white/10" />
              </div>
            ) : (
              <ul className="mt-3 space-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
                <li className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span>Air Temp</span>
                  <span>{formatAtmosphereValue(snapshot?.atmosphere?.airTemp ?? null, '°C')}</span>
                </li>
                <li className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span>Track Temp</span>
                  <span>{formatAtmosphereValue(snapshot?.atmosphere?.trackTemp ?? null, '°C')}</span>
                </li>
                <li className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span>Wind</span>
                  <span>{formatAtmosphereValue(snapshot?.atmosphere?.windSpeed ?? null, ' km/h')}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Humidity</span>
                  <span>{formatAtmosphereValue(snapshot?.atmosphere?.humidity ?? null, '%')}</span>
                </li>
              </ul>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
};

export default LiveTiming;
