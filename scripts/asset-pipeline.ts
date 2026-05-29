/**
 * Cloudinary-ready Visual Asset Pipeline
 * Usage: npx tsx scripts/asset-pipeline.ts <command> [options]
 * Commands: discover | rank | stage | approve | plan-upload | verify
 *
 * All scoring/validation functions are exported for unit testing.
 * NO Cloudinary uploads are performed — plan-upload produces a plan only.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetType = 'driver' | 'team' | 'circuit' | 'radio';
export type AssetStatus = 'discovered' | 'ranked' | 'staged' | 'approved' | 'uploaded';

export interface RawCandidate {
  url: string;
  license: string;
  width: number;
  height: number;
  author: string;
  source_page: string;
}

export interface ScoreBreakdown {
  license_trust: number;
  resolution: number;
  aspect_ratio: number;
  has_author: number;
  recency_bonus: number;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  score_breakdown: ScoreBreakdown;
}

export interface AssetEntry {
  asset_type: AssetType;
  entity_id: string;
  display_name: string;
  source_url: string | null;
  source_page: string | null;
  license: string | null;
  attribution: string | null;
  candidates: ScoredCandidate[];
  candidate_score: number;
  local_staged_path: string | null;
  checksum_sha256: string | null;
  staged_at: string | null;
  planned_cloudinary_public_id: string | null;
  planned_cloudinary_folder: string;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  status: AssetStatus;
  discovered_at: string | null;
  ranked_at: string | null;
  uploaded_at: string | null;
  error: string | null;
}

export interface AssetManifest {
  version: number;
  generated_at: string;
  assets: AssetEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface VerifyResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Constants (tunable) ─────────────────────────────────────────────────────

const CLOUDINARY_FOLDER = 'f1-anthology';
const MANIFEST_VERSION = 2;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const WIKIMEDIA_SEARCH_LIMIT = 10;
const INTER_REQUEST_SLEEP_MS = 1500;
const WIKI_UA = 'F1AnthologyAssetPipeline/2.0 (build script; contact via GitHub)';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

// Score weights — change these values to tune ranking
const SCORE_WEIGHTS = {
  licenseCC0: 30,
  licenseCCBY: 25,
  licenseCCBYSA: 22,
  resolutionMin1800: 25,
  resolutionMin1200: 18,
  resolutionMin800: 10,
  aspectRatioMax: 20,
  hasAuthor: 5,
  recencyBonus: 0, // reserved for future date-based scoring
} as const;

// Target aspect ratios per asset type
const TARGET_ASPECT: Record<AssetType, number> = {
  driver: 1.0,
  team: 2.0,
  circuit: 16 / 9,
  radio: 16 / 9,
};

// Only these domains may be fetched (SSRF protection)
const ALLOWED_FETCH_DOMAINS = new Set([
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'en.wikipedia.org',
  'api.jolpi.ca',
]);

const ENTITY_ID_RE = /^[a-z0-9_-]{1,64}$/;

const VALID_STATUSES = new Set<string>([
  'discovered', 'ranked', 'staged', 'approved', 'uploaded',
]);

const VALID_TYPES = new Set<string>([
  'driver', 'team', 'circuit', 'radio',
]);

// Radio assets: editorial content with no standard API
const RADIO_CONFIG: Array<{ entity_id: string; display_name: string; search: string }> = [
  { entity_id: 'red_bull', display_name: 'Red Bull Racing', search: 'Red Bull Racing Formula One team' },
  { entity_id: 'lotus_f1', display_name: 'Lotus F1 Team', search: 'Lotus F1 Team 2012 2013' },
  { entity_id: 'mercedes', display_name: 'Mercedes AMG Petronas', search: 'Mercedes AMG Petronas Formula One' },
  { entity_id: 'ferrari', display_name: 'Scuderia Ferrari', search: 'Scuderia Ferrari Formula One team' },
  { entity_id: 'mclaren', display_name: 'McLaren F1 Team', search: 'McLaren Formula One team' },
  { entity_id: 'renault', display_name: 'Renault F1 Team', search: 'Renault F1 Team Formula One' },
  { entity_id: 'brawn', display_name: 'Brawn GP', search: 'Brawn GP Formula One 2009' },
  { entity_id: 'haas', display_name: 'Haas F1 Team', search: 'Haas F1 Team Formula One' },
];

// ─── ID handling ──────────────────────────────────────────────────────────────

/** Normalize any raw entity ID to lowercase, trimmed. */
export function normalizeEntityId(id: string): string {
  return String(id ?? '').trim().toLowerCase();
}

