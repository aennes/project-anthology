/**
 * Mirror Wikimedia-sourced circuit covers + gallery stills into public/circuits/
 * and emit public/data/circuit-images.json (paths, alt text, attribution).
 *
 * Legal: only downloads when Commons extmetadata LicenseShortName matches allow-list
 * (CC / CC0 / Public domain). No Formula 1 broadcast or press-kit hotlinking.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CIRCUIT_IMAGE_SOURCES } from './circuit-image-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const circuitsDir = path.join(root, 'public', 'circuits');
const galleryRoot = path.join(circuitsDir, 'gallery');
const manifestPath = path.join(root, 'public', 'data', 'circuit-images.json');

const GALLERY_TARGET = 3;
const COVER_THUMB = 1400;
const GALLERY_THUMB = 1200;

const ALLOWED_LICENSE = [
  /^cc\s*by(\s|$|-)/i,
  /^cc\s*by-sa/i,
  /^cc0/i,
  /^cc\s*zero/i,
  /^public\s*domain/i,
  /^pd\b/i,
];

function licenseAllowed(shortName) {
  const s = String(shortName || '').trim();
  if (!s) return false;
  if (/all rights reserved|copyrighted|fair use|non-free|gfdl only/i.test(s)) return false;
  return ALLOWED_LICENSE.some((re) => re.test(s));
}

function metaValue(ext, key) {
  const v = ext?.[key]?.value;
  return typeof v === 'string' ? v.trim() : '';
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIKI_HEADERS = {
  'User-Agent': 'AnthologyCircuitAtlas/1.0 (https://github.com/; local build script)',
};

async function fetchWithRetry(url, opts = {}, attempts = 4) {
  let delay = 2000;
  for (let i = 0; i < attempts; i += 1) {
    const r = await fetch(url, { ...opts, headers: { ...WIKI_HEADERS, ...opts.headers } });
    if (r.status !== 429) return r;
    await sleep(delay);
    delay = Math.min(delay * 2, 30000);
  }
  return fetch(url, { ...opts, headers: { ...WIKI_HEADERS, ...opts.headers } });
}

function trimAlt(text, max = 140) {
  const t = stripHtml(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

async function wikiCoverThumb(titles) {
  for (const title of titles) {
    const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=${COVER_THUMB}&titles=${encodeURIComponent(title)}`;
    const r = await fetchWithRetry(api);
    if (!r.ok) continue;
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const page = pages[Object.keys(pages)[0]];
    const src = page?.thumbnail?.source;
    if (src && !page?.missing) return { url: src, title };
  }
  return null;
}

async function commonsSearchImages(search, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${search} circuit filetype:bitmap`,
    gsrlimit: String(limit),
    prop: 'imageinfo|extmetadata',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(GALLERY_THUMB),
  });
  const r = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!r.ok) return [];
  const j = await r.json();
  const pages = j?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const out = [];
  for (const page of Object.values(pages)) {
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl && !info?.url) continue;
    const mime = String(info.mime || '').toLowerCase();
    if (mime && !/^image\/(jpeg|jpg|png|webp|gif)/.test(mime)) continue;
    const fileTitle = page.title?.replace(/^File:/, '') || '';
    if (/\.(svg|djvu|webm|ogv|pdf)$/i.test(fileTitle)) continue;
    const ext = info.extmetadata || {};
    const license = metaValue(ext, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const author = stripHtml(metaValue(ext, 'Artist') || metaValue(ext, 'Credit'));
    const desc = stripHtml(metaValue(ext, 'ImageDescription'));
    out.push({
      url: info.thumburl || info.url,
      license,
      author: author || 'Wikimedia contributor',
      description: desc,
      page: fileTitle
        ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle.replace(/ /g, '_'))}`
        : '',
      fileTitle,
    });
  }
  return out;
}

async function downloadToFile(url, dest) {
  const r = await fetchWithRetry(url, { referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 512) throw new Error('file too small');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function layoutForIndex(i) {
  if (i === 0) return 'full';
  if (i % 2 === 1) return 'landscape';
  return 'portrait';
}

async function main() {
  fs.mkdirSync(circuitsDir, { recursive: true });
  fs.mkdirSync(galleryRoot, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  /** @type {Record<string, { cover?: string, gallery: Array<object> }>} */
  const circuits = {};
  let coversOk = 0;
  let galleryOk = 0;

  for (const entry of CIRCUIT_IMAGE_SOURCES) {
    const { id, wikiTitles, commonsSearch } = entry;
    circuits[id] = { gallery: [] };

    const coverDest = path.join(circuitsDir, `${id}.webp`);
    try {
      if (!(fs.existsSync(coverDest) && fs.statSync(coverDest).size > 1024)) {
        await sleep(1200);
        const thumb = await wikiCoverThumb(wikiTitles);
        if (thumb?.url) {
          await sleep(800);
          await downloadToFile(thumb.url, coverDest);
          console.log(`cover: ${id}.webp`);
        } else {
          console.warn(`cover: no Wikipedia thumb for ${id}`);
        }
      } else {
        console.log(`cover: skip ${id}.webp (exists)`);
      }
      if (fs.existsSync(coverDest) && fs.statSync(coverDest).size > 1024) {
        circuits[id].cover = `/circuits/${id}.webp`;
        coversOk += 1;
      }
    } catch (err) {
      console.warn(`cover: ${id}`, err instanceof Error ? err.message : err);
    }

    const galleryDir = path.join(galleryRoot, id);
    let picks = [];
    try {
      await sleep(1500);
      picks = await commonsSearchImages(commonsSearch || wikiTitles[0], 10);
    } catch (err) {
      console.warn(`gallery search: ${id}`, err instanceof Error ? err.message : err);
    }

    let idx = 0;
    for (const pick of picks) {
      if (idx >= GALLERY_TARGET) break;
      const file = `${String(idx + 1).padStart(2, '0')}.webp`;
      const rel = `/circuits/gallery/${id}/${file}`;
      const dest = path.join(galleryDir, file);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
        circuits[id].gallery.push({
          src: rel,
          alt: trimAlt(pick.description) || `${wikiTitles[0]} — track view`,
          layout: layoutForIndex(idx),
          credit: {
            author: pick.author,
            license: pick.license,
            page: pick.page,
          },
        });
        idx += 1;
        galleryOk += 1;
        continue;
      }
      try {
        await sleep(1800);
        await downloadToFile(pick.url, dest);
        circuits[id].gallery.push({
          src: rel,
          alt: trimAlt(pick.description) || `${wikiTitles[0]} — track view`,
          layout: layoutForIndex(idx),
          credit: {
            author: pick.author,
            license: pick.license,
            page: pick.page,
          },
        });
        console.log(`gallery: ${id}/${file}`);
        idx += 1;
        galleryOk += 1;
      } catch (err) {
        console.warn(`gallery: ${id}/${file}`, err instanceof Error ? err.message : err);
      }
    }
  }

  const manifest = {
    version: 1,
    attributionNote:
      'Photography hosted locally from Wikimedia Commons where credited. Re-run npm run images:circuit-images to refresh.',
    circuits,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(
    `fetch-circuit-images: ${coversOk} covers, ${galleryOk} gallery files → ${path.relative(root, manifestPath)}`,
  );
  process.exit(coversOk > 0 ? 0 : 1);
}

main();
