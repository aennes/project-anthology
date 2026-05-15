import { logger } from './logger';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  sources?: string[];
  image: string;
  publishedAt: string;
  publishedTs?: number;
  dateLabel?: string;
}

const CACHE_KEY = 'news_cache_v2';
/** Items are considered fresh for 30 min; older items still rendered while we revalidate. */
const FRESH_TTL_MS = 30 * 60 * 1000;
const FALLBACK_NEWS_URL = '/news-fallback.json';
const API_TIMEOUT_MS = 8000;

interface CachePayload {
  ts: number;
  items: NewsItem[];
}

function now(): number {
  return Date.now();
}

function readCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as CachePayload;
    if (!obj || !Array.isArray(obj.items) || obj.items.length === 0) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeCache(items: NewsItem[]): void {
  try {
    if (!items.length) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now(), items } satisfies CachePayload));
  } catch {
    /* quota / private mode — ignore */
  }
}

function tsOf(item: NewsItem): number {
  if (typeof item.publishedTs === 'number' && Number.isFinite(item.publishedTs) && item.publishedTs > 0) {
    return item.publishedTs;
  }
  const parsed = Date.parse(item.publishedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Most-recent first; items with no parseable date sink to the bottom. */
export function sortByDate(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const ta = tsOf(a);
    const tb = tsOf(b);
    if (ta === 0 && tb === 0) return 0;
    if (ta === 0) return 1;
    if (tb === 0) return -1;
    return tb - ta;
  });
}

/** Synchronous cache read for first paint. */
export function readNewsCache(): NewsItem[] | null {
  const cache = readCache();
  return cache ? sortByDate(cache.items) : null;
}

export function isCacheFresh(): boolean {
  const cache = readCache();
  return !!cache && now() - cache.ts < FRESH_TTL_MS;
}

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('Content-Type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error('Non-JSON response');
    }
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

let inflight: Promise<NewsItem[]> | null = null;

/**
 * Fetch fresh news from the API. Concurrent callers share the same promise.
 * On API failure, falls back to the static JSON file. Caller is responsible for
 * deciding whether to display cached items meanwhile (see `fetchNews`).
 */
export function refreshFromNetwork(): Promise<NewsItem[]> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const items = await fetchJSON<NewsItem[]>('/api/news', API_TIMEOUT_MS);
      if (!Array.isArray(items)) throw new Error('Bad payload');
      const sorted = sortByDate(items);
      if (sorted.length > 0) writeCache(sorted);
      return sorted;
    } catch (err) {
      logger.warn('News API failed, trying static fallback:', err);
      try {
        const fallback = await fetchJSON<NewsItem[]>(FALLBACK_NEWS_URL, 4000);
        if (Array.isArray(fallback) && fallback.length > 0) return sortByDate(fallback);
      } catch (fallbackErr) {
        logger.warn('Static fallback failed:', fallbackErr);
      }
      throw err instanceof Error ? err : new Error('Network error');
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Stale-while-revalidate getter:
 * - Returns cached items immediately when present (caller should already have shown them).
 * - Otherwise awaits a network fetch.
 * Either way it triggers a background refresh if the cache is not fresh.
 */
export async function fetchNews(): Promise<NewsItem[]> {
  const cache = readCache();

  if (cache) {
    if (!isCacheFresh()) {
      // Stale-while-revalidate: return cache; refresh in background.
      refreshFromNetwork().catch(() => {/* swallow */});
    }
    return sortByDate(cache.items);
  }

  // No cache — must wait for the network.
  return refreshFromNetwork();
}

/**
 * Fire-and-forget background refresh. Called once at app mount from the top-level
 * component so the news cache is warm from the very first page load, regardless
 * of which route the user landed on. Swallows all errors so it never surfaces
 * to the UI; the News page itself handles error UI via fetchNews().
 */
export function warmNewsOnLoad(): void {
  if (isCacheFresh()) return;
  try {
    void refreshFromNetwork().catch(() => {
      /* intentionally silent — non-blocking warmup */
    });
  } catch {
    /* intentionally silent */
  }
}