/** Validate that an entity_id is safe for use in file paths and manifest keys. */
export function validateEntityId(id: string): boolean {
  return ENTITY_ID_RE.test(id);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function scoreLicenseTrust(license: string): number {
  const l = String(license ?? '').toLowerCase().trim();
  if (!l) return 0;
  if (/cc0|cc\s*zero/.test(l) || /public\s*domain|^pd\b/.test(l)) return SCORE_WEIGHTS.licenseCC0;
  if (/cc[\s-]by[\s-]sa/.test(l)) return SCORE_WEIGHTS.licenseCCBYSA;
  if (/cc[\s-]by(?![\s-]sa)/.test(l)) return SCORE_WEIGHTS.licenseCCBY;
  return 0;
}

export function scoreResolution(width: number): number {
  if (width >= 1800) return SCORE_WEIGHTS.resolutionMin1800;
  if (width >= 1200) return SCORE_WEIGHTS.resolutionMin1200;
  if (width >= 800) return SCORE_WEIGHTS.resolutionMin800;
  return 0;
}

export function scoreAspectRatio(width: number, height: number, target: number): number {
  if (!width || !height || !target) return 0;
  const actual = width / height;
  const diff = Math.abs(actual - target) / target;
  return Math.round(SCORE_WEIGHTS.aspectRatioMax * Math.max(0, 1 - Math.min(diff, 1)));
}

export function scoreCandidate(candidate: RawCandidate, type: AssetType): ScoredCandidate {
  const target = TARGET_ASPECT[type];
  const breakdown: ScoreBreakdown = {
    license_trust: scoreLicenseTrust(candidate.license),
    resolution: scoreResolution(candidate.width),
    aspect_ratio: scoreAspectRatio(candidate.width, candidate.height, target),
    has_author: candidate.author ? SCORE_WEIGHTS.hasAuthor : 0,
    recency_bonus: SCORE_WEIGHTS.recencyBonus,
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { ...candidate, score, score_breakdown: breakdown };
}

export function licenseAllowed(license: string): boolean {
  return scoreLicenseTrust(license) > 0;
}

// ─── Manifest schema validation ───────────────────────────────────────────────

export function validateManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  const m = manifest as Record<string, unknown>;
  if (typeof m['version'] !== 'number') errors.push('version must be a number');
  if (typeof m['generated_at'] !== 'string') errors.push('generated_at must be a string');
  if (!Array.isArray(m['assets'])) {
    errors.push('assets must be an array');
    return { valid: false, errors };
  }
  const assets = m['assets'] as Record<string, unknown>[];
  for (let i = 0; i < assets.length; i++) {
    const e = assets[i];
    const p = `assets[${i}]`;
    if (!VALID_TYPES.has(String(e['asset_type'] ?? ''))) {
      errors.push(`${p}.asset_type invalid: "${e['asset_type']}"`);
    }
    if (!validateEntityId(String(e['entity_id'] ?? ''))) {
      errors.push(`${p}.entity_id invalid: "${e['entity_id']}"`);
    }
    if (!VALID_STATUSES.has(String(e['status'] ?? ''))) {
      errors.push(`${p}.status invalid: "${e['status']}"`);
    }
    const score = Number(e['candidate_score']);
    if (!isNaN(score) && (score < 0 || score > 100)) {
      errors.push(`${p}.candidate_score out of range: ${score}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ─── Manifest I/O ─────────────────────────────────────────────────────────────

export function loadManifest(filePath: string): AssetManifest {
  if (!fs.existsSync(filePath)) {
    return { version: MANIFEST_VERSION, generated_at: new Date().toISOString(), assets: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as AssetManifest;
}

export function saveManifest(filePath: string, manifest: AssetManifest, dryRun: boolean): void {
  if (dryRun) {
    console.log(`[dry-run] Would write ${manifest.assets.length} assets → ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

// ─── Verify (pure — exported for testing) ────────────────────────────────────

export function runVerify(manifest: AssetManifest): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const entry of manifest.assets) {
    const p = `${entry.asset_type}/${entry.entity_id}`;
    if (!validateEntityId(entry.entity_id)) errors.push(`${p}: entity_id fails validation`);
    if (!VALID_TYPES.has(entry.asset_type)) errors.push(`${p}: unknown asset_type`);
    const needsFiles: AssetStatus[] = ['staged', 'approved', 'uploaded'];
    if (needsFiles.includes(entry.status)) {
      if (!entry.license) errors.push(`${p}: license empty (status: ${entry.status})`);
      if (!entry.checksum_sha256) errors.push(`${p}: checksum_sha256 missing (status: ${entry.status})`);
      if (!entry.local_staged_path) errors.push(`${p}: local_staged_path missing (status: ${entry.status})`);
    }
    if ((entry.status === 'approved' || entry.status === 'uploaded') && !entry.planned_cloudinary_public_id) {
      errors.push(`${p}: planned_cloudinary_public_id missing (status: ${entry.status})`);
    }
    if (entry.candidate_score > 0 && entry.candidate_score < 40) {
      warnings.push(`${p}: low score ${entry.candidate_score} — manual review recommended`);
    }
  }
  return { passed: errors.length === 0, errors, warnings };
}

// ─── SSRF protection ──────────────────────────────────────────────────────────

export function assertAllowedUrl(url: string): void {
  let hostname: string;
  try { hostname = new URL(url).hostname; }
  catch { throw new Error(`Invalid URL: ${url}`); }
  if (!ALLOWED_FETCH_DOMAINS.has(hostname)) {
    throw new Error(`Domain not in allowlist: ${hostname}`);
  }
}

// ─── Network ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  assertAllowedUrl(url);
  let delay = 2000;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (res.status !== 429) return res;
    console.warn(`[rate-limit] retrying in ${delay}ms: ${url}`);
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }
  return fetch(url, { headers: { 'User-Agent': WIKI_UA } });
}

async function fetchJolpicaJson<T>(p: string): Promise<T> {
  const url = `${JOLPICA_BASE}/${p}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Jolpica HTTP ${res.status} for ${p}`);
  return res.json() as Promise<T>;
}

