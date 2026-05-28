/**
 * Server-side AI asset pipeline.
 * Checks Cloudinary first; generates via Replicate Flux 1.1 Pro if missing; uploads with cinematic transforms.
 * Browser pages call /api/generate-assets — this module is Node-only.
 */
import { v2 as cloudinary } from 'cloudinary';
import Replicate from 'replicate';

export type AssetType = 'driver' | 'circuit' | 'team' | 'radio';

export interface AssetMetadata {
  teamName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  circuitName?: string;
  country?: string;
  timeOfDay?: string;
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

// Night-race circuits get floodlit prompts
const NIGHT_CIRCUITS = new Set([
  'bahrain', 'singapore', 'jeddah', 'las_vegas', 'lasvegas', 'yas_marina', 'abu_dhabi',
]);

export function resolveTimeOfDay(circuitId: string): string {
  const id = String(circuitId).toLowerCase();
  return NIGHT_CIRCUITS.has(id) ? 'night under floodlights' : 'golden hour dusk';
}

function buildPrompt(type: AssetType, meta: AssetMetadata): string {
  const team = meta.teamName ?? 'Formula 1 team';
  const primary = meta.primaryColor ?? '#ff1801';
  const secondary = meta.secondaryColor ?? '#ffffff';
  const circuit = meta.circuitName ?? 'Formula 1 circuit';
  const country = meta.country ?? '';
  const timeOfDay = meta.timeOfDay ?? 'golden hour dusk';

  switch (type) {
    case 'driver':
      return (
        `Formula 1 racing driver seen from behind, ${team} livery racing suit ` +
        `with ${primary} and ${secondary} accents, helmet with ${team} design, ` +
        `dramatic overhead stadium floodlights casting hard shadows, ` +
        `cinematic black and white photography, shallow depth of field, ` +
        `atmospheric smoke and heat haze, high contrast editorial sports photography, ` +
        `dark moody background, photorealistic, 8k`
      );
    case 'circuit':
      return (
        `Formula 1 racing circuit ${circuit} ${country}, asphalt ribbon perspective shot at ${timeOfDay}, ` +
        `dramatic natural or artificial lighting, cinematic anamorphic wide angle lens, ` +
        `desaturated near monochrome with deep blacks, atmospheric ground fog, ultra high contrast, ` +
        `editorial motorsport photography, empty track no people, 8k`
      );
    case 'team':
      return (
        `Formula 1 ${team} pit lane equipment and garage interior, ${primary} team colors as accent lighting, ` +
        `carbon fiber surfaces, technical machinery, motion blur suggesting speed, ` +
        `cinematic documentary photography, high contrast black and white with ${primary} color grade, ` +
        `editorial sports photography, no people visible`
      );
    case 'radio':
      return (
        `Formula 1 pit wall at night, radio transmission equipment, team engineers at monitors, ` +
        `dramatic blue and red indicator lights, shallow depth of field, cinematic documentary photography, ` +
        `dark moody atmosphere, high contrast, ${primary} color accents, editorial sports photography`
      );
  }
}

const ASPECT_RATIO: Record<AssetType, string> = {
  driver: '3:4',
  circuit: '16:9',
  team: '16:9',
  radio: '16:9',
};

async function checkCloudinary(type: AssetType, entityId: string): Promise<string | null> {
  const publicId = `${CLOUDINARY_FOLDER}/${type}/${entityId}`;
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: 'image' });
    return (result.secure_url as string) ?? null;
  } catch {
    return null;
  }
}

async function generateAndUpload(
  type: AssetType,
  entityId: string,
  meta: AssetMetadata,
): Promise<string> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const prompt = buildPrompt(type, meta);
  const aspectRatio = ASPECT_RATIO[type];

  // Retry up to 3 times on 429, honouring retry_after
  let output: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      output = await replicate.run('black-forest-labs/flux-1.1-pro', {
        input: { prompt, aspect_ratio: aspectRatio },
      });
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryMatch = msg.match(/"retry_after"\s*:\s*(\d+)/);
      const is429 = msg.includes('429') || msg.includes('Too Many Requests');
      if (is429 && attempt < 2) {
        const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 2 : 15;
        console.warn(`[assetPipeline] 429 — waiting ${waitSec}s before retry ${attempt + 2}/3`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }

  const raw: unknown = Array.isArray(output) ? output[0] : output;
  const imageUrl = raw instanceof URL
    ? raw.href
    : (typeof raw === 'object' && raw !== null && typeof (raw as { url?: unknown }).url === 'function')
      ? String((raw as { url: () => URL | string }).url())
      : String(raw ?? '');

  if (!imageUrl) throw new Error('Replicate returned no image URL');

  const publicId = `${CLOUDINARY_FOLDER}/${type}/${entityId}`;
  const uploadResult = await cloudinary.uploader.upload(imageUrl, {
    public_id: publicId,
    resource_type: 'image',
    format: 'webp',
    overwrite: false,
    transformation: [{ effect: 'contrast:15' }, { effect: 'sharpen:80' }],
  });

  return uploadResult.secure_url as string;
}

/** Full pipeline: Cloudinary check → Flux generation → Cloudinary upload → URL. */
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
