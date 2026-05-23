/**
 * Mirror Wikimedia-sourced team logos + driver portraits into public/images/
 * and emit public/data/season-tracker-images.json (paths, alt text, attribution).
 *
 * Legal: only downloads when Commons extmetadata LicenseShortName matches allow-list
 * (CC / CC0 / Public domain). Runtime may still use OpenF1 headshot_url (Formula 1 media CDN)
 * when self-hosted assets are missing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DRIVER_HEADSHOT_SOURCES, TEAM_LOGO_SOURCES } from './season-tracker-image-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const teamsDir = path.join(root, 'public', 'images', 'teams');
const driversDir = path.join(root, 'public', 'images', 'drivers');
const manifestPath = path.join(root, 'public', 'data', 'season-tracker-images.json');

const TEAM_THUMB = 320;
const DRIVER_THUMB = 264;

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
  'User-Agent': 'AnthologySeasonTracker/1.0 (https://github.com/; local build script)',
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

async function downloadToFile(url, dest) {
  const r = await fetchWithRetry(url, { referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 256) throw new Error('file too small');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function wikiTeamLogoThumb(wikiTitles) {
  for (const title of wikiTitles) {
    const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=${TEAM_THUMB}&titles=${encodeURIComponent(title)}`;
    const r = await fetchWithRetry(api);
    if (!r.ok) continue;
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const page = pages[Object.keys(pages)[0]];
    const src = page?.thumbnail?.source;
    if (src && !page?.missing) return { url: src, page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
  }
  return null;
}

async function commonsSearchTeamLogo(search, limit = 10) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${search} logo`,
    gsrlimit: String(limit),
    prop: 'imageinfo|extmetadata',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: String(TEAM_THUMB),
  });
  const r = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!r.ok) return [];
  const j = await r.json();
  const pages = j?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const out = [];
  for (const page of Object.values(pages)) {
    const title = page.title || '';
    if (!/logo|wordmark|emblem/i.test(title)) continue;
    if (/car|chassis|helmet|livery|garage|pit/i.test(title)) continue;
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl && !info?.url) continue;
    const ext = info.extmetadata || {};
    const license = metaValue(ext, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const fileTitle = page.title?.replace(/^File:/, '') || '';
    out.push({
      url: info.thumburl || info.url,
      license,
      page: fileTitle
        ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle.replace(/ /g, '_'))}`
        : '',
    });
  }
  return out;
}

async function commonsSearchDriverPortrait(name, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${name} Formula One driver`,
    gsrlimit: String(limit),
    prop: 'imageinfo|extmetadata',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: String(DRIVER_THUMB),
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
    const title = page.title || '';
    if (/helmet|car|chassis|podium group|team photo|starting grid/i.test(title)) continue;
    const ext = info.extmetadata || {};
    const license = metaValue(ext, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const author = stripHtml(metaValue(ext, 'Artist') || metaValue(ext, 'Credit'));
    const fileTitle = page.title?.replace(/^File:/, '') || '';
    out.push({
      url: info.thumburl || info.url,
      license,
      author: author || 'Wikimedia contributor',
      page: fileTitle
        ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle.replace(/ /g, '_'))}`
        : '',
    });
  }
  return out;
}

async function main() {
  fs.mkdirSync(teamsDir, { recursive: true });
  fs.mkdirSync(driversDir, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  /** @type {Record<string, object>} */
  const teams = {};
  /** @type {Record<string, object>} */
  const drivers = {};
  let teamsOk = 0;
  let driversOk = 0;

  for (const entry of TEAM_LOGO_SOURCES) {
    const { slug, wikiTitles, commonsSearch, alt } = entry;
    const dest = path.join(teamsDir, `${slug}.webp`);
    try {
      if (!(fs.existsSync(dest) && fs.statSync(dest).size > 512)) {
        await sleep(700);
        let pick = await wikiTeamLogoThumb(wikiTitles);
        if (!pick?.url) {
          await sleep(500);
          const picks = await commonsSearchTeamLogo(commonsSearch, 12);
          pick = picks[0] || null;
        }
        if (pick?.url) {
          await sleep(400);
          await downloadToFile(pick.url, dest);
          console.log(`team: ${slug}.webp`);
        } else {
          console.warn(`team: no logo for ${slug}`);
        }
      } else {
        console.log(`team: skip ${slug}.webp (exists)`);
      }
      if (fs.existsSync(dest) && fs.statSync(dest).size > 512) {
        teams[slug] = {
          path: `/images/teams/${slug}.webp`,
          alt,
        };
        teamsOk += 1;
      }
    } catch (err) {
      console.warn(`team: ${slug}`, err instanceof Error ? err.message : err);
    }
  }

  const seenCodes = new Set();
  for (const entry of DRIVER_HEADSHOT_SOURCES) {
    const code = String(entry.code || '')
      .trim()
      .toUpperCase();
    if (!code || seenCodes.has(code)) continue;
    seenCodes.add(code);
    const { name } = entry;
    const dest = path.join(driversDir, `${code}.webp`);
    const alt = `${name} — Formula One driver portrait`;
    try {
      if (!(fs.existsSync(dest) && fs.statSync(dest).size > 512)) {
        await sleep(900);
        let picks = await commonsSearchDriverPortrait(name, 10);
        if (!picks.length) {
          await sleep(500);
          picks = await commonsSearchDriverPortrait(`${name} portrait`, 8);
        }
        const pick = picks[0];
        if (pick?.url) {
          await sleep(450);
          await downloadToFile(pick.url, dest);
          console.log(`driver: ${code}.webp`);
        } else {
          console.warn(`driver: no Commons portrait for ${code} (${name})`);
        }
      } else {
        console.log(`driver: skip ${code}.webp (exists)`);
      }
      if (fs.existsSync(dest) && fs.statSync(dest).size > 512) {
        drivers[code] = { path: `/images/drivers/${code}.webp`, alt };
        driversOk += 1;
      }
    } catch (err) {
      console.warn(`driver: ${code}`, err instanceof Error ? err.message : err);
    }
  }

  const manifest = {
    version: 1,
    attributionNote:
      'Team logos and driver portraits mirrored from Wikimedia Commons (CC / public domain). Re-run npm run images:season-tracker to refresh. Live headshots may also use OpenF1 headshot_url (Formula 1 media CDN).',
    teams,
    drivers,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(
    `fetch-season-tracker-images: ${teamsOk} teams, ${driversOk} drivers → ${path.relative(root, manifestPath)}`,
  );
  process.exit(teamsOk > 0 || driversOk > 0 ? 0 : 1);
}

main();