export async function fetchJolpicaDrivers(year: number): Promise<Array<{ code: string; name: string }>> {
  const data = await fetchJolpicaJson<Record<string, unknown>>(`${year}/driverStandings.json?limit=40`);
  const mrdata = data['MRData'] as Record<string, unknown> | undefined;
  const table = mrdata?.['StandingsTable'] as Record<string, unknown> | undefined;
  const lists = table?.['StandingsLists'] as unknown[] | undefined;
  const first = (lists?.[0] ?? {}) as Record<string, unknown>;
  const rows = (first['DriverStandings'] as Record<string, unknown>[]) ?? [];
  return rows.flatMap((s) => {
    const d = s['Driver'] as Record<string, string> | undefined;
    const code = normalizeEntityId(String(d?.['code'] ?? ''));
    if (!code) return [];
    const name = `${d?.['givenName'] ?? ''} ${d?.['familyName'] ?? ''}`.trim() || code;
    return [{ code, name }];
  });
}

export async function fetchJolpicaTeams(year: number): Promise<Array<{ constructorId: string; name: string }>> {
  const data = await fetchJolpicaJson<Record<string, unknown>>(`${year}/constructorStandings.json?limit=20`);
  const mrdata = data['MRData'] as Record<string, unknown> | undefined;
  const table = mrdata?.['StandingsTable'] as Record<string, unknown> | undefined;
  const lists = table?.['StandingsLists'] as unknown[] | undefined;
  const first = (lists?.[0] ?? {}) as Record<string, unknown>;
  const rows = (first['ConstructorStandings'] as Record<string, unknown>[]) ?? [];
  return rows.flatMap((s) => {
    const c = s['Constructor'] as Record<string, string> | undefined;
    const id = normalizeEntityId(String(c?.['constructorId'] ?? ''));
    if (!id) return [];
    return [{ constructorId: id, name: c?.['name'] ?? id }];
  });
}

