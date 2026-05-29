// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../scripts/asset-pipeline';

const VALID_ENTRY = {
  asset_type: 'driver',
  entity_id: 'ver',
  display_name: 'Max Verstappen',
  source_url: null,
  source_page: null,
  license: null,
  attribution: null,
  candidates: [],
  candidate_score: 0,
  local_staged_path: null,
  checksum_sha256: null,
  staged_at: null,
  planned_cloudinary_public_id: null,
  planned_cloudinary_folder: 'f1-anthology',
  approved: false,
  approved_at: null,
  approved_by: null,
  status: 'discovered',
  discovered_at: '2026-05-29T10:00:00Z',
  ranked_at: null,
  uploaded_at: null,
  error: null,
};

const VALID_MANIFEST = {
  version: 2,
  generated_at: '2026-05-29T10:00:00Z',
  assets: [VALID_ENTRY],
};

describe('validateManifest', () => {
  it('accepts a fully valid manifest', () => {
    const r = validateManifest(VALID_MANIFEST);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('accepts empty assets array', () => {
    expect(validateManifest({ ...VALID_MANIFEST, assets: [] }).valid).toBe(true);
  });
  it('rejects null', () => {
    expect(validateManifest(null).valid).toBe(false);
  });
  it('rejects missing version', () => {
    const m = { ...VALID_MANIFEST } as Record<string, unknown>;
    delete m['version'];
    expect(validateManifest(m).valid).toBe(false);
  });
  it('rejects non-array assets', () => {
    expect(validateManifest({ ...VALID_MANIFEST, assets: 'bad' }).valid).toBe(false);
  });
  it('rejects invalid status value', () => {
    const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, status: 'invalid_status' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('status'))).toBe(true);
  });
  it('rejects invalid asset_type', () => {
    const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, asset_type: 'unknown' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('asset_type'))).toBe(true);
  });
  it('rejects path traversal in entity_id', () => {
    const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, entity_id: '../passwd' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('entity_id'))).toBe(true);
  });
  it('rejects candidate_score > 100', () => {
    const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, candidate_score: 150 }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('candidate_score'))).toBe(true);
  });
  it('rejects candidate_score < 0', () => {
    const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, candidate_score: -5 }] });
    expect(r.valid).toBe(false);
  });
  it('accepts all valid asset types', () => {
    for (const type of ['driver', 'team', 'circuit', 'radio']) {
      const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, asset_type: type }] });
      expect(r.valid).toBe(true);
    }
  });
  it('accepts all valid statuses', () => {
    for (const status of ['discovered', 'ranked', 'staged', 'approved', 'uploaded']) {
      const r = validateManifest({ ...VALID_MANIFEST, assets: [{ ...VALID_ENTRY, status }] });
      expect(r.valid).toBe(true);
    }
  });
});
