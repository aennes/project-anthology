import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOrGenerateAsset, checkAssetExists } from '../utils/assetPipeline';
import type { AssetType } from '../utils/assetPipeline';

const VALID_TYPES = new Set<AssetType>(['driver', 'circuit', 'team', 'radio']);

// In-process concurrency guard — reset on cold start
let activeGenerations = 0;
const MAX_CONCURRENT = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  const type = String(body.type ?? '');
  const entityId = String(body.entityId ?? '').trim();
  const metadata = body.metadata ?? {};

  if (!entityId || !VALID_TYPES.has(type as AssetType)) {
    return res.status(400).json({ error: 'type must be driver|circuit|team|radio and entityId is required' });
  }

  // Sanitize entityId: alphanumeric + underscore/hyphen only
  if (!/^[\w-]{1,80}$/.test(entityId)) {
    return res.status(400).json({ error: 'Invalid entityId format' });
  }

  const providedKey = req.headers['x-internal-key'];
  const internalKey = process.env.INTERNAL_API_KEY;
  const isAuthorized = Boolean(internalKey && providedKey === internalKey);

  // Unauthenticated path: Cloudinary-check only (fast, no Flux generation)
  if (!isAuthorized) {
    try {
      const url = await checkAssetExists(type as AssetType, entityId);
      const fallback = `/images/placeholders/${type}.svg`;
      return res.status(200).json({ url: url ?? fallback });
    } catch {
      return res.status(200).json({ url: `/images/placeholders/${type}.svg` });
    }
  }

  // Authenticated path: full pipeline (check + generate + upload)
  if (activeGenerations >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Too many concurrent generations — retry shortly.' });
  }

  activeGenerations++;
  try {
    const url = await getOrGenerateAsset(type as AssetType, entityId, metadata);
    return res.status(200).json({ url });
  } catch (err) {
    console.error('[generate-assets] unhandled:', err);
    return res.status(500).json({ error: 'Generation failed', url: `/images/placeholders/${type}.svg` });
  } finally {
    activeGenerations--;
  }
}
