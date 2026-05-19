import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { asFirstString, getAllowedOrigin } from './proxy-helpers';

const SEASON_RESOURCES = new Set(['calendar', 'driverStandings', 'constructorStandings']);

function f1DbCacheControl(year: number, ok: boolean): string {
  if (!ok) return 's-maxage=30, stale-while-revalidate=120';
  const current = new Date().getFullYear();
  if (year < current) {
    return 'public, s-maxage=604800, stale-while-revalidate=86400';
  }
  if (year === current) {
    return 'public, s-maxage=3600, stale-while-revalidate=1800';
  }
  return 'public, s-maxage=300, stale-while-revalidate=600';
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hasUsableMrData(json: unknown): json is { MRData: Record<string, unknown> } {
  return Boolean(json && typeof json === 'object' && (json as { MRData?: unknown }).MRData);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = getAllowedOrigin(req);
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const yearRaw = asFirstString(req.query?.year);
  const year = Number(yearRaw);
  if (!Number.isFinite(year) || year < 1950 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(503).json({ error: 'Database not configured' });
  }

  const roundRaw = asFirstString(req.query?.round);
  const suffix = asFirstString(req.query?.suffix).trim();
  const resource = asFirstString(req.query?.resource).trim();

  try {
    if (roundRaw || suffix) {
      const round = Number(roundRaw);
      if (!Number.isFinite(round) || round < 1 || round > 99) {
        return res.status(400).json({ error: 'Invalid round' });
      }
      if (!suffix || suffix.length > 64 || /[^a-zA-Z0-9_-]/.test(suffix)) {
        return res.status(400).json({ error: 'Invalid suffix' });
      }

      const { data, error } = await supabase
        .from('f1_round_snapshots')
        .select('payload')
        .eq('year', year)
        .eq('round', round)
        .eq('suffix', suffix)
        .maybeSingle();

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[f1-db] round', error.message);
        }
        res.setHeader('Cache-Control', f1DbCacheControl(year, false));
        return res.status(500).json({ error: 'Database read failed' });
      }

      const payload = data?.payload;
      if (!hasUsableMrData(payload)) {
        res.setHeader('Cache-Control', f1DbCacheControl(year, false));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).end('null');
      }

      res.setHeader('Cache-Control', f1DbCacheControl(year, true));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).end(JSON.stringify(payload));
    }

    if (!resource || !SEASON_RESOURCES.has(resource)) {
      return res.status(400).json({
        error: 'Invalid resource; use calendar, driverStandings, or constructorStandings',
      });
    }

    const { data, error } = await supabase
      .from('f1_season_snapshots')
      .select('payload')
      .eq('year', year)
      .eq('resource_type', resource)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[f1-db] season', error.message);
      }
      res.setHeader('Cache-Control', f1DbCacheControl(year, false));
      return res.status(500).json({ error: 'Database read failed' });
    }

    const payload = data?.payload;
    if (!hasUsableMrData(payload)) {
      res.setHeader('Cache-Control', f1DbCacheControl(year, false));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).end('null');
    }

    res.setHeader('Cache-Control', f1DbCacheControl(year, true));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).end(JSON.stringify(payload));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[f1-db]', msg);
      return res.status(500).json({ error: msg });
    }
    return res.status(500).json({ error: 'Database request failed' });
  }
}
