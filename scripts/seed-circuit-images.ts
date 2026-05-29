/**
 * Seed Cloudinary with F1 2025 circuit aerial images sourced from Wikimedia Commons.
 * Run: npm run seed:circuits
 *
 * Uses only CLOUDINARY_URL from .env.local. Skips circuits already uploaded.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

for (const name of ['.env', '.env.local']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Circuit list
// ---------------------------------------------------------------------------
const CIRCUITS: Record<string, string> = {
  albert_park: 'Albert Park Circuit Formula One',
  shanghai: 'Shanghai International Circuit',
  suzuka: 'Suzuka Circuit aerial',
  bahrain: 'Bahrain International Circuit aerial',
  jeddah: 'Jeddah Corniche Circuit night',
  miami: 'Miami International Autodrome aerial',
  imola: 'Autodromo Enzo Dino Ferrari Imola aerial',
  monaco: 'Circuit de Monaco aerial',
  barcelona: 'Circuit de Barcelona-Catalunya aerial',
  villeneuve: 'Circuit Gilles Villeneuve Montreal aerial',
  red_bull_ring: 'Red Bull Ring Spielberg aerial',
  silverstone: 'Silverstone Circuit aerial',
  spa: 'Circuit de Spa-Francorchamps aerial',
  hungaroring: 'Hungaroring aerial',
  zandvoort: 'Circuit Zandvoort aerial',
  monza: 'Autodromo Nazionale Monza aerial',
  baku: 'Baku City Circuit street',
  marina_bay: 'Marina Bay Street Circuit night',
  cota: 'Circuit of the Americas aerial',
  rodriguez: 'Autodromo Hermanos Rodriguez aerial',
  interlagos: 'Autodromo Jose Carlos Pace Interlagos aerial',
  las_vegas: 'Las Vegas Strip Circuit night',
  lusail: 'Lusail International Circuit aerial',
  yas_marina: 'Yas Marina Circuit aerial',
};

const FOLDER = 'f1-anthology';
const WIKI_UA = 'F1AnthologyCircuitSeed/1.0 (build script; contact via GitHub)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let delay = 2000;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (res.status !== 429) return res;
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }
  return fetch(url, { headers: { 'User-Agent': WIKI_UA } });
}

async function wikimediaImageUrl(searchTerm: string): Promise<string | null> {
  // Step 1 — Wikipedia pageimages (exact-title lookup)
  const wpUrl =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(searchTerm)}` +
    `&prop=pageimages&piprop=original&format=json`;

  const wpRes = await fetchWithRetry(wpUrl);
  if (wpRes.ok) {
    const data = (await wpRes.json()) as {
      query?: { pages?: Record<string, { missing?: unknown; original?: { source: string } }> };
    };
    for (const page of Object.values(data?.query?.pages ?? {})) {
      if ('missing' in page) continue;
      if (page.original?.source) return page.original.source;
    }
  }

  await sleep(1000);

  // Step 2 — Commons file search fallback
  const csUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&format=json`;

  const csRes = await fetchWithRetry(csUrl);
  if (!csRes.ok) return null;

  const csData = (await csRes.json()) as {
    query?: { search?: Array<{ title: string }> };
  };
  const hits = csData?.query?.search ?? [];
  if (!hits.length) return null;

  const fileTitle = hits[0].title; // "File:Albert_Park_Circuit.jpg"

  await sleep(800);

  const infoUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`;

  const infoRes = await fetchWithRetry(infoUrl);
  if (!infoRes.ok) return null;

  const infoData = (await infoRes.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ url: string }> }> };
  };
  for (const page of Object.values(infoData?.query?.pages ?? {})) {
    const url = page.imageinfo?.[0]?.url;
    if (url) return url;
  }

  return null;
}

async function cloudinaryExists(publicId: string): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId, { resource_type: 'image' });
    return true;
  } catch {
    return false;
  }
}

function uploadBuffer(buffer: Buffer, publicId: string): Promise<{ secure_url: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        format: 'webp',
        quality: 'auto:best',
        transformation: [
          { width: 1280, height: 720, crop: 'fill', gravity: 'auto', effect: 'contrast:10' },
        ],
        overwrite: false,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result as { secure_url: string });
      },
    );
    stream.end(buffer);
  });
}

// ---------------------------------------------------------------------------
// Per-circuit
// ---------------------------------------------------------------------------
async function processCircuit(circuitId: string, searchTerm: string): Promise<void> {
  const publicId = `${FOLDER}/circuit/${circuitId}`;

  if (await cloudinaryExists(publicId)) {
    console.log(`SKIP     ${circuitId}`);
    return;
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await wikimediaImageUrl(searchTerm);
  } catch (err) {
    console.log(`FAILED   ${circuitId}: wikimedia — ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!imageUrl) {
    console.log(`FAILED   ${circuitId}: no image found for "${searchTerm}"`);
    return;
  }

  let buffer: Buffer;
  try {
    const res = await fetchWithRetry(imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1024) throw new Error('response too small');
  } catch (err) {
    console.log(`FAILED   ${circuitId}: download — ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  try {
    const result = await uploadBuffer(buffer, publicId);
    console.log(`UPLOADED ${circuitId} → ${result.secure_url}`);
  } catch (err) {
    console.log(`FAILED   ${circuitId}: cloudinary — ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is not set. Add it to .env.local and retry.');
    process.exit(1);
  }

  const entries = Object.entries(CIRCUITS);
  console.log(`\nSeeding ${entries.length} F1 2025 circuit images → Cloudinary (f1-anthology/circuit/*)\n`);

  for (const [circuitId, searchTerm] of entries) {
    await processCircuit(circuitId, searchTerm);
    await sleep(1500);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('[seed-circuit-images] fatal:', err);
  process.exit(1);
});
