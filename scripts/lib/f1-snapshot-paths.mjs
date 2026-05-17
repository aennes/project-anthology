/** Map Jolpica/Ergast proxy paths ↔ committed JSON under `public/data/f1/`. */

export const F1_SEASON_MIN = 2021;

export function currentSeasonYear() {
  return Math.max(F1_SEASON_MIN, new Date().getFullYear());
}

/**
 * @param {string} ergastPath e.g. `2024/driverStandings.json`
 * @returns {string | null} site path e.g. `/data/f1/2024/driverStandings.json`
 */
export function ergastPathToStaticUrl(ergastPath) {
  const p = String(ergastPath || '')
    .replace(/^\//, '')
    .trim();
  if (!p) return null;

  const calendar = p.match(/^(\d{4})\.json$/);
  if (calendar) return `/data/f1/${calendar[1]}/calendar.json`;

  const standings = p.match(/^(\d{4})\/(driverStandings|constructorStandings)\.json$/);
  if (standings) return `/data/f1/${standings[1]}/${standings[2]}.json`;

  const resultsFull = p.match(/^(\d{4})\/(\d+)\/results\.json$/);
  if (resultsFull) return `/data/f1/${resultsFull[1]}/rounds/${resultsFull[2]}/results.json`;

  const resultsLimit = p.match(/^(\d{4})\/(\d+)\/results\/(\d+)\.json$/);
  if (resultsLimit) {
    return `/data/f1/${resultsLimit[1]}/rounds/${resultsLimit[2]}/results-${resultsLimit[3]}.json`;
  }

  const qualifyingFull = p.match(/^(\d{4})\/(\d+)\/qualifying\.json$/);
  if (qualifyingFull) return `/data/f1/${qualifyingFull[1]}/rounds/${qualifyingFull[2]}/qualifying.json`;

  const qualifyingLimit = p.match(/^(\d{4})\/(\d+)\/qualifying\/(\d+)\.json$/);
  if (qualifyingLimit) {
    return `/data/f1/${qualifyingLimit[1]}/rounds/${qualifyingLimit[2]}/qualifying-${qualifyingLimit[3]}.json`;
  }

  return null;
}

/** @param {string} ergastPath */
export function parseYearFromErgastPath(ergastPath) {
  const m = String(ergastPath || '').match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

export function circuitHistoryStaticUrl(circuitId, year) {
  const id = String(circuitId || '')
    .trim()
    .toLowerCase();
  if (!id || !Number.isFinite(year)) return null;
  return `/data/f1/circuits/${id}/${year}.json`;
}

export function ergastPathToDiskPath(ergastPath, publicRoot) {
  const url = ergastPathToStaticUrl(ergastPath);
  if (!url) return null;
  return `${publicRoot}${url.replace(/^\/data\/f1/, '/data/f1')}`;
}
