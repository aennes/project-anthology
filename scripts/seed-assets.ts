/**
 * Seed Cloudinary assets using app lookup IDs and curated Wikimedia source hints.
 * Run: npm run seed:assets
 */
import { getOrGenerateAsset, checkAssetExists, resolveTimeOfDay } from '../utils/assetPipeline.js';
import type { AssetMetadata, AssetType } from '../utils/assetPipeline.js';
import { DRIVER_HEADSHOT_SOURCES, TEAM_LOGO_SOURCES } from './season-tracker-image-sources.mjs';
import { CIRCUIT_IMAGE_SOURCES } from './circuit-image-sources.mjs';
import { RADIO_IMAGE_SOURCES } from './radio-image-sources.mjs';

const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const YEAR = new Date().getFullYear();

type DriverStanding = {
  Driver?: { code?: string; givenName?: string; familyName?: string };
  Constructors?: Array<{ constructorId?: string; name?: string }>;
};

const TEAM_SLUG_TO_CONSTRUCTOR: Record<string, string> = {
  ferrari: 'ferrari',
  mercedes: 'mercedes',
  mclaren: 'mclaren',
  redbull: 'red_bull',
  alpine: 'alpine',
  williams: 'williams',
  haas: 'haas',
  sauber: 'sauber',
  visa_cash_racing_bulls: 'rb',
  aston_martin: 'aston_martin',
};

const RADIO_ID_TO_CONSTRUCTOR: Record<string, string> = {
  'multi-21-malaysia-2013': 'red_bull',
  'webber-unbelievable-china-2013': 'red_bull',
  'vettel-brazil-2012-retire-debate': 'red_bull',
  'raikkonen-leave-me-alone-india-2012': 'lotus_f1',
  'hamilton-bwoah-germany-2017': 'mercedes',
  'sainz-smooth-operator-australia-2024': 'ferrari',
  'alonso-gp2-engine-hungary-2015': 'mclaren',
  'norris-last-lap-austria-2020': 'mclaren',
  'ricciardo-honda-looks-great-japan-2019': 'renault',
  'verstappen-simply-lovely-baku-2018': 'red_bull',
  'button-is-it-a-bird-monaco-2009': 'brawn',
  'leclerc-i-am-stupid-monza-2019': 'ferrari',
  'grosjean-no-push-bahrain-2020': 'haas',
  'verstappen-mate-celebration-brazil-2016': 'red_bull',
};

let generated = 0;
let skipped = 0;
let failed = 0;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<T>;
}

