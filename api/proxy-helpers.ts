import type { VercelRequest } from '@vercel/node';

/** Mirrors `api/news.ts` — canonical deployment + localhost only. */
export function getAllowedOrigin(req: VercelRequest): string | null {
  const origin = (req.headers.origin || req.headers.referer || '') as string;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return origin;
    if (host === 'project-anthology.vercel.app') return origin;
    return null;
  } catch {
    return null;
  }
}

export function asFirstString(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

const MAX_PATH_SEGMENTS = 24;
const MAX_SEGMENT_CHARS = 120;
const MAX_PROXY_URL_CHARS = 8192;

export type SanitizePathResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * SSRF hardening: single-segment decoding, reject .., \, encoded slashes, full URLs.
 * Segments are re-encoded for the upstream path (safe characters only).
 */
export function sanitizeProxyPath(raw: string): SanitizePathResult {
  const trimmed = raw.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) return { ok: false, error: 'Missing path' };
  if (trimmed.length > 2048) return { ok: false, error: 'Path too long' };
  if (/[\u0000\\]/.test(trimmed) || /:\/\//.test(trimmed)) {
    return { ok: false, error: 'Invalid path' };
  }

  const parts = trimmed.split('/');
  if (parts.length > MAX_PATH_SEGMENTS) return { ok: false, error: 'Path too deep' };

  const safe: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.length > MAX_SEGMENT_CHARS) return { ok: false, error: 'Path segment too long' };
    let seg: string;
    try {
      seg = decodeURIComponent(part);
    } catch {
      return { ok: false, error: 'Invalid path encoding' };
    }
    const t = seg.trim();
    if (!t || t === '.' || t === '..') return { ok: false, error: 'Invalid path segment' };
    if (/[\u0000\\/]|%2f|%5c/i.test(t)) return { ok: false, error: 'Invalid path segment' };
    safe.push(encodeURIComponent(t));
  }

  if (safe.length === 0) return { ok: false, error: 'Missing path' };
  return { ok: true, path: safe.join('/') };
}

export function assertProxyUrlWithinLimit(urlString: string): boolean {
  return urlString.length <= MAX_PROXY_URL_CHARS;
}

function toMsTimestamp(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
    const n = Number(v);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  }
  return NaN;
}

/**
 * Live (no-store) iff the JSON is an array containing a row with:
 * - driver_number
 * - gap_to_leader (present)
 * - a primary telemetry timestamp (`date` or `utc` from OpenF1) within the last 2 minutes.
 *
 * Avoids broad key heuristics that matched unrelated arrays (false positives).
 */
export function isOpenF1LiveForCacheControl(json: unknown): boolean {
  if (!Array.isArray(json)) return false;
  const now = Date.now();
  const maxAge = 2 * 60 * 1000;

  const timeKeys = ['date', 'utc', 'inserted_at'] as const;

  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (r.driver_number == null) continue;
    if (r.gap_to_leader == null) continue;

    let bestTs = NaN;
    for (const k of timeKeys) {
      if (r[k] == null) continue;
      const ts = toMsTimestamp(r[k]);
      if (Number.isFinite(ts)) {
        bestTs = ts;
        break;
      }
    }

    if (Number.isFinite(bestTs) && now - bestTs <= maxAge) return true;
  }

  return false;
}
