/**
 * Mirror Wikimedia-sourced Radio Anthology covers + gallery stills into public/images/radio/
 * and emit public/data/radio-images.json (paths, alt text, attribution).
 *
 * Legal: only downloads when Commons extmetadata LicenseShortName matches allow-list
 * (CC / CC0 / Public domain). No F1 broadcast or press-kit hotlinking.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RADIO_IMAGE_SOURCES } from './radio-image-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const radioRoot = path.join(root, 'public', 'images', 'radio');
const manifestPath = path.join(root, 'public', 'data', 'radio-images.json');

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

async function commonsSearchImages(search, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${search} Formula One`,
    gsrlimit: String(limit),
    prop: 'imageinfo|extmetadata',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(GALLERY_THUMB),
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!r.ok) return [];
  const j = await r.json();
  const pages = j?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const out = [];
  for (const page of Object.values(pages)) {
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl && !info?.url) continue;
    const ext = info.extmetadata || {};
    const license = metaValue(ext, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const title = page.title || '';
    if (/circuit|track map|layout|svg|diagram/i.test(title)) continue;
    const author = stripHtml(metaValue(ext, 'Artist') || metaValue(ext, 'Credit'));
    const desc = stripHtml(metaValue(ext, 'ImageDescription'));
    const fileTitle = page.title?.replace(/^File:/, '') || '';
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
  const r = await fetch(url);
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
  fs.mkdirSync(radioRoot, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  /** @type {Record<string, object>} */
  const episodes = {};
  let coversOk = 0;
  let galleryOk = 0;

  for (const entry of RADIO_IMAGE_SOURCES) {
    const { id, coverSearch, gallerySearch = [], anthologyCover } = entry;
    episodes[id] = { gallery: [] };
    const epDir = path.join(radioRoot, id);
    const coverDest = path.join(epDir, 'cover.webp');

    try {
      if (!(fs.existsSync(coverDest) && fs.statSync(coverDest).size > 1024)) {
        await sleep(800);
        const picks = await commonsSearchImages(coverSearch, 6);
        const pick = picks[0];
        if (pick?.url) {
          await sleep(400);
          await downloadToFile(pick.url, coverDest);
          episodes[id].coverCredit = {
            author: pick.author,
            license: pick.license,
            page: pick.page,
          };
          episodes[id].coverAlt = pick.description || coverSearch;
          console.log(`cover: ${id}/cover.webp`);
        } else if (anthologyCover) {
          console.warn(`cover: no Commons hit for ${id}, using anthology fallback path in manifest only`);
        } else {
          console.warn(`cover: no Commons thumb for ${id}`);
        }
      } else {
        console.log(`cover: skip ${id}/cover.webp (exists)`);
      }
      if (fs.existsSync(coverDest) && fs.statSync(coverDest).size > 1024) {
        episodes[id].cover = `/images/radio/${id}/cover.webp`;
        coversOk += 1;
      } else if (anthologyCover) {
        episodes[id].cover = anthologyCover;
        episodes[id].coverAlt = coverSearch;
        episodes[id].coverCredit = { note: 'Project Anthology licensed still (see main archive)' };
        coversOk += 1;
      }
    } catch (err) {
      console.warn(`cover: ${id}`, err instanceof Error ? err.message : err);
      if (anthologyCover) {
        episodes[id].cover = anthologyCover;
        episodes[id].coverAlt = coverSearch;
        coversOk += 1;
      }
    }

    const seen = new Set();
    let idx = 0;
    for (const term of gallerySearch) {
      if (idx >= GALLERY_TARGET) break;
      let picks = [];
      try {
        await sleep(900);
        picks = await commonsSearchImages(term, 8);
      } catch (err) {
        console.warn(`gallery search: ${id}`, err instanceof Error ? err.message : err);
      }
      for (const pick of picks) {
        if (idx >= GALLERY_TARGET) break;
        if (seen.has(pick.fileTitle)) continue;
        seen.add(pick.fileTitle);
        const file = `${String(idx + 1).padStart(2, '0')}.webp`;
        const rel = `/images/radio/${id}/${file}`;
        const dest = path.join(epDir, file);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
          episodes[id].gallery.push({
            src: rel,
            alt: pick.description || term,
            layout: layoutForIndex(idx),
            credit: { author: pick.author, license: pick.license, page: pick.page },
          });
          idx += 1;
          galleryOk += 1;
          continue;
        }
        try {
          await sleep(500);
          await downloadToFile(pick.url, dest);
          episodes[id].gallery.push({
            src: rel,
            alt: pick.description || term,
            layout: layoutForIndex(idx),
            credit: { author: pick.author, license: pick.license, page: pick.page },
          });
          console.log(`gallery: ${id}/${file}`);
          idx += 1;
          galleryOk += 1;
        } catch (err) {
          console.warn(`gallery: ${id}/${file}`, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  const manifest = {
    version: 1,
    attributionNote:
      'Photography hosted locally from Wikimedia Commons where credited, or Project Anthology stills. Re-run npm run images:radio-anthology to refresh.',
    episodes,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(
    `fetch-radio-anthology-images: ${coversOk} covers, ${galleryOk} gallery files → ${path.relative(root, manifestPath)}`,
  );
  process.exit(coversOk > 0 ? 0 : 1);
}

main();