async function processAsset(type: AssetType, entityId: string, meta: AssetMetadata) {
  const normalizedId = String(entityId || '').trim().toLowerCase();
  if (!normalizedId) return;
  try {
    const existing = await checkAssetExists(type, normalizedId);
    if (existing) {
      console.log(`SKIP      ${type}/${normalizedId}`);
      skipped++;
      return;
    }
  } catch {
    // Continue; getOrGenerateAsset handles fallback behavior and errors.
  }

  try {
    const url = await getOrGenerateAsset(type, normalizedId, meta);
    if (url.startsWith('/images/placeholders/')) {
      failed++;
      console.error(`FAILED    ${type}/${normalizedId} (placeholder returned)`);
      return;
    }
    generated++;
    console.log(`GENERATED ${type}/${normalizedId} -> ${url}`);
  } catch (err) {
    failed++;
    console.error(`FAILED    ${type}/${normalizedId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function seedDrivers() {
  const standingsRaw = await fetchJson<{ MRData?: { StandingsTable?: { StandingsLists?: Array<{ DriverStandings?: DriverStanding[] }> } } }>(
    `${JOLPICA}/${YEAR}/driverStandings.json?limit=40`,
  );
  const standings = standingsRaw?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const standingsByCode = new Map<string, DriverStanding>();
  for (const s of standings) {
    const code = String(s.Driver?.code || '').trim().toUpperCase();
    if (code) standingsByCode.set(code, s);
  }
  console.log(`Drivers source rows: ${DRIVER_HEADSHOT_SOURCES.length}`);
  for (const source of DRIVER_HEADSHOT_SOURCES) {
    const codeUpper = String(source.code || '').trim().toUpperCase();
    const code = codeUpper.toLowerCase();
    if (!code) continue;
    const standing = standingsByCode.get(codeUpper);
    const constructor = standing?.Constructors?.[0];
    await processAsset('driver', code, {
      teamName: constructor?.name || constructor?.constructorId || '',
      wikiTitles: [source.name],
      commonsSearch: `${source.name} Formula One driver portrait`,
      searchTerms: [
        `${source.name} Formula One`,
        `${source.name} F1 portrait`,
        `${codeUpper} Formula One driver`,
      ],
    });
  }
}

async function seedTeams() {
  console.log(`Team source rows: ${TEAM_LOGO_SOURCES.length}`);
  for (const source of TEAM_LOGO_SOURCES) {
    const constructorId = TEAM_SLUG_TO_CONSTRUCTOR[source.slug];
    if (!constructorId) continue;
    await processAsset('team', constructorId, {
      teamName: source.alt,
      wikiTitles: source.wikiTitles,
      commonsSearch: source.commonsSearch,
      searchTerms: [source.commonsSearch, ...source.wikiTitles],
    });
  }
}

async function seedCircuits() {
  const circuitApi = await fetchJson<{ MRData?: { CircuitTable?: { Circuits?: Array<{ circuitId?: string; circuitName?: string; Location?: { country?: string } }> } } }>(
    `${JOLPICA}/${YEAR}/circuits.json?limit=40`,
  );
  const circuitById = new Map<string, { name?: string; country?: string }>();
  for (const c of circuitApi?.MRData?.CircuitTable?.Circuits || []) {
    const id = String(c.circuitId || '').trim().toLowerCase();
    if (!id) continue;
    circuitById.set(id, { name: c.circuitName, country: c.Location?.country });
  }
  console.log(`Circuit source rows: ${CIRCUIT_IMAGE_SOURCES.length}`);
  for (const source of CIRCUIT_IMAGE_SOURCES) {
    const id = String(source.id || '').trim().toLowerCase();
    if (!id) continue;
    const apiMeta = circuitById.get(id);
    await processAsset('circuit', id, {
      circuitName: apiMeta?.name || source.wikiTitles?.[0] || id,
      country: apiMeta?.country || '',
      timeOfDay: resolveTimeOfDay(id),
      wikiTitles: source.wikiTitles,
      commonsSearch: source.commonsSearch,
      searchTerms: [source.commonsSearch, ...(source.wikiTitles || [])],
    });
  }
}

async function seedRadio() {
  const seenKeys = new Set<string>();
  console.log(`Radio source rows: ${RADIO_IMAGE_SOURCES.length}`);
  for (const source of RADIO_IMAGE_SOURCES) {
    const constructorId = RADIO_ID_TO_CONSTRUCTOR[source.id];
    const key = String(constructorId || source.id || '').trim().toLowerCase();
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    await processAsset('radio', key, {
      teamName: constructorId || source.id,
      commonsSearch: source.coverSearch,
      searchTerms: [source.coverSearch, ...(source.gallerySearch || [])],
    });
  }
}

async function main() {
  console.log(`\nSeeding Cloudinary assets with curated Wikimedia hints (${YEAR})\n`);
  await seedDrivers();    // driver.code (lowercase)
  await seedTeams();      // constructorId
  await seedCircuits();   // circuitId
  await seedRadio();      // constructorId || id

  const total = generated + skipped + failed;
  console.log(`
--------------------------------
Generated: ${generated}
Skipped:   ${skipped}
Failed:    ${failed}
Total:     ${total}
--------------------------------`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[seed-assets] fatal:', err);
  process.exit(1);
});
