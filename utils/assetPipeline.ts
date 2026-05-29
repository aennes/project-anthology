/**
 * Server-side asset pipeline.
 * Checks Cloudinary first; if missing, fetches a copyright-safe Wikimedia image and uploads it.
 * Browser pages call /api/generate-assets — this module is Node-only.
 */
import { v2 as cloudinary } from 'cloudinary';

export type AssetType = 'driver' | 'circuit' | 'team' | 'radio';

export interface AssetMetadata {
  teamName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  circuitName?: string;
  country?: string;
  timeOfDay?: string;
  wikiTitles?: string[];
  commonsSearch?: string;
  searchTerms?: string[];
  [key: string]: unknown;
}

// Cloudinary auto-reads CLOUDINARY_URL from env
const CLOUDINARY_FOLDER = 'f1-anthology';

const PLACEHOLDER: Record<AssetType, string> = {
  driver: '/images/placeholders/driver.svg',
  circuit: '/images/placeholders/circuit.svg',
  team: '/images/placeholders/team.svg',
  radio: '/images/placeholders/radio.svg',
};

type WikimediaCandidate = {
  src: string;
  width: number;
  height: number;
  title?: string;
  author?: string;
  license?: string;
  page?: string;
};

// Night-race circuits remain useful metadata for seeding hints
const NIGHT_CIRCUITS = new Set([
  'bahrain', 'singapore', 'jeddah', 'las_vegas', 'lasvegas', 'yas_marina', 'abu_dhabi',
]);

export function resolveTimeOfDay(circuitId: string): string {
  const id = String(circuitId).toLowerCase();
  return NIGHT_CIRCUITS.has(id) ? 'night under floodlights' : 'golden hour dusk';
}

async function checkCloudinary(type: AssetType, entityId: string): Promise<string | null> {
  const publicId = `${CLOUDINARY_FOLDER}/${type}/${entityId}`;
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: 'image' });
    return (result.secure_url as string) ?? null;
  } catch {
    return null;
  }
}

function uniqueTerms(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const v = String(value || '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function licenseAllowed(shortName: string): boolean {
  const s = String(shortName || '').toLowerCase();
  return (
    s.includes('public domain') ||
    s.includes('cc0') ||
    s.includes('cc by') ||
    s.includes('cc-by') ||
    s.includes('cc by-sa') ||
    s.includes('cc-by-sa')
  );
}

function isRasterSource(url: string): boolean {
  return !/\.(svg|pdf|djvu)(\?|#|$)/i.test(String(url || ''));
}

function metaValue(extMetadata: unknown, key: string): string {
  if (!Array.isArray(extMetadata)) return '';
  const hit = extMetadata.find(
    (m) => m && typeof m === 'object' && String((m as { name?: string }).name || '').toLowerCase() === key.toLowerCase(),
  ) as { value?: string } | undefined;
  return String(hit?.value || '').trim();
}

async function commonsSearchImages(search: string, limit = 8): Promise<WikimediaCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: String(limit),
    gsrsearch: search,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1800',
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!r.ok) return [];
  const j = (await r.json()) as { query?: { pages?: Record<string, unknown> } };
  const pages = Object.values(j?.query?.pages || {});
  const out: WikimediaCandidate[] = [];
  for (const p of pages) {
    if (!p || typeof p !== 'object') continue;
    const page = p as {
      title?: string;
      imageinfo?: Array<{ thumburl?: string; url?: string; thumbwidth?: number; thumbheight?: number; width?: number; height?: number; extmetadata?: unknown }>;
    };
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const src = String(info.thumburl || info.url || '');
    const width = Number(info.thumbwidth || info.width || 0);
    const height = Number(info.thumbheight || info.height || 0);
    if (!src || !isRasterSource(src) || width < 480 || height < 320) continue;
    const author = metaValue(info.extmetadata, 'Artist') || metaValue(info.extmetadata, 'Credit');
    const license = metaValue(info.extmetadata, 'LicenseShortName');
    if (!licenseAllowed(license)) continue;
    const fileTitle = String(page.title || '').replace(/^File:/, '').replace(/ /g, '_');
    out.push({
      src,
      width,
      height,
      title: String(page.title || ''),
      author,
      license,
      page: fileTitle ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}` : undefined,
    });
  }
  return out;
}

async function wikipediaPageImage(title: string): Promise<WikimediaCandidate | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'pageimages|info',
    pithumbsize: '1800',
    piprop: 'thumbnail',
    inprop: 'url',
    redirects: '1',
    titles: title,
  });
  const r = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { query?: { pages?: Record<string, unknown> } };
  const pages = Object.values(j?.query?.pages || {});
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const p = page as { thumbnail?: { source?: string; width?: number; height?: number } };
    const source = String(p.thumbnail?.source || '');
    const width = Number(p.thumbnail?.width || 0);
    const height = Number(p.thumbnail?.height || 0);
    if (!source || !isRasterSource(source) || width < 480 || height < 320) continue;
    if (!source.includes('upload.wikimedia.org')) continue;
    return { src: source, width, height, title };
  }
  return null;
}

async function resolveWikimediaCandidate(
  type: AssetType,
  entityId: string,
  meta: AssetMetadata,
): Promise<WikimediaCandidate | null> {
  const typeHint =
    type === 'driver' ? 'Formula 1 driver portrait'
      : type === 'team' ? 'Formula 1 team logo'
        : type === 'circuit' ? 'Formula 1 circuit'
          : 'Formula 1 radio team photo';
  const wikiTitles = Array.isArray(meta.wikiTitles) ? meta.wikiTitles : [];
  for (const title of wikiTitles) {
    const pick = await wikipediaPageImage(title);
    if (pick) return pick;
  }
  const searchTerms = uniqueTerms([
    ...(Array.isArray(meta.searchTerms) ? meta.searchTerms : []),
    meta.commonsSearch,
    meta.teamName,
    meta.circuitName,
    meta.country ? `${meta.circuitName || ''} ${meta.country}`.trim() : undefined,
    `${entityId} ${typeHint}`,
    `${typeHint}`,
  ]);
  for (const term of searchTerms) {
    const picks = await commonsSearchImages(term, 10);
    if (picks.length > 0) return picks[0];
  }
  return null;
}

async function generateAndUpload(
  type: AssetType,
  entityId: string,
  meta: AssetMetadata,
): Promise<string> {
  const pick = await resolveWikimediaCandidate(type, entityId, meta);
  if (!pick?.src) throw new Error('No suitable Wikimedia image found');

  const publicId = `${CLOUDINARY_FOLDER}/${type}/${entityId}`;
  await cloudinary.uploader.upload(pick.src, {
    public_id: publicId,
    resource_type: 'image',
    format: 'webp',
    overwrite: false,
    transformation: [{ quality: 'auto' }],
  });

  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto',
  });
}

/** Full pipeline: Cloudinary check → Wikimedia fetch → Cloudinary upload → URL. */
export async function getOrGenerateAsset(
  type: AssetType,
  entityId: string,
  meta: AssetMetadata = {},
): Promise<string> {
  try {
    const existing = await checkCloudinary(type, entityId);
    if (existing) return existing;
    return await generateAndUpload(type, entityId, meta);
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err));
    console.error(`[assetPipeline] ${type}/${entityId}:`, msg);
    return PLACEHOLDER[type];
  }
}

/** Read-only Cloudinary check — no generation. Returns null if not found. */
export async function checkAssetExists(
  type: AssetType,
  entityId: string,
): Promise<string | null> {
  return checkCloudinary(type, entityId);
}
