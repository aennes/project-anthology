/**
 * One-shot (or CI) sync: Jolpica → public/data/f1 JSON bundles for instant client loads.
 * Run: npm run sync:f1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  F1_SEASON_MIN,
  currentSeasonYear,
  ergastPathToDiskPath,
} from './lib/f1-snapshot-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data', 'f1');

const ERGAST_BASE = 'https://api.jolpi.ca/ergast/f1';

const CIRCUIT_IDS = [
  'monaco',
  'spa',
  'monza',
  'silverstone',
  'suzuka',
  'interlagos',
  'bahrain',
  'jeddah',
  'albert_park',
  'americas',
  'baku',
  'catalunya',
  'hungaroring',
  'imola',
  'istanbul',
  'losail',
  'madring',
  'marina_bay',
  'miami',
  'portimao',
  'red_bull_ring',
  'ricard',
  'rodriguez',
  'shanghai',
  'sochi',
  'vegas',
  'villeneuve',
  'yas_marina',
  'zandvoort',
];

const CIRCUIT_ASSET_ALIASES = {
  las_vegas: ['vegas'],
  lasvegas: ['vegas'],
};

const FETCH_DELAY_MS = 1200;
const FETCH_MAX_RETRIES = 8;
let lastFetchAt = 0;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchErgast(path) {
  const url = `${ERGAST_BASE}/${path.replace(/^\//, '')}`;
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt += 1) {
    const now = Date.now();
    const wait = Math.max(0, FETCH_DELAY_MS - (now - lastFetchAt));
    if (wait > 0) await sleep(wait);
    lastFetchAt = Date.now();

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return { MRData: {} };
    if (res.status === 429 || res.status >= 500) {
      const backoff = FETCH_DELAY_MS * 2 ** attempt;
      console.warn(`  retry ${path} (${res.status}) in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }
    if (!res.ok) throw new Error(`Ergast ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`Ergast exhausted retries for ${path}`);
}

function writeJson(relPath, data) {
  const full = path.join(dataRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(data)}\n`, 'utf8');
}

function readJsonIfExists(relPath) {
  const full = path.join(dataRoot, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function ergastDiskPath(ergastPath) {
  const rel = ergastPathToDiskPath(ergastPath, publicRoot);
  if (!rel) return null;
  return path.relative(dataRoot, rel).replace(/\\/g, '/');
}

function hasRaces(json) {
  return Array.isArray(json?.MRData?.RaceTable?.Races) && json.MRData.RaceTable.Races.length > 0;
}

function hasStandings(json, kind) {
  const lists = json?.MRData?.StandingsTable?.StandingsLists?.[0];
  if (!lists) return false;
  if (kind === 'driver') {
    const ds = lists.DriverStandings || lists.DriverStanding || [];
    return Array.isArray(ds) && ds.length > 0;
  }
  const cs = lists.ConstructorStandings || [];
  return Array.isArray(cs) && cs.length > 0;
}

function ergastCircuitIds(circuitId) {
  const id = String(circuitId || '').trim().toLowerCase();
  const out = [id];
  const aliases = CIRCUIT_ASSET_ALIASES[id];
  if (aliases) for (const a of aliases) if (!out.includes(a)) out.push(a);
  return out;
}

function pickLatestRace(races) {
  if (!Array.isArray(races) || races.length === 0) return null;
  return races.reduce((best, r) => {
    const round = Number(r?.round || 0);
    if (!round) return best;
    if (!best || round > Number(best.round || 0)) return r;
    return best;
  }, null);
}

function findRaceForCircuitYear(circuitId, seasonJson) {
  const ids = new Set(ergastCircuitIds(circuitId));
  const matches = (seasonJson?.MRData?.RaceTable?.Races || []).filter((r) =>
    ids.has(String(r?.Circuit?.circuitId || '').toLowerCase()),
  );
  return pickLatestRace(matches);
}

function extractRaceWinner(json) {
  const race = json?.MRData?.RaceTable?.Races?.[0];
  const res = race?.Results?.[0];
  if (!res) return null;
  const d = res.Driver || {};
  const code = (d.code || '').toString().toUpperCase();
  return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
}

function extractPoleSitter(json) {
  const race = json?.MRData?.RaceTable?.Races?.[0];
  const res = race?.QualifyingResults?.[0];
  if (!res) return null;
  const d = res.Driver || {};
  const code = (d.code || '').toString().toUpperCase();
  return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
}

function extractFastestLap(json) {
  const race = json?.MRData?.RaceTable?.Races?.[0];
  const res = race?.Results || [];
  for (const r of res) {
    if (r?.FastestLap?.rank === '1' || r?.FastestLap?.rank === 1) {
      const d = r.Driver || {};
      return {
        name: `${d.givenName || ''} ${d.familyName || ''}`.trim(),
        time: r.FastestLap?.Time?.time || '',
      };
    }
  }
  return null;
}

function extractPodium(json) {
  const race = json?.MRData?.RaceTable?.Races?.[0];
  const res = race?.Results || [];
  return res.slice(0, 3).map((r) => {
    const d = r.Driver || {};
    const code = (d.code || '').toString().toUpperCase();
    return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
  });
}

async function buildCircuitYearAggregate(circuitId, year, seasonJson) {
  const race = findRaceForCircuitYear(circuitId, seasonJson);
  if (!race) return { absent: true };
  const round = Number(race.round || 0);
  if (!round) return { absent: true };

  let resultsJson = readJsonIfExists(`${year}/rounds/${round}/results.json`);
  let qualJson = readJsonIfExists(`${year}/rounds/${round}/qualifying.json`);
  if (!resultsJson) resultsJson = await fetchErgast(`${year}/${round}/results.json`);
  if (!qualJson) qualJson = await fetchErgast(`${year}/${round}/qualifying.json`);

  const winner = extractRaceWinner(resultsJson);
  const pole = extractPoleSitter(qualJson);
  const fl = extractFastestLap(resultsJson);
  const podium = extractPodium(resultsJson);

  if (!winner && !pole && !(podium && podium.length)) {
    return { absent: true };
  }

  return { absent: false, round, winner, pole, fl, podium };
}

function isRaceDone(race, now = new Date()) {
  const d = race?.date;
  if (!d) return false;
  const t = race.time ? `${d}T${race.time}` : `${d}T23:59:59Z`;
  const end = new Date(t);
  if (Number.isNaN(end.getTime())) return false;
  return end < now;
}

/** Standings + calendar + circuit rows (no per-round JSON tree). */
async function fetchErgastCached(path, diskRel) {
  const cached = readJsonIfExists(diskRel);
  if (cached) return cached;
  return fetchErgast(path);
}

