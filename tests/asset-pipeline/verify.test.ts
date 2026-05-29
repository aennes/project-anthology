// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { runVerify } from '../../scripts/asset-pipeline';
import type { AssetManifest } from '../../scripts/asset-pipeline';

const BASE_ENTRY = {
  asset_type: 'circuit' as const,
  entity_id: 'monaco',
  display_name: 'Circuit de Monaco',
  source_url: 'https://upload.wikimedia.org/a.jpg',
  source_page: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  license: 'CC BY-SA 4.0',
  attribution: 'Test Author / Wikimedia Commons',
  candidates: [],
  candidate_score: 72,
  local_staged_path: null,
  checksum_sha256: null,
  staged_at: null,
  planned_cloudinary_public_id: 'f1-anthology/circuit/monaco',
  planned_cloudinary_folder: 'f1-anthology',
  approved: false,
  approved_at: null,
  approved_by: null,
  status: 'ranked' as const,
  discovered_at: '2026-05-29T10:00:00Z',
  ranked_at: '2026-05-29T10:01:00Z',
  uploaded_at: null,
  error: null,
};

const wrap = (overrides: Record<string, unknown> = {}): AssetManifest => ({
  version: 2,
  generated_at: '2026-05-29T10:00:00Z',
  assets: [{ ...BASE_ENTRY, ...overrides } as typeof BASE_ENTRY],
});

describe('runVerify', () => {
  it('passes a valid ranked manifest', () => {
    const r = runVerify(wrap());
    expect(r.passed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('passes an empty manifest', () => {
    const r = runVerify({ version: 2, generated_at: '2026-05-29T10:00:00Z', assets: [] });
    expect(r.passed).toBe(true);
  });
  it('fails when license empty for staged entry', () => {
    const r = runVerify(wrap({
      status: 'staged', license: '', local_staged_path: '/p', checksum_sha256: 'abc',
    }));
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('license'))).toBe(true);
  });
  it('fails when checksum missing for staged entry', () => {
    const r = runVerify(wrap({
      status: 'staged', license: 'CC BY-SA 4.0', local_staged_path: '/p', checksum_sha256: null,
    }));
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('checksum'))).toBe(true);
  });
  it('fails when local_staged_path missing for staged entry', () => {
    const r = runVerify(wrap({
      status: 'staged', license: 'CC BY-SA 4.0', local_staged_path: null, checksum_sha256: 'abc',
    }));
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('local_staged_path'))).toBe(true);
  });
  it('fails when entity_id is path traversal', () => {
    const r = runVerify(wrap({ entity_id: '../etc/passwd' }));
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('entity_id'))).toBe(true);
  });
  it('fails when approved entry lacks planned_cloudinary_public_id', () => {
    const r = runVerify(wrap({
      status: 'approved', approved: true,
      local_staged_path: '/p', checksum_sha256: 'abc',
      license: 'CC BY-SA 4.0', planned_cloudinary_public_id: null,
    }));
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('planned_cloudinary_public_id'))).toBe(true);
  });
  it('emits warning for low score', () => {
    const r = runVerify(wrap({ candidate_score: 20 }));
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toContain('low score');
  });
  it('passes all statuses for staged requirements', () => {
    for (const status of ['staged', 'approved', 'uploaded']) {
      const r = runVerify(wrap({
        status,
        license: 'CC BY-SA 4.0',
        local_staged_path: '/some/path.webp',
        checksum_sha256: 'abc123',
        planned_cloudinary_public_id: 'f1-anthology/circuit/monaco',
        approved: status !== 'staged',
      }));
      expect(r.passed).toBe(true);
    }
  });
});
