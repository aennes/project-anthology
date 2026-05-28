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
const PAGE_SIZE = 15;

const News: React.FC<NewsProps> = React.memo(() => {
  const [items, setItems] = useState<NewsItem[]>(() => readNewsCache() ?? []);
  const [loading, setLoading] = useState<boolean>(items.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

    const revalidate = () => {
      if (document.hidden) return;
      refreshFromNetwork()
        .then((data) => {
          if (!cancelled && data.length > 0) {
            applyItems(data);
            setError(null);
          }
        })
        .catch(() => {/* keep showing whatever we have */});
    };

    const initial = async () => {
      const cached = readNewsCache();
      if (cached?.length) {
        if (!cancelled) {
          applyItems(cached);
          setError(null);
          setLoading(false);
        }
        if (isCacheFresh()) return;
        revalidate();
        return;
      }
      try {
        const data = await fetchNews();
        if (!cancelled && data.length > 0) {
          applyItems(data);
          setError(null);
        } else if (!cancelled) {
          setError('Could not load latest headlines.');
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not load latest headlines.');
        }
        console.warn('News initial load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initial();

    const interval = window.setInterval(revalidate, REFRESH_INTERVAL_MS);
    const onFocus = () => revalidate();
    const onVisible = () => {
      if (!document.hidden) revalidate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
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

  // First article becomes the hero when it has a valid image
  const heroItem = sanitizedItems.length > 0 && sanitizedItems[0].image && sanitizedItems[0].image.startsWith('http')
    ? sanitizedItems[0]
    : null;
  const gridOffset = heroItem ? 1 : 0;

  const gridItems = useMemo(
    () => sanitizedItems.slice(gridOffset, gridOffset + visibleCount),
    [sanitizedItems, gridOffset, visibleCount],
  );
  const hasMore = visibleCount < sanitizedItems.length - gridOffset;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((count) => count + PAGE_SIZE);
  }, []);

  const showSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <motion.div
      className="news-page relative min-h-screen bg-f1-black text-paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <header
        className={`news-page__hero cine-vignette${heroItem ? '' : ' cine-letterbox'}`}
        aria-labelledby="news-hero-title"
        style={heroItem ? { minHeight: 'clamp(420px, 68vh, 720px)' } : undefined}
      >
        {heroItem ? (
          <>
            <img
              src={heroItem.image!}
              alt=""
              aria-hidden="true"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => handleImageLoad(heroItem.id)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: 0 }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)', zIndex: 1 }}
            />
          </>
        ) : (
          <span className="cine-hero-glow" aria-hidden="true" />
        )}
        <span className="cine-hero-grain" aria-hidden="true" />

        <div className="news-page__hero-inner cine-route-hero" style={{ position: 'relative', zIndex: 8 }}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[2px] w-12 bg-[#ff1801]" />
            <span className="font-section-divider text-[12px] tracking-[0.2em] uppercase text-[rgba(255,24,1,0.82)]">
              ANTHOLOGY · HEADLINES
            </span>
            <div className="h-[2px] w-12 bg-[#ff1801]" />
          </div>

          {heroItem ? (
            <>
              <h1
                id="news-hero-title"
                className="font-display text-white leading-[0.9] tracking-wide mb-3"
                style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
              >
                {heroItem.sanitizedTitle}
              </h1>
              <div className="h-[2px] w-24 bg-[#ff1801] mx-auto mb-4" />
              {heroItem.sanitizedSummary && (
                <p className="font-sans text-base text-white/75 max-w-2xl mx-auto mb-6 leading-relaxed">
                  {heroItem.sanitizedSummary}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleCardClick(heroItem)}
                className="font-section-divider text-[14px] uppercase tracking-[0.2em] bg-[#ff1801] text-white px-8 py-3 cursor-pointer border-0 hover:bg-[#cc1400] transition-colors duration-200"
              >
                Read Full Report →
              </button>
            </>
          ) : (
            <>
              <h1 id="news-hero-title">
                <span className="text-f1-red">F1</span> News
              </h1>
              <div className="h-[2px] w-24 bg-[#ff1801] mt-2 mx-auto" />
              <p className="news-page__deck">
                Curated from The Race, Autosport &amp; Motorsport.com
              </p>
              <p className="news-page__detail">Refreshes automatically while you browse</p>
            </>
          )}
        </div>
        <div className="absolute bottom-6 left-0 right-0 flex justify-center md:hidden" style={{ zIndex: 9 }} aria-hidden="true">
          <span className="animate-bounce text-white/50 text-lg leading-none select-none">↓</span>
        </div>
      </header>

      <div className="news-page__fade" aria-hidden="true" />

      <div className="news-page__body">
        {showSkeleton && (
          <motion.div
            className="news-page__skeleton"
            aria-busy="true"
            aria-label="Loading headlines"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="news-page__skeleton-card" />
            ))}
          </motion.div>
        )}

        {(error || showEmpty) && !showSkeleton && (
          <motion.div
            className="news-page__state"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p>{error || 'No headlines available right now.'}</p>
            <p>Refreshing automatically in the background.</p>
          </motion.div>
        )}

        {gridItems.length > 0 && (
          <div className="news-page__grid">
            {gridItems.map((item, index) => {
              const isImageLoaded = imageLoaded[item.id] || false;

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.04, 0.35),
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="news-card group"
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
                  <div className="news-card__media">
                    {!isImageLoaded && (
                      <div className="absolute inset-0 z-[1]">
                        <ImageShimmer />
                      </div>
                    )}
                    <img
                      src={item.image || PLACEHOLDER_IMG}
                      alt={item.title || 'News headline'}
                      className={isImageLoaded ? 'opacity-100' : 'opacity-0'}
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
                    {item.dateLabel && (
                      <span className="news-card__date">{item.dateLabel}</span>
                    )}
                  </div>

                  <div className="news-card__body">
                    <h3 className="news-card__title">{item.sanitizedTitle}</h3>
                    {item.sanitizedSummary && (
                      <p className="news-card__summary">{item.sanitizedSummary}</p>
                    )}
                    <div className="news-card__foot">
                      <p className="news-card__sources">
                        <span>{item.attributionSources.length > 1 ? 'Sources · ' : 'Source · '}</span>
                        {item.attributionSources.map((source, idx) => {
                          const isPrimary = source === item.sourceName;
                          return (
                            <span key={`${item.id}-src-${idx}`}>
                              <strong className={isPrimary ? '' : 'opacity-80'}>{source}</strong>
                              {idx < item.attributionSources.length - 1 && ' · '}
                            </span>
                          );
                        })}
                      </p>
                      <div className="news-card__read">
                        <span>Read</span>
                        <span aria-hidden>→</span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="news-page__load-more">
            <button
              type="button"
              className="news-page__load-more-btn"
              onClick={handleLoadMore}
            >
              Load more
            </button>
          </div>
        )}

        {sanitizedItems.length > 0 && (
          <motion.footer
            className="news-page__footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p>
              Headlines, summaries and images are pulled directly from the original outlets for navigation only.
              Click a card to read the full story at the source.
            </p>
            <div className="news-page__footer-links">
              <span className="font-mono uppercase tracking-widest text-[10px]">Sources</span>
              <a href="https://www.the-race.com" target="_blank" rel="noopener noreferrer">
                The Race
              </a>
              <span aria-hidden>·</span>
              <a href="https://www.autosport.com" target="_blank" rel="noopener noreferrer">
                Autosport
              </a>
              <span aria-hidden>·</span>
              <a href="https://www.motorsport.com" target="_blank" rel="noopener noreferrer">
                Motorsport.com
              </a>
            </div>
          </motion.footer>
        )}
      </div>
    </motion.div>
  );
});

News.displayName = 'News';

export default News;
