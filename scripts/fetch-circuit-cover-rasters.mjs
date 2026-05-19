/**
 * Cache Wikimedia circuit cover thumbnails into public/circuits/{id}.webp
 * for faster first paint on Circuit Atlas / Radio Anthology.
 *
 * Attribution: images remain © their Wikimedia Commons contributors; see each file's
 * source page on Wikipedia. This script only mirrors thumbnails already exposed via
 * the Wikipedia API for local static hosting.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'circuits');

/** @type {Array<{ id: string, titles: string[] }>} */
const CIRCUITS = [
  { id: 'monaco', titles: ['Circuit de Monaco', 'Monaco Grand Prix'] },
  { id: 'spa', titles: ['Circuit de Spa-Francorchamps', 'Belgian Grand Prix'] },
  { id: 'monza', titles: ['Autodromo Nazionale Monza', 'Italian Grand Prix'] },
  { id: 'silverstone', titles: ['Silverstone Circuit', 'British Grand Prix'] },
  { id: 'suzuka', titles: ['Suzuka International Racing Course', 'Japanese Grand Prix'] },
  { id: 'interlagos', titles: ['Autódromo José Carlos Pace', 'Brazilian Grand Prix'] },
  { id: 'bahrain', titles: ['Bahrain International Circuit', 'Bahrain Grand Prix'] },
  { id: 'vegas', titles: ['Las Vegas Strip Circuit', 'Las Vegas Grand Prix'] },
];

async function wikiThumb(titles) {
  for (const title of titles) {
    const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=1200&titles=${encodeURIComponent(title)}`;
    const r = await fetch(api);
    if (!r.ok) continue;
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const page = pages[Object.keys(pages)[0]];
    const src = page?.thumbnail?.source;
    if (src && !page?.missing) return src;
  }
  return '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  let ok = 0;
  for (const { id, titles } of CIRCUITS) {
    const dest = path.join(outDir, `${id}.webp`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
      console.log(`fetch-circuit-covers: skip ${id}.webp (exists)`);
      ok += 1;
      continue;
    }
    try {
      await sleep(800);
      const thumbUrl = await wikiThumb(titles);
      if (!thumbUrl) {
        console.warn(`fetch-circuit-covers: no thumb for ${id}`);
        continue;
      }
      await sleep(400);
      const imgRes = await fetch(thumbUrl);
      if (!imgRes.ok) {
        console.warn(`fetch-circuit-covers: download failed ${id} (${imgRes.status})`);
        continue;
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`fetch-circuit-covers: ${id}.webp (${buf.length} bytes)`);
      ok += 1;
    } catch (err) {
      console.warn(`fetch-circuit-covers: ${id}`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`fetch-circuit-covers: wrote ${ok}/${CIRCUITS.length} files → ${path.relative(process.cwd(), outDir)}`);
  process.exit(ok > 0 ? 0 : 1);
}

main();
