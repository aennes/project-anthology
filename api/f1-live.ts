import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertProxyUrlWithinLimit,
  asFirstString,
  getAllowedOrigin,
  isOpenF1LiveForCacheControl,
  sanitizeProxyPath,
} from './proxy-helpers';

const OPEN_F1_BASE = 'https://api.openf1.org/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = getAllowedOrigin(req);
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const q = req.query ?? {};
    const rawPath = asFirstString(q.path);
    const pathResult = sanitizeProxyPath(rawPath);
    if (!pathResult.ok) return res.status(400).json({ error: pathResult.error });

    const upstream = new URL(`${OPEN_F1_BASE}/${pathResult.path}`);
    for (const [key, value] of Object.entries(q)) {
      if (key === 'path') continue;
      if (value == null) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => upstream.searchParams.append(key, String(v)));
      } else {
        upstream.searchParams.append(key, String(value));
      }
    }

    const urlStr = upstream.toString();
    if (!assertProxyUrlWithinLimit(urlStr)) {
      return res.status(414).json({ error: 'Request URL too long' });
    }

    const response = await fetch(urlStr, {
      headers: { Accept: 'application/json' },
    });

    const text = await response.text();
    if (!text.trim()) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(response.status).end('null');
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text;
      if (!response.ok) {
        return res.status(response.status).json({ error: snippet || response.statusText || 'Upstream error' });
      }
      return res.status(502).json({ error: 'Upstream returned non-JSON' });
    }

    const isLive = isOpenF1LiveForCacheControl(json);
    res.setHeader('Cache-Control', isLive ? 'no-store' : 's-maxage=30, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(response.status).end(JSON.stringify(json));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[f1-live]', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ error: msg });
    }
    return res.status(500).json({ error: 'Upstream request failed' });
  }
}
