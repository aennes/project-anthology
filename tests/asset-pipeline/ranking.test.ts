// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  scoreLicenseTrust,
  scoreResolution,
  scoreAspectRatio,
  scoreCandidate,
} from '../../scripts/asset-pipeline';

describe('scoreLicenseTrust', () => {
  it('gives 30 for CC0', () => expect(scoreLicenseTrust('CC0 1.0')).toBe(30));
  it('gives 30 for Public Domain', () => expect(scoreLicenseTrust('Public Domain')).toBe(30));
  it('gives 25 for CC BY', () => expect(scoreLicenseTrust('CC BY 4.0')).toBe(25));
  it('gives 22 for CC BY-SA', () => expect(scoreLicenseTrust('CC BY-SA 4.0')).toBe(22));
  it('gives 0 for unknown license', () => expect(scoreLicenseTrust('All rights reserved')).toBe(0));
  it('gives 0 for empty string', () => expect(scoreLicenseTrust('')).toBe(0));
});

describe('scoreResolution', () => {
  it('gives 25 for width >= 1800', () => expect(scoreResolution(1800)).toBe(25));
  it('gives 18 for width >= 1200', () => expect(scoreResolution(1200)).toBe(18));
  it('gives 10 for width >= 800', () => expect(scoreResolution(900)).toBe(10));
  it('gives 0 for width < 800', () => expect(scoreResolution(400)).toBe(0));
});

describe('scoreAspectRatio', () => {
  it('gives 20 for perfect 16:9', () => expect(scoreAspectRatio(1600, 900, 16 / 9)).toBe(20));
  it('gives 0 for zero dimensions', () => expect(scoreAspectRatio(0, 900, 16 / 9)).toBe(0));
  it('penalizes off-ratio', () => {
    expect(scoreAspectRatio(1600, 900, 16 / 9)).toBeGreaterThan(scoreAspectRatio(1600, 1600, 16 / 9));
  });
});

describe('scoreCandidate determinism', () => {
  const c = {
    url: 'https://upload.wikimedia.org/a.jpg',
    license: 'CC BY-SA 4.0',
    width: 1800,
    height: 1013,
    author: 'A',
    source_page: '',
  };
  it('returns same score on repeated calls', () => {
    expect(scoreCandidate(c, 'circuit').score).toBe(scoreCandidate(c, 'circuit').score);
  });
  it('higher-res scores higher', () => {
    const lo = { ...c, width: 600, height: 338 };
    expect(scoreCandidate(c, 'circuit').score).toBeGreaterThan(scoreCandidate(lo, 'circuit').score);
  });
  it('better license scores higher', () => {
    const cc0 = { ...c, license: 'CC0 1.0' };
    const ccbysa = { ...c, license: 'CC BY-SA 4.0' };
    expect(scoreCandidate(cc0, 'circuit').score).toBeGreaterThan(scoreCandidate(ccbysa, 'circuit').score);
  });
  it('score_breakdown sums to score', () => {
    const result = scoreCandidate(c, 'circuit');
    const sum = Object.values(result.score_breakdown).reduce((a, b) => a + b, 0);
    expect(result.score).toBe(sum);
  });
});
