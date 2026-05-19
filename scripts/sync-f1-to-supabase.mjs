/**
 * Upsert committed `public/data/f1/` JSON into Supabase (service role).
 * Run: npm run sync:f1:supabase
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { F1_SEASON_MIN, currentSeasonYear } from './lib/f1-snapshot-paths.mjs';
import { loadEnvLocal } from './lib/load-env-local.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnvLocal(root);

const dataRoot = path.join(root, 'public', 'data', 'f1');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readJson(relPath) {
  const full = path.join(dataRoot, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function hasUsableMrData(json) {
  return Boolean(json && typeof json === 'object' && json.MRData);
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

async function upsertSeasonRow(year, resourceType, payload) {
  const { error } = await supabase.from('f1_season_snapshots').upsert(
    {
      year,
      resource_type: resourceType,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'year,resource_type' },
  );
  if (error) throw new Error(`${resourceType} ${year}: ${error.message}`);
}

async function upsertRoundRow(year, round, suffix, payload) {
  const { error } = await supabase.from('f1_round_snapshots').upsert(
    {
      year,
      round,
      suffix,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'year,round,suffix' },
  );
  if (error) throw new Error(`round ${year}/${round}/${suffix}: ${error.message}`);
}

async function syncSeasonCore(year, { includeRounds }) {
  let seasonCount = 0;
  let roundCount = 0;

  const calendar = readJson(`${year}/calendar.json`);
  if (hasRaces(calendar)) {
    await upsertSeasonRow(year, 'calendar', calendar);
    seasonCount += 1;
  }

  const driverStandings = readJson(`${year}/driverStandings.json`);
  if (hasStandings(driverStandings, 'driver')) {
    await upsertSeasonRow(year, 'driverStandings', driverStandings);
    seasonCount += 1;
  }

  const constructorStandings = readJson(`${year}/constructorStandings.json`);
  if (hasStandings(constructorStandings, 'constructor')) {
    await upsertSeasonRow(year, 'constructorStandings', constructorStandings);
    seasonCount += 1;
  }

  if (!includeRounds) return { seasonCount, roundCount };

  const roundsDir = path.join(dataRoot, String(year), 'rounds');
  if (!fs.existsSync(roundsDir)) return { seasonCount, roundCount };

  for (const roundName of fs.readdirSync(roundsDir)) {
    const round = Number(roundName);
    if (!Number.isFinite(round) || round < 1) continue;
    const roundDir = path.join(roundsDir, roundName);
    if (!fs.statSync(roundDir).isDirectory()) continue;

    for (const file of fs.readdirSync(roundDir)) {
      if (!file.endsWith('.json')) continue;
      const suffix = file.replace(/\.json$/, '');
      const payload = readJson(`${year}/rounds/${round}/${file}`);
      if (!hasUsableMrData(payload)) continue;
      await upsertRoundRow(year, round, suffix, payload);
      roundCount += 1;
    }
  }

  return { seasonCount, roundCount };
}

async function main() {
  const seasonsOnly = process.argv.includes('--seasons-only');
  const maxYear = currentSeasonYear();
  const years = [];
  for (let y = F1_SEASON_MIN; y <= maxYear; y += 1) years.push(y);

  let totalSeason = 0;
  let totalRound = 0;

  for (const year of years) {
    console.log(`Supabase sync ${year}…`);
    const { seasonCount, roundCount } = await syncSeasonCore(year, {
      includeRounds: !seasonsOnly,
    });
    totalSeason += seasonCount;
    totalRound += roundCount;
    console.log(`  ${seasonCount} season rows, ${roundCount} round rows`);
  }

  console.log(
    `Done. ${years.length} seasons → ${totalSeason} season snapshot rows, ${totalRound} round snapshot rows.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
