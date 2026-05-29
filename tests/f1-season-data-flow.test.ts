import { beforeEach, describe, expect, it, vi } from 'vitest';

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validDriversPayload = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          DriverStandings: [
            {
              position: '1',
              points: '150',
              wins: '5',
              Driver: { code: 'VER', givenName: 'Max', familyName: 'Verstappen' },
              Constructors: [{ name: 'Red Bull Racing' }],
            },
          ],
        },
      ],
    },
  },
};

const validConstructorsPayload = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          ConstructorStandings: [
            {
              position: '1',
              points: '260',
              Constructor: { name: 'Red Bull Racing' },
            },
          ],
        },
      ],
    },
  },
};

const validCalendarPayload = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '1',
          raceName: 'Bahrain Grand Prix',
          date: '2026-03-08',
          time: '15:00:00Z',
          Circuit: {
            circuitId: 'bahrain',
            circuitName: 'Bahrain International Circuit',
            Location: { country: 'Bahrain', locality: 'Sakhir' },
          },
        },
      ],
    },
  },
};

const validResultsPayload = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '1',
          Results: [{ Driver: { code: 'VER', familyName: 'Verstappen' } }],
        },
      ],
    },
  },
};

describe('season data flow', () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns cache immediately and revalidates in background', async () => {
    const cached = {
      season: 2026,
      fetchedAt: '2026-05-29T10:00:00.000Z',
      drivers: [
        {
          position: 1,
          code: 'NOR',
          name: 'Lando Norris',
          constructor: 'McLaren',
          points: 111,
          wins: 2,
        },
      ],
      constructors: [{ position: 1, name: 'McLaren', points: 180 }],
      races: [
        {
          round: 1,
          raceName: 'Cached GP',
          circuitName: 'Cached Circuit',
          circuitId: 'cached',
          country: 'Bahrain',
          locality: 'Sakhir',
          date: '2026-03-08',
          winnerCode: 'NOR',
        },
      ],
    };

    window.sessionStorage.setItem('f1-season-cache:2026', JSON.stringify(cached));

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okJson(validDriversPayload))
      .mockResolvedValueOnce(okJson(validConstructorsPayload))
      .mockResolvedValueOnce(okJson(validCalendarPayload))
      .mockResolvedValueOnce(okJson(validResultsPayload));

    const { loadSeasonSnapshot } = await import('../src/components/f1Data');
    const onRevalidated = vi.fn();

    const first = await loadSeasonSnapshot(2026, { revalidate: true, onRevalidated });
    expect(first.drivers[0]?.code).toBe('NOR');

    await vi.waitFor(() => {
      expect(onRevalidated).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const refreshed = onRevalidated.mock.calls[0][0];
    expect(refreshed.drivers[0]?.code).toBe('VER');
  });

  it('keeps cached snapshot when refresh payload is invalid', async () => {
    const cached = {
      season: 2026,
      fetchedAt: '2026-05-29T10:00:00.000Z',
      drivers: [
        {
          position: 1,
          code: 'LEC',
          name: 'Charles Leclerc',
          constructor: 'Ferrari',
          points: 88,
          wins: 1,
        },
      ],
      constructors: [{ position: 1, name: 'Ferrari', points: 130 }],
      races: [
        {
          round: 1,
          raceName: 'Cached GP',
          circuitName: 'Cached Circuit',
          circuitId: 'cached',
          country: 'Bahrain',
          locality: 'Sakhir',
          date: '2026-03-08',
          winnerCode: 'LEC',
        },
      ],
    };

    window.sessionStorage.setItem('f1-season-cache:2026', JSON.stringify(cached));

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}));

    const { loadSeasonSnapshot } = await import('../src/components/f1Data');
    const onRevalidated = vi.fn();

    const snapshot = await loadSeasonSnapshot(2026, { revalidate: true, onRevalidated });
    expect(snapshot.drivers[0]?.code).toBe('LEC');

    await vi.waitFor(() => {
      expect(onRevalidated).toHaveBeenCalledTimes(0);
    });
  });
});
