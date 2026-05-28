/**
 * Seed AI assets for the current F1 season.
 * Run: npm run seed:assets
 *
 * For each driver / team / circuit: checks Cloudinary first (SKIP if found),
 * then generates via Flux Pro and uploads.
 * Reports: SKIP {id} | GENERATED {id} → {url} | FAILED {id}
 */

import { getOrGenerateAsset, checkAssetExists, resolveTimeOfDay } from '../utils/assetPipeline.js';
import type { AssetType, AssetMetadata } from '../utils/assetPipeline.js';

const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const YEAR = new Date().getFullYear();

// Approximate team accent colors for prompt quality
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  red_bull:     { primary: '#1E41FF', secondary: '#CC1E4A' },
  ferrari:      { primary: '#DC0000', secondary: '#FFFFFF' },
  mercedes:     { primary: '#00D2BE', secondary: '#C0C0C0' },
  mclaren:      { primary: '#FF8000', secondary: '#000000' },
  alpine:       { primary: '#0090FF', secondary: '#FF2D55' },
  aston_martin: { primary: '#006F62', secondary: '#CEDC00' },
  williams:     { primary: '#005AFF', secondary: '#FFFFFF' },
  haas:         { primary: '#FFFFFF', secondary: '#E8002D' },
  kick_sauber:  { primary: '#52E252', secondary: '#000000' },
  rb:           { primary: '#1535CC', secondary: '#FF8000' },
  sauber:       { primary: '#52E252', secondary: '#000000' },
};

function teamColors(constructorId: string) {
  return TEAM_COLORS[constructorId] ?? { primary: '#ff1801', secondary: '#ffffff' };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<unknown>;
}

let generated = 0;
let skipped = 0;
let failed = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function processAsset(type: AssetType, entityId: string, meta: AssetMetadata) {
  try {
    // Fast pre-check: if Cloudinary already has it, skip without calling fal.ai
    const existing = await checkAssetExists(type, entityId);
    if (existing) {
      console.log(`SKIP   ${type}/${entityId}`);
      skipped++;
      return;
    }
  } catch {
    // Cloudinary unreachable → try anyway
  }

  try {
    const url = await getOrGenerateAsset(type, entityId, meta);
    if (url.startsWith('/images/placeholders/')) {
      console.error(`FAILED ${type}/${entityId}  (pipeline returned placeholder)`);
      failed++;
    } else {
      console.log(`GENERATED ${type}/${entityId} → ${url}`);
      generated++;
    }
  } catch (err) {
    console.error(`FAILED ${type}/${entityId}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
  // Rate-limit guard: Replicate free tier ~5 req/min, 1 burst
  await sleep(11000);
}

async function main() {
  console.log(`\n🏎  Seeding F1 assets — season ${YEAR}\n`);

  // ── Drivers ──────────────────────────────────────────────────────────────
  const driversRaw = await fetchJson(`${JOLPICA}/${YEAR}/drivers.json?limit=30`) as {
    MRData?: { DriverTable?: { Drivers?: { driverId: string }[] } };
  };
  const drivers = driversRaw?.MRData?.DriverTable?.Drivers ?? [];

  // Map driverId → constructorId via standings
  const standingsRaw = await fetchJson(`${JOLPICA}/${YEAR}/driverStandings.json?limit=30`) as {
    MRData?: { StandingsTable?: { StandingsLists?: { DriverStandings?: { Driver: { driverId: string }; Constructors: { constructorId: string }[] }[] }[] } };
  };
  const driverStandings =
    standingsRaw?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
  const driverTeam = new Map<string, string>();
  for (const s of driverStandings) {
    if (s.Driver?.driverId && s.Constructors?.[0]?.constructorId) {
      driverTeam.set(s.Driver.driverId, s.Constructors[0].constructorId);
    }
  }

  console.log(`Drivers: ${drivers.length}`);
  for (const d of drivers) {
    const cid = driverTeam.get(d.driverId) ?? 'unknown';
    const colors = teamColors(cid);
    await processAsset('driver', d.driverId, {
      teamName: cid.replace(/_/g, ' '),
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
    });
  }

  // ── Constructors ─────────────────────────────────────────────────────────
  const constructorsRaw = await fetchJson(`${JOLPICA}/${YEAR}/constructors.json?limit=20`) as {
    MRData?: { ConstructorTable?: { Constructors?: { constructorId: string; name: string }[] } };
  };
  const constructors = constructorsRaw?.MRData?.ConstructorTable?.Constructors ?? [];

  console.log(`\nTeams: ${constructors.length}`);
  for (const c of constructors) {
    const colors = teamColors(c.constructorId);
    await processAsset('team', c.constructorId, {
      teamName: c.name,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
    });
  }

  // ── Circuits ─────────────────────────────────────────────────────────────
  const circuitsRaw = await fetchJson(`${JOLPICA}/${YEAR}/circuits.json?limit=30`) as {
    MRData?: { CircuitTable?: { Circuits?: { circuitId: string; circuitName: string; Location?: { country?: string } }[] } };
  };
  const circuits = circuitsRaw?.MRData?.CircuitTable?.Circuits ?? [];

  console.log(`\nCircuits: ${circuits.length}`);
  for (const c of circuits) {
    await processAsset('circuit', c.circuitId, {
      circuitName: c.circuitName,
      country: c.Location?.country ?? '',
      timeOfDay: resolveTimeOfDay(c.circuitId),
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = generated + skipped + failed;
  const costUsd = (generated * 0.05).toFixed(2);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Generated : ${generated}
  Skipped   : ${skipped}
  Failed    : ${failed}
  Total     : ${total}
  Est. cost : $${costUsd}  (Flux Pro ~$0.05/image)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n[seed-assets] fatal:', err);
  process.exit(1);
});
