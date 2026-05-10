/**
 * Local dev server for /api routes (news, health, f1-live, f1-season).
 * Used when running "npm run dev" so that fetch('/api/...') works without Vercel.
 */
import http from 'http';
import { URL } from 'url';

const PORT = 3001;

// Ensure req has .query for Vercel handler compatibility (Node's IncomingMessage has no .query)
function patchReq(req: http.IncomingMessage): http.IncomingMessage & { query: Record<string, string> } {
  const r = req as http.IncomingMessage & { query?: Record<string, string> };
  if (r.query !== undefined) return r as http.IncomingMessage & { query: Record<string, string> };
  const url = req.url || '';
  const q = url.includes('?') ? new URL(url, `http://localhost:${PORT}`).searchParams : null;
  const query: Record<string, string> = {};
  if (q) {
    q.forEach((v, k) => { query[k] = v; });
  }
  r.query = query;
  return r as http.IncomingMessage & { query: Record<string, string> };
}

// Patch Node's ServerResponse with Vercel-style .status() and .json()
function patchRes(
  res: http.ServerResponse,
): http.ServerResponse & {
  status: (code: number) => typeof res;
  json: (body: unknown) => void;
  send: (body: string | Buffer) => void;
} {
  const orig = res as http.ServerResponse & {
    status?: (code: number) => typeof res;
    json?: (body: unknown) => void;
    send?: (body: string | Buffer) => void;
  };
  orig.status = function (code: number) {
    this.statusCode = code;
    return this;
  };
  orig.json = function (body: unknown) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(body));
  };
  orig.send = function (body: string | Buffer) {
    this.end(body);
  };
  return orig as http.ServerResponse & {
    status: (code: number) => typeof res;
    json: (body: unknown) => void;
    send: (body: string | Buffer) => void;
  };
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '';
  const method = req.method || 'GET';

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const patchedRes = patchRes(res);
  const patchedReq = patchReq(req);

  const pathname = url.split('?')[0];
  try {
    if (pathname === '/api/news' || pathname === '/api/news/') {
      try {
        const mod = await import('../api/news');
        const handler = mod.default;
        await handler(patchedReq as any, patchedRes as any);
      } catch (err) {
        // In dev we never want warmNewsOnLoad() to log a red error in the
        // console just because upstream RSS feeds / API keys aren't available.
        // Respond with an empty list so the client silently falls back to its
        // cache (or the public static fallback).
        console.warn('[dev-api] /api/news handler failed, returning empty list:', err);
        if (!patchedRes.headersSent) {
          patchedRes.status(200);
          patchedRes.json([]);
        }
      }
      return;
    }
    if (pathname === '/api/health' || pathname === '/api/health/') {
      const mod = await import('../api/health');
      const handler = mod.default;
      await handler(patchedReq as any, patchedRes as any);
      return;
    }
    if (pathname === '/api/f1-live' || pathname === '/api/f1-live/') {
      const mod = await import('../api/f1-live');
      await mod.default(patchedReq as any, patchedRes as any);
      return;
    }
    if (pathname === '/api/f1-season' || pathname === '/api/f1-season/') {
      const mod = await import('../api/f1-season');
      await mod.default(patchedReq as any, patchedRes as any);
      return;
    }
  } catch (err) {
    console.error('Dev API error:', err);
    if (!patchedRes.headersSent) {
      patchedRes.status(500);
      patchedRes.json({ error: 'Internal Server Error' });
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[dev-api] API server running at http://localhost:${PORT} (proxy /api from Vite)`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[dev-api] Port ${PORT} is in use. Run: npx kill-port ${PORT}`);
  } else {
    console.error('[dev-api] Failed to start:', err.message);
  }
  process.exit(1);
});
