import { describe, expect, it } from 'vitest';
import { f1DbCacheControl } from '../api/f1-db';
import { ergastCacheControl } from '../api/f1-season';

describe('f1-db cache control', () => {
  it('uses long cache for historical seasons', () => {
    const cache = f1DbCacheControl(2024, true, new Date('2026-05-29T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=604800, stale-while-revalidate=86400');
  });

  it('uses short cache on race weekends for current season', () => {
    const cache = f1DbCacheControl(2026, true, new Date('2026-05-30T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=90, stale-while-revalidate=120');
  });

  it('uses medium cache on weekdays for current season', () => {
    const cache = f1DbCacheControl(2026, true, new Date('2026-05-27T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=900, stale-while-revalidate=900');
  });
});

describe('f1-season cache control', () => {
  it('uses long cache for historical season paths', () => {
    const cache = ergastCacheControl('2024/driverStandings.json', true, new Date('2026-05-29T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=604800, stale-while-revalidate=86400');
  });

  it('uses short cache on race weekends for current season paths', () => {
    const cache = ergastCacheControl('2026/driverStandings.json', true, new Date('2026-05-30T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=120, stale-while-revalidate=180');
  });

  it('uses medium cache on weekdays for current season paths', () => {
    const cache = ergastCacheControl('2026/driverStandings.json', true, new Date('2026-05-27T12:00:00Z'));
    expect(cache).toBe('public, s-maxage=1800, stale-while-revalidate=900');
  });
});
