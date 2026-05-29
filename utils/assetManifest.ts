/**
 * Runtime helper: reads the approved asset manifest from /data/asset-manifest.json
 * and resolves asset URLs with graceful fallbacks.
 *
 * Priority chain: approved manifest entry → placeholder SVG
 *
 * utils/assetPipeline.ts is NOT modified — this is a separate, additive layer.
 */
import type { AssetManifest, AssetType } from '../scripts/asset-pipeline';

export const PLACEHOLDERS: Record<AssetType, string> = {
  driver: '/images/placeholders/driver.svg',
  team: '/images/placeholders/team.svg',
  circuit: '/images/placeholders/circuit.svg',
  radio: '/images/placeholders/radio.svg',
};

export interface Attribution {
  author: string;
  license: string;
  source_page: string | null;
}

let _manifest: AssetManifest | null = null;
let _loadAttempted = false;

/** Inject a manifest without fetching — for unit tests only. */
export function injectManifestForTesting(manifest: AssetManifest | null): void {
  _manifest = manifest;
  _loadAttempted = manifest !== null;
}

/** Load the runtime manifest once from /data/asset-manifest.json. Safe to call multiple times. */
export async function loadRuntimeManifest(): Promise<void> {
  if (_loadAttempted) return;
  _loadAttempted = true;
  try {
    const res = await fetch('/data/asset-manifest.json');
    if (!res.ok) return;
    _manifest = (await res.json()) as AssetManifest;
  } catch {
    // Graceful: manifest unavailable — fallbacks remain active
  }
}

/**
 * Pure lookup against a given manifest. Does not use module-level cache.
 * Falls back to placeholder when: manifest null, entry missing, not approved, or source_url null.
 */
export function getAssetUrlFromManifest(
  manifest: AssetManifest | null,
  type: AssetType,
  entityId: string,
): string {
  if (!manifest) return PLACEHOLDERS[type];
  const entry = manifest.assets.find(
    (a) => a.asset_type === type && a.entity_id === entityId && a.approved,
  );
  if (!entry?.source_url) return PLACEHOLDERS[type];
  return entry.source_url;
}

/** Get URL using the module-level cached manifest. Call loadRuntimeManifest() first. */
export function getAssetUrl(type: AssetType, entityId: string): string {
  return getAssetUrlFromManifest(_manifest, type, entityId);
}

/** Get attribution metadata for a specific approved asset. */
export function getAssetAttribution(type: AssetType, entityId: string): Attribution | null {
  if (!_manifest) return null;
  const entry = _manifest.assets.find(
    (a) => a.asset_type === type && a.entity_id === entityId && a.approved,
  );
  if (!entry) return null;
  return {
    author: entry.attribution ?? 'Wikimedia Commons',
    license: entry.license ?? '',
    source_page: entry.source_page,
  };
}

/** True once loadRuntimeManifest() has completed and a manifest was loaded. */
export function isManifestReady(): boolean {
  return _loadAttempted && _manifest !== null;
}