export async function fetchJolpicaCircuits(year: number): Promise<Array<{ circuitId: string; name: string; country: string }>> {
  const data = await fetchJolpicaJson<Record<string, unknown>>(`${year}/circuits.json?limit=40`);
  const mrdata = data['MRData'] as Record<string, unknown> | undefined;
  const table = mrdata?.['CircuitTable'] as Record<string, unknown> | undefined;
  const rows = (table?.['Circuits'] as Record<string, unknown>[]) ?? [];
  return rows.flatMap((c) => {
    const id = normalizeEntityId(String(c['circuitId'] ?? ''));
    if (!id) return [];
    const loc = c['Location'] as Record<string, string> | undefined;
    return [{ circuitId: id, name: String(c['circuitName'] ?? id), country: loc?.['country'] ?? '' }];
  });
}

function stripHtml(s: string): string {
  return String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function metaValue(ext: unknown, key: string): string {
  if (!ext || typeof ext !== 'object') return '';
  const m = ext as Record<string, { value?: string }>;
  return String(m[key]?.['value'] ?? '').trim();
}

export async function searchWikimediaCandidates(searchTerm: string, _type: AssetType): Promise<RawCandidate[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrnamespace: '6',
    gsrlimit: String(WIKIMEDIA_SEARCH_LIMIT),
    gsrsearch: `${searchTerm} filetype:bitmap`,
    prop: 'imageinfo|extmetadata',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1800',
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const j = (await res.json()) as { query?: { pages?: Record<string, unknown> } };
  const pages = Object.values(j?.query?.pages ?? {});
  const out: RawCandidate[] = [];
  for (const p of pages) {
    if (!p || typeof p !== 'object') continue;
    const page = p as {
      title?: string;
      imageinfo?: Array<{
        thumburl?: string; url?: string;
        thumbwidth?: number; thumbheight?: number;
        width?: number; height?: number;
        extmetadata?: unknown;
      }>;
    };
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const src = String(info.thumburl ?? info.url ?? '');
    if (!src) continue;
    if (/\.(svg|pdf|djvu|webm|ogv)(\?|#|$)/i.test(src)) continue;
    try { assertAllowedUrl(src); } catch { continue; }
    const width = Number(info.thumbwidth ?? info.width ?? 0);
    const height = Number(info.thumbheight ?? info.height ?? 0);
    if (width < 480 || height < 320) continue;
    const ext = info.extmetadata ?? {};
    const license = metaValue(ext, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const author = stripHtml(metaValue(ext, 'Artist') || metaValue(ext, 'Credit'));
    const fileTitle = String(page.title ?? '').replace(/^File:/, '').replace(/ /g, '_');
    const source_page = fileTitle
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}`
      : '';
    out.push({ url: src, license, width, height, author, source_page });
  }
  return out;
}

// ─── Staging ──────────────────────────────────────────────────────────────────

export async function downloadToStaging(url: string, destPath: string): Promise<string> {
  assertAllowedUrl(url);
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error('downloaded file too small');
  if (buf.length > MAX_FILE_SIZE_BYTES) throw new Error(`file too large: ${buf.length} bytes`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function computeFileHash(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const _scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(_scriptDir, '..');
const MANIFEST_PATH = path.join(ROOT, 'scripts', 'data', 'asset-manifest.json');
const STAGING_DIR = path.join(ROOT, 'scripts', 'data', 'staging');
const PUBLIC_MANIFEST_PATH = path.join(ROOT, 'public', 'data', 'asset-manifest.json');
const UPLOAD_PLAN_PATH = path.join(ROOT, 'scripts', 'data', 'upload-plan.json');

function stagingPath(type: AssetType, entityId: string): string {
  return path.join(STAGING_DIR, type, `${entityId}.webp`);
}

function cloudinaryPublicId(type: AssetType, entityId: string): string {
  return `${CLOUDINARY_FOLDER}/${type}/${entityId}`;
}

// ─── Entry builder ────────────────────────────────────────────────────────────

function buildEntry(type: AssetType, id: string, name: string, candidates: ScoredCandidate[]): AssetEntry {
  return {
    asset_type: type, entity_id: id, display_name: name,
    source_url: null, source_page: null, license: null, attribution: null,
    candidates, candidate_score: 0, local_staged_path: null,
    checksum_sha256: null, staged_at: null, planned_cloudinary_public_id: null,
    planned_cloudinary_folder: CLOUDINARY_FOLDER, approved: false,
    approved_at: null, approved_by: null, status: 'discovered',
    discovered_at: new Date().toISOString(), ranked_at: null,
    uploaded_at: null, error: null,
  };
}

// ─── Command: discover ────────────────────────────────────────────────────────

interface DiscoverOpts { type?: AssetType; entityId?: string; dryRun: boolean; year: number; }

async function cmdDiscover(opts: DiscoverOpts): Promise<void> {
  console.log(`\n[discover] year=${opts.year} type=${opts.type ?? 'all'} dry-run=${opts.dryRun}`);
  const manifest = loadManifest(MANIFEST_PATH);
  const existingMap = new Map(manifest.assets.map((a) => [`${a.asset_type}/${a.entity_id}`, a]));
  const toDiscover: Array<{ type: AssetType; id: string; name: string; search: string }> = [];
  const types: AssetType[] = opts.type ? [opts.type] : ['driver', 'team', 'circuit', 'radio'];

  if (types.includes('driver')) {
    try {
      const drivers = await fetchJolpicaDrivers(opts.year);
      for (const d of drivers) {
        if (opts.entityId && d.code !== opts.entityId) continue;
        toDiscover.push({ type: 'driver', id: d.code, name: d.name, search: `${d.name} Formula One driver portrait` });
      }
      await sleep(INTER_REQUEST_SLEEP_MS);
    } catch (err) { console.error('[discover] drivers:', err instanceof Error ? err.message : err); }
  }
  if (types.includes('team')) {
    try {
      const teams = await fetchJolpicaTeams(opts.year);
      for (const t of teams) {
        if (opts.entityId && t.constructorId !== opts.entityId) continue;
        toDiscover.push({ type: 'team', id: t.constructorId, name: t.name, search: `${t.name} Formula One team logo` });
      }
      await sleep(INTER_REQUEST_SLEEP_MS);
    } catch (err) { console.error('[discover] teams:', err instanceof Error ? err.message : err); }
  }
  if (types.includes('circuit')) {
    try {
      const circuits = await fetchJolpicaCircuits(opts.year);
      for (const c of circuits) {
        if (opts.entityId && c.circuitId !== opts.entityId) continue;
        toDiscover.push({ type: 'circuit', id: c.circuitId, name: c.name, search: `${c.name} circuit aerial photograph` });
      }
      await sleep(INTER_REQUEST_SLEEP_MS);
    } catch (err) { console.error('[discover] circuits:', err instanceof Error ? err.message : err); }
  }
  if (types.includes('radio')) {
    for (const r of RADIO_CONFIG) {
      if (opts.entityId && r.entity_id !== opts.entityId) continue;
      toDiscover.push({ type: 'radio', id: r.entity_id, name: r.display_name, search: r.search });
    }
  }

  let added = 0; let updated = 0;
  for (const item of toDiscover) {
    const key = `${item.type}/${item.id}`;
    const existing = existingMap.get(key);
    if (existing && existing.status !== 'discovered') {
      console.log(`[discover] SKIP ${key} (status: ${existing.status})`);
      continue;
    }
    console.log(`[discover] Wikimedia search: ${key}…`);
    await sleep(INTER_REQUEST_SLEEP_MS);
    let raw: RawCandidate[] = [];
    try { raw = await searchWikimediaCandidates(item.search, item.type); }
    catch (err) { console.warn(`[discover] search failed ${key}:`, err instanceof Error ? err.message : err); }
    const scored = raw.map((c) => scoreCandidate(c, item.type));
    const entry = buildEntry(item.type, item.id, item.name, scored);
    if (existing) {
      manifest.assets[manifest.assets.indexOf(existing)] = entry;
      updated++;
    } else {
      manifest.assets.push(entry);
      added++;
    }
    console.log(`[discover] ${key}: ${scored.length} candidates`);
  }
  manifest.generated_at = new Date().toISOString();
  saveManifest(MANIFEST_PATH, manifest, opts.dryRun);
  console.log(`\n[discover] done: ${added} added, ${updated} updated`);
}

// ─── Command: rank ────────────────────────────────────────────────────────────

interface RankOpts { type?: AssetType; entityId?: string; dryRun: boolean; }

async function cmdRank(opts: RankOpts): Promise<void> {
  console.log(`\n[rank] type=${opts.type ?? 'all'} dry-run=${opts.dryRun}`);
  const manifest = loadManifest(MANIFEST_PATH);
  let ranked = 0;
  for (const entry of manifest.assets) {
    if (opts.type && entry.asset_type !== opts.type) continue;
    if (opts.entityId && entry.entity_id !== opts.entityId) continue;
    if (entry.status !== 'discovered') continue;
    if (!entry.candidates.length) {
      console.warn(`[rank] no candidates: ${entry.asset_type}/${entry.entity_id}`);
      continue;
    }
    const sorted = [...entry.candidates].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    entry.candidates = sorted;
    entry.source_url = best.url;
    entry.source_page = best.source_page;
    entry.license = best.license;
    entry.attribution = best.author ? `${best.author} / Wikimedia Commons` : 'Wikimedia Commons';
    entry.candidate_score = best.score;
    entry.status = 'ranked';
    entry.ranked_at = new Date().toISOString();
    console.log(`[rank] ${entry.asset_type}/${entry.entity_id} score=${best.score}`);
    ranked++;
  }
  manifest.generated_at = new Date().toISOString();
  saveManifest(MANIFEST_PATH, manifest, opts.dryRun);
  console.log(`\n[rank] done: ${ranked} ranked`);
}

// ─── Command: stage ───────────────────────────────────────────────────────────

interface StageOpts { type?: AssetType; entityId?: string; force: boolean; dryRun: boolean; }

async function cmdStage(opts: StageOpts): Promise<void> {
  console.log(`\n[stage] force=${opts.force} dry-run=${opts.dryRun}`);
  const manifest = loadManifest(MANIFEST_PATH);
  let staged = 0; let skipped = 0; let failed = 0;
  for (const entry of manifest.assets) {
    if (opts.type && entry.asset_type !== opts.type) continue;
    if (opts.entityId && entry.entity_id !== opts.entityId) continue;
    if (entry.status !== 'ranked') continue;
    if (!entry.source_url) {
      console.warn(`[stage] no source_url: ${entry.asset_type}/${entry.entity_id}`);
      continue;
    }
    const dest = stagingPath(entry.asset_type, entry.entity_id);
    if (!opts.force && fs.existsSync(dest) && fs.statSync(dest).size > 512) {
      const existingHash = computeFileHash(dest);
      if (existingHash === entry.checksum_sha256) {
        console.log(`[stage] SKIP (hash match): ${entry.entity_id}`);
        entry.status = 'staged';
        entry.staged_at = entry.staged_at ?? new Date().toISOString();
        entry.local_staged_path = path.relative(ROOT, dest).replace(/\\/g, '/');
        skipped++;
        continue;
      }
    }
    if (opts.dryRun) {
      console.log(`[dry-run] Would stage: ${entry.asset_type}/${entry.entity_id}`);
      staged++;
      continue;
    }
    try {
      await sleep(INTER_REQUEST_SLEEP_MS);
      const hash = await downloadToStaging(entry.source_url, dest);
      entry.checksum_sha256 = hash;
      entry.local_staged_path = path.relative(ROOT, dest).replace(/\\/g, '/');
      entry.status = 'staged';
      entry.staged_at = new Date().toISOString();
      entry.planned_cloudinary_public_id = cloudinaryPublicId(entry.asset_type, entry.entity_id);
      console.log(`[stage] OK ${entry.asset_type}/${entry.entity_id} (${hash.slice(0, 8)}…)`);
      staged++;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      console.error(`[stage] FAIL ${entry.asset_type}/${entry.entity_id}:`, entry.error);
      failed++;
    }
  }
  manifest.generated_at = new Date().toISOString();
  saveManifest(MANIFEST_PATH, manifest, opts.dryRun);
  console.log(`\n[stage] staged=${staged} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

// ─── Command: approve ─────────────────────────────────────────────────────────

interface ApproveOpts { entityId?: string; all: boolean; dryRun: boolean; }

async function cmdApprove(opts: ApproveOpts): Promise<void> {
  console.log(`\n[approve] entityId=${opts.entityId ?? 'all'} all=${opts.all} dry-run=${opts.dryRun}`);
  const manifest = loadManifest(MANIFEST_PATH);
  const pending = manifest.assets.filter(
    (a) => a.status === 'staged' && (opts.all || a.entity_id === opts.entityId),
  );
  if (!pending.length) { console.log('[approve] Nothing staged to approve.'); return; }
  let count = 0;
  for (const entry of pending) {
    if (opts.dryRun) {
      console.log(`[dry-run] Would approve ${entry.asset_type}/${entry.entity_id} (score: ${entry.candidate_score})`);
    } else {
      entry.approved = true;
      entry.approved_at = new Date().toISOString();
      entry.approved_by = 'cli';
      entry.status = 'approved';
      entry.planned_cloudinary_public_id = cloudinaryPublicId(entry.asset_type, entry.entity_id);
      console.log(`[approve] APPROVED ${entry.asset_type}/${entry.entity_id}`);
    }
    count++;
  }
  manifest.generated_at = new Date().toISOString();
  saveManifest(MANIFEST_PATH, manifest, opts.dryRun);
  console.log(`\n[approve] done: ${count} approved`);
}

// ─── Command: plan-upload ─────────────────────────────────────────────────────

async function cmdPlanUpload(opts: { dryRun: boolean }): Promise<void> {
  console.log(`\n[plan-upload] dry-run=${opts.dryRun}`);
  const manifest = loadManifest(MANIFEST_PATH);
  const approved = manifest.assets.filter((a) => a.approved && a.status === 'approved');
  const plan = {
    generated_at: new Date().toISOString(),
    note: 'Upload DISABLED. Set CLOUDINARY_URL and add upload command to activate.',
    upload_count: approved.length,
    items: approved.map((a) => ({
      asset_type: a.asset_type, entity_id: a.entity_id, display_name: a.display_name,
      local_staged_path: a.local_staged_path,
      planned_cloudinary_public_id: a.planned_cloudinary_public_id,
      license: a.license, attribution: a.attribution, checksum_sha256: a.checksum_sha256,
    })),
  };
  if (opts.dryRun) {
    console.log(`[dry-run] Upload plan: ${plan.upload_count} items`);
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  fs.mkdirSync(path.dirname(UPLOAD_PLAN_PATH), { recursive: true });
  fs.writeFileSync(UPLOAD_PLAN_PATH, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  console.log(`[plan-upload] written: ${UPLOAD_PLAN_PATH} (${plan.upload_count} items)`);
  const runtime: AssetManifest = { ...manifest, assets: manifest.assets.filter((a) => a.approved) };
  fs.mkdirSync(path.dirname(PUBLIC_MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(PUBLIC_MANIFEST_PATH, JSON.stringify(runtime, null, 2) + '\n', 'utf8');
  console.log(`[plan-upload] runtime manifest: ${PUBLIC_MANIFEST_PATH} (${runtime.assets.length} entries)`);
}

// ─── Command: verify ──────────────────────────────────────────────────────────

async function cmdVerify(opts: { strict: boolean }): Promise<void> {
  console.log(`\n[verify] strict=${opts.strict}`);
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[verify] FAIL: manifest not found at ${MANIFEST_PATH}`);
    process.exit(2);
  }
  let manifest: AssetManifest;
  try { manifest = loadManifest(MANIFEST_PATH); }
  catch (err) {
    console.error('[verify] FAIL: parse error:', err instanceof Error ? err.message : err);
    process.exit(2);
  }
  const schema = validateManifest(manifest);
  if (!schema.valid) {
    for (const e of schema.errors) console.error(`[verify] schema: ${e}`);
    process.exit(1);
  }
  const result = runVerify(manifest);
  for (const w of result.warnings) console.warn(`[verify] WARN: ${w}`);
  for (const e of result.errors) console.error(`[verify] FAIL: ${e}`);
  let hashErrors = 0;
  for (const entry of manifest.assets) {
    if (!entry.local_staged_path || !entry.checksum_sha256) continue;
    const abs = path.join(ROOT, entry.local_staged_path);
    if (!fs.existsSync(abs)) {
      const msg = `staged file missing: ${abs}`;
      if (opts.strict) { console.error(`[verify] FAIL: ${msg}`); hashErrors++; }
      else { console.warn(`[verify] WARN: ${msg}`); }
      continue;
    }
    if (computeFileHash(abs) !== entry.checksum_sha256) {
      console.error(`[verify] FAIL: hash mismatch ${entry.asset_type}/${entry.entity_id}`);
      hashErrors++;
    }
  }
  if (result.passed && hashErrors === 0) {
    console.log(`\n[verify] PASS: ${manifest.assets.length} assets`);
    process.exit(0);
  } else {
    console.error(`\n[verify] FAIL: ${result.errors.length + hashErrors} error(s)`);
    process.exit(1);
  }
}

// ─── CLI dispatcher ───────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; opts: Record<string, unknown> } {
  const args = argv.slice(2);
  const command = args[0] ?? '';
  const opts: Record<string, unknown> = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') { opts['dryRun'] = true; continue; }
    if (a === '--force') { opts['force'] = true; continue; }
    if (a === '--strict') { opts['strict'] = true; continue; }
    if (a === '--all') { opts['all'] = true; continue; }
    if (a.startsWith('--type=')) { opts['type'] = a.slice(7); continue; }
    if (a === '--type' && args[i + 1]) { opts['type'] = args[++i]; continue; }
    if (a.startsWith('--entity-id=')) { opts['entityId'] = a.slice(12); continue; }
    if (a === '--entity-id' && args[i + 1]) { opts['entityId'] = args[++i]; continue; }
    if (a.startsWith('--year=')) { opts['year'] = parseInt(a.slice(7), 10); continue; }
    if (a === '--year' && args[i + 1]) { opts['year'] = parseInt(args[++i], 10); continue; }
  }
  return { command, opts };
}

async function main(): Promise<void> {
  const { command, opts } = parseArgs(process.argv);
  const year = (opts['year'] as number | undefined) ?? new Date().getFullYear();
  const dryRun = Boolean(opts['dryRun']);
  switch (command) {
    case 'discover':
      await cmdDiscover({ type: opts['type'] as AssetType | undefined, entityId: opts['entityId'] as string | undefined, dryRun, year });
      break;
    case 'rank':
      await cmdRank({ type: opts['type'] as AssetType | undefined, entityId: opts['entityId'] as string | undefined, dryRun });
      break;
    case 'stage':
      await cmdStage({ type: opts['type'] as AssetType | undefined, entityId: opts['entityId'] as string | undefined, force: Boolean(opts['force']), dryRun });
      break;
    case 'approve':
      await cmdApprove({ entityId: opts['entityId'] as string | undefined, all: Boolean(opts['all']), dryRun });
      break;
    case 'plan-upload':
      await cmdPlanUpload({ dryRun });
      break;
    case 'verify':
      await cmdVerify({ strict: Boolean(opts['strict']) });
      break;
    default:
      console.error(`Unknown command: "${command}"\nUsage: asset-pipeline.ts <discover|rank|stage|approve|plan-upload|verify>`);
      process.exit(2);
  }
}

// Only run when invoked directly, not when imported in tests
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('[asset-pipeline] fatal:', err);
    process.exit(2);
  });
}
