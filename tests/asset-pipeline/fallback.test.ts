import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAssetUrlFromManifest,
  PLACEHOLDERS,
  injectManifestForTesting,
  getAssetUrl,
  getAssetAttribution,
  isManifestReady,
} from '../../utils/assetManifest';
import type { AssetManifest } from '../../scripts/asset-pipeline';

const makeManifest = (overrides: Record<string, unknown> = {}): AssetManifest => ({
  version: 2,
  generated_at: '2026-05-29T10:00:00Z',
  assets: [{
    asset_type: 'driver',
    entity_id: 'ver',
    display_name: 'Max Verstappen',
    source_url: 'https://upload.wikimedia.org/ver.jpg',
    source_page: null,
    license: 'CC BY-SA 4.0',
    attribution: 'Test Author / Wikimedia Commons',
    candidates: [],
    candidate_score: 80,
    local_staged_path: 'scripts/data/staging/driver/ver.webp',
    checksum_sha256: 'abc',
    staged_at: '2026-05-29T10:05:00Z',
    planned_cloudinary_public_id: 'f1-anthology/driver/ver',
    planned_cloudinary_folder: 'f1-anthology',
    approved: true,
    approved_at: '2026-05-29T11:00:00Z',
    approved_by: 'cli',
    status: 'approved',
    discovered_at: '2026-05-29T10:00:00Z',
    ranked_at: '2026-05-29T10:01:00Z',
    uploaded_at: null,
    error: null,
    ...overrides,
  }],
});

beforeEach(() => { injectManifestForTesting(null); });

describe('getAssetUrlFromManifest (pure)', () => {
  it('returns source_url for an approved entry', () => {
    expect(getAssetUrlFromManifest(makeManifest(), 'driver', 'ver'))
      .toBe('https://upload.wikimedia.org/ver.jpg');
  });
  it('returns placeholder when manifest is null', () => {
    expect(getAssetUrlFromManifest(null, 'driver', 'ver')).toBe(PLACEHOLDERS.driver);
  });
  it('returns placeholder when entry not approved', () => {
    expect(getAssetUrlFromManifest(makeManifest({ approved: false }), 'driver', 'ver'))
      .toBe(PLACEHOLDERS.driver);
  });
  it('returns placeholder when entity not found', () => {
    expect(getAssetUrlFromManifest(makeManifest(), 'driver', 'ham')).toBe(PLACEHOLDERS.driver);
  });
  it('returns placeholder when source_url is null', () => {
    expect(getAssetUrlFromManifest(makeManifest({ source_url: null }), 'driver', 'ver'))
      .toBe(PLACEHOLDERS.driver);
  });
  it('returns team placeholder for team lookup miss', () => {
    expect(getAssetUrlFromManifest(makeManifest(), 'team', 'ferrari')).toBe(PLACEHOLDERS.team);
  });
});

describe('PLACEHOLDERS', () => {
  it('has entries for all four asset types', () => {
    expect(PLACEHOLDERS.driver).toContain('driver');
    expect(PLACEHOLDERS.team).toContain('team');
    expect(PLACEHOLDERS.circuit).toContain('circuit');
    expect(PLACEHOLDERS.radio).toContain('radio');
  });
});

describe('injectManifestForTesting + getAssetUrl', () => {
  it('getAssetUrl uses injected manifest', () => {
    injectManifestForTesting(makeManifest());
    expect(getAssetUrl('driver', 'ver')).toBe('https://upload.wikimedia.org/ver.jpg');
  });
  it('getAssetUrl returns placeholder after null injection', () => {
    injectManifestForTesting(null);
    expect(getAssetUrl('driver', 'ver')).toBe(PLACEHOLDERS.driver);
  });
});

describe('isManifestReady', () => {
  it('returns false before injection', () => {
    expect(isManifestReady()).toBe(false);
  });
  it('returns true after injecting a manifest', () => {
    injectManifestForTesting(makeManifest());
    expect(isManifestReady()).toBe(true);
  });
  it('returns false after injecting null', () => {
    injectManifestForTesting(null);
    expect(isManifestReady()).toBe(false);
  });
});

describe('getAssetAttribution', () => {
  it('returns attribution for an approved entry', () => {
    injectManifestForTesting(makeManifest());
    const attr = getAssetAttribution('driver', 'ver');
    expect(attr).not.toBeNull();
    expect(attr?.author).toBe('Test Author / Wikimedia Commons');
    expect(attr?.license).toBe('CC BY-SA 4.0');
  });
  it('returns null when manifest is null', () => {
    injectManifestForTesting(null);
    expect(getAssetAttribution('driver', 'ver')).toBeNull();
  });
  it('returns null when entity not found', () => {
    injectManifestForTesting(makeManifest());
    expect(getAssetAttribution('driver', 'ham')).toBeNull();
  });
});
