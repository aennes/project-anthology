import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { fetchNews, refreshFromNetwork, readNewsCache, isCacheFresh, sortByDate, NewsItem } from '../utils/newsService';
import { imagePreloader } from '../utils/imagePreloader';
import ImageShimmer from './ui/ImageShimmer';

interface NewsProps {
  onClose?: () => void;
}

const PLACEHOLDER_IMG = '/favicon.svg';
/** Re-check the API every 5 min while the page is open. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const News: React.FC<NewsProps> = React.memo(() => {
  const [items, setItems] = useState<NewsItem[]>(() => readNewsCache() ?? []);
  const [loading, setLoading] = useState<boolean>(items.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});

  const preloadHero = useCallback((list: NewsItem[]) => {
    list.slice(0, 9).forEach((it) => {
      if (it.image && it.image.startsWith('http')) {
        imagePreloader.preloadImage(it.image, { fetchPriority: 'high' });
      }
    });
  }, []);

  const applyItems = useCallback(
    (next: NewsItem[]) => {
      const sorted = sortByDate(next);
      setItems(sorted);
      preloadHero(sorted);
    },
    [preloadHero],
  );

  // First load: serve cache immediately, then revalidate.
  useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      const cached = readNewsCache();
      if (cached?.length) {
        if (!cancelled) {
          applyItems(cached);
          setError(null);
          setLoading(false);
        }
        if (isCacheFresh()) return;
      }
      try {
        const data = await fetchNews();
        if (!cancelled && data.length > 0) {
          applyItems(data);
          setError(null);
        } else if (!cancelled && !cached?.length) {
          setError('Could not load latest headlines.');
        }
      } catch (err) {
        if (!cancelled && !cached?.length) {
          setError('Could not load latest headlines.');
        }
        console.warn('News initial load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initial();

    const tick = () => {
      refreshFromNetwork()
        .then((data) => {
          if (!cancelled && data.length > 0) {
            applyItems(data);
            setError(null);
          }
        })
        .catch(() => {/* keep showing whatever we have */});
    };

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageLoad = useCallback((itemId: string) => {
    setImageLoaded((prev) => (prev[itemId] ? prev : { ...prev, [itemId]: true }));
  }, []);

  const handleCardClick = useCallback((item: NewsItem) => {
    if (!item.url || !item.url.startsWith('http')) return;
    window.open(item.url, '_blank', 'noopener,noreferrer');
  }, []);

  const truncate = (text: string, n = 250): string => {
    if (!text) return '';
    return text.length > n ? `${text.slice(0, n - 1)}…` : text;
  };

  const sanitizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        sanitizedTitle: DOMPurify.sanitize(item.title, { ALLOWED_TAGS: [] }),
        sanitizedSummary: DOMPurify.sanitize(truncate(item.summary, 160), { ALLOWED_TAGS: [] }),
        attributionSources: (item.sources && item.sources.length > 0 ? item.sources : [item.sourceName]).filter(Boolean),
      })),
    [items],
  );

  const showSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="relative min-h-screen bg-f1-black text-white pt-24 pb-20 px-4 sm:px-6 md:px-8 lg:px-10">
      <div className="max-w-[1600px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-8 md:mb-10 text-center max-w-3xl mx-auto"
        >
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl mb-3 md:mb-4 tracking-wide">
            <span className="text-f1-red">F1</span> News
          </h1>
          <p className="font-mono text-[11px] sm:text-xs md:text-sm text-gray-400 uppercase tracking-[0.2em] leading-relaxed">
            Curated from The Race, Autosport &amp; Motorsport.com
          </p>
        </motion.div>

        {showSkeleton && (
          <p className="text-center font-mono text-sm text-gray-500 py-16">Loading…</p>
        )}

        {(error || showEmpty) && !showSkeleton && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-gray-400 mb-2">
              {error || 'No headlines available right now.'}
            </p>
            <p className="font-mono text-[11px] text-gray-600 uppercase tracking-widest">
              Refreshing automatically in the background.
            </p>
          </div>
        )}

        {sanitizedItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            {sanitizedItems.map((item, index) => {
              const isImageLoaded = imageLoaded[item.id] || false;

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(index * 0.04, 0.35),
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  whileHover={{
                    y: -6,
                    transition: { duration: 0.22, ease: 'easeOut' },
                  }}
                  whileTap={{ scale: 0.99 }}
                  className="group cursor-pointer flex flex-col h-full min-h-[260px] sm:min-h-[280px] md:min-h-[300px] bg-f1-carbon/90 border border-white/10 hover:border-f1-red/45 rounded-xl overflow-hidden shadow-sm hover:shadow-[0_12px_40px_-8px_rgba(255,24,1,0.18)] transition-[box-shadow,border-color] duration-300"
                  onClick={() => handleCardClick(item)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(item);
                    }
                  }}
                  aria-label={`${item.sanitizedTitle} — open at ${item.sourceName}`}
                >
                  <div className="relative h-36 sm:h-40 md:h-40 shrink-0 bg-f1-black overflow-hidden">
                    {!isImageLoaded && (
                      <div className="absolute inset-0 z-[1]">
                        <ImageShimmer />
                      </div>
                    )}
                    <img
                      src={item.image || PLACEHOLDER_IMG}
                      alt={item.title || 'News headline'}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out ${
                        isImageLoaded ? 'opacity-100' : 'opacity-0'
                      } group-hover:scale-[1.06]`}
                      onLoad={() => handleImageLoad(item.id)}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('favicon.svg')) {
                          target.src = PLACEHOLDER_IMG;
                        }
                        handleImageLoad(item.id);
                      }}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index < 3 ? 'high' : index < 9 ? 'auto' : 'low'}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      referrerPolicy="no-referrer"
                      width={640}
                      height={360}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-f1-black/90 via-f1-black/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-300 pointer-events-none" />
                    {item.dateLabel && (
                      <div className="absolute top-2.5 right-2.5 z-[2] pointer-events-none">
                        <span className="font-mono text-[10px] sm:text-xs text-white/90 uppercase tracking-widest bg-black/55 backdrop-blur-sm px-2 py-1 rounded border border-white/15">
                          {item.dateLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 min-h-0 p-4 md:p-5 pt-3 md:pt-4">
                    <h3 className="font-condensed text-xl sm:text-2xl md:text-[1.55rem] text-white mb-2 group-hover:text-f1-red transition-colors duration-300 leading-snug line-clamp-2">
                      {item.sanitizedTitle}
                    </h3>
                    {item.sanitizedSummary && (
                      <p className="font-mono text-[11px] sm:text-xs text-gray-400 leading-relaxed line-clamp-3 mb-3 flex-1 min-h-0">
                        {item.sanitizedSummary}
                      </p>
                    )}
                    <div className="mt-auto pt-3 border-t border-white/10 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest shrink-0">
                          {item.attributionSources.length > 1 ? 'Sources' : 'Source'}
                        </span>
                        <span className="text-gray-600 hidden sm:inline">·</span>
                        <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                          {item.attributionSources.map((source, idx) => {
                            const isPrimary = source === item.sourceName;
                            return (
                              <span
                                key={`${item.id}-src-${idx}`}
                                className={`font-mono text-[10px] sm:text-[11px] uppercase tracking-wide ${
                                  isPrimary ? 'text-f1-red' : 'text-f1-red/70'
                                }`}
                                title={isPrimary ? 'Primary source' : 'Also covered'}
                              >
                                {source}
                                {idx < item.attributionSources.length - 1 && (
                                  <span className="text-gray-600 mx-0.5">·</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 text-f1-red opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="font-mono text-[10px] uppercase tracking-widest">Read</span>
                        <span aria-hidden className="translate-x-0 group-hover:translate-x-0.5 transition-transform inline-block">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {sanitizedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-12 md:mt-14 pt-6 md:pt-8 border-t border-white/10 text-center"
          >
            <p className="font-mono text-xs text-gray-500 leading-relaxed max-w-3xl mx-auto mb-4">
              Headlines, summaries and images are pulled directly from the original outlets for navigation only.
              Click a card to read the full story at the source.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <span className="font-mono uppercase tracking-widest">Sources:</span>
              <a href="https://www.the-race.com" target="_blank" rel="noopener noreferrer" className="hover:text-f1-red transition-colors">
                The Race
              </a>
              <span>•</span>
              <a href="https://www.autosport.com" target="_blank" rel="noopener noreferrer" className="hover:text-f1-red transition-colors">
                Autosport
              </a>
              <span>•</span>
              <a href="https://www.motorsport.com" target="_blank" rel="noopener noreferrer" className="hover:text-f1-red transition-colors">
                Motorsport.com
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
});

News.displayName = 'News';

export default News;