async function syncSeasonCore(year) {
  console.log(`Season core ${year}…`);
  const calendar =
    readJsonIfExists(`${year}/calendar.json`) || (await fetchErgast(`${year}.json`));
  if (hasRaces(calendar)) writeJson(`${year}/calendar.json`, calendar);

  const driverStandings =
    readJsonIfExists(`${year}/driverStandings.json`) ||
    (await fetchErgast(`${year}/driverStandings.json`));
  if (hasStandings(driverStandings, 'driver')) writeJson(`${year}/driverStandings.json`, driverStandings);

  const constructorStandings =
    readJsonIfExists(`${year}/constructorStandings.json`) ||
    (await fetchErgast(`${year}/constructorStandings.json`));
  if (hasStandings(constructorStandings, 'constructor')) {
    writeJson(`${year}/constructorStandings.json`, constructorStandings);
  }

  await syncCircuitHistories(year, calendar);
}

async function syncSeasonYear(year) {
  console.log(`Season ${year}…`);
  const calendar =
    readJsonIfExists(`${year}/calendar.json`) || (await fetchErgast(`${year}.json`));
  if (hasRaces(calendar)) writeJson(`${year}/calendar.json`, calendar);

  const driverStandings =
    readJsonIfExists(`${year}/driverStandings.json`) ||
    (await fetchErgast(`${year}/driverStandings.json`));
  if (hasStandings(driverStandings, 'driver')) writeJson(`${year}/driverStandings.json`, driverStandings);

  const constructorStandings =
    readJsonIfExists(`${year}/constructorStandings.json`) ||
    (await fetchErgast(`${year}/constructorStandings.json`));
  if (hasStandings(constructorStandings, 'constructor')) {
    writeJson(`${year}/constructorStandings.json`, constructorStandings);
  }

  const races = calendar?.MRData?.RaceTable?.Races || [];
  const now = new Date();
  for (const race of races) {
    const round = Number(race.round || 0);
    if (!round) continue;
    if (!isRaceDone(race, now)) continue;

    let results;
    try {
      results = await fetchErgast(`${year}/${round}/results.json`);
    } catch (err) {
      console.warn(`  skip results R${round}:`, err.message);
      continue;
    }
    if (results?.MRData?.RaceTable?.Races?.[0]?.Results?.length) {
      writeJson(`${year}/rounds/${round}/results.json`, results);
    }

    for (const limit of [1, 2]) {
      try {
        const limited = await fetchErgast(`${year}/${round}/results/${limit}.json`);
        if (limited?.MRData?.RaceTable?.Races?.[0]?.Results?.length) {
          writeJson(`${year}/rounds/${round}/results-${limit}.json`, limited);
        }
      } catch (err) {
        console.warn(`  skip results/${limit} R${round}:`, err.message);
      }
    }

    try {
      const qualifying = await fetchErgast(`${year}/${round}/qualifying.json`);
      if (qualifying?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.length) {
        writeJson(`${year}/rounds/${round}/qualifying.json`, qualifying);
        writeJson(`${year}/rounds/${round}/qualifying-1.json`, qualifying);
      }
    } catch (err) {
      console.warn(`  skip qualifying R${round}:`, err.message);
    }
  }

  await syncCircuitHistories(year, calendar);
}

async function syncCircuitHistories(year, seasonJson) {
  console.log(`Circuit history ${year}…`);
  for (const circuitId of CIRCUIT_IDS) {
    const diskRel = `circuits/${circuitId}/${year}.json`;
    if (readJsonIfExists(diskRel)) continue;
    try {
      const aggregate = await buildCircuitYearAggregate(circuitId, year, seasonJson);
      writeJson(diskRel, aggregate);
    } catch (err) {
      console.warn(`  skip ${circuitId}/${year}:`, err.message);
    }
  }
}

async function main() {
  const seasonsOnly = process.argv.includes('--seasons-only');
  const maxYear = currentSeasonYear();
  const years = [];
  for (let y = F1_SEASON_MIN; y <= maxYear; y += 1) years.push(y);

  fs.mkdirSync(dataRoot, { recursive: true });

  for (const year of years) {
    if (seasonsOnly) await syncSeasonCore(year);
    else await syncSeasonYear(year);
  }

  const manifest = {
    version: 1,
    seasonMin: F1_SEASON_MIN,
    seasonMax: maxYear,
    years,
    generatedAt: new Date().toISOString(),
    storage: 'static-json',
    note: 'Served from /data/f1; refresh with npm run sync:f1',
  };
  writeJson('index.json', manifest);

  console.log(`Done. ${years.length} seasons → ${dataRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
