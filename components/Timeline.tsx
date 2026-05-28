import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Story } from '../types';
import { storyMetadata } from '../data/storyMetadata';
import { getDesktopOptimizedImage, getMobileOptimizedImage } from '../utils/optimizedImages';
import ImageShimmer from './ui/ImageShimmer';

interface TimelineProps {
  onStorySelect: (story: Story) => void;
  onClose?: () => void;
}

const Timeline: React.FC<TimelineProps> = ({ onStorySelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});

  const sortedStories = [...storyMetadata].sort((a, b) => parseInt(a.year) - parseInt(b.year));

  const storiesByDecade = sortedStories.reduce((acc, story) => {
    const decade = Math.floor(parseInt(story.year) / 10) * 10;
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(story);
    return acc;
  }, {} as Record<number, typeof storyMetadata>);

  const decades = Object.keys(storiesByDecade)
    .map(Number)
    .sort((a, b) => a - b);

  const handleStoryClick = (story: Story) => {
    onStorySelect({ ...story, content: [] });
  };

  const handleImageLoad = (storyId: string) => {
    setImageLoaded((prev) => ({ ...prev, [storyId]: true }));
  };

  return (
    <div className="timeline-page relative min-h-screen bg-f1-black text-paper">
      <header
        className="timeline-page__hero cine-letterbox cine-vignette"
        aria-labelledby="timeline-hero-title"
      >
        <span className="cine-hero-glow" aria-hidden="true" />
        <span className="cine-hero-grain" aria-hidden="true" />
        <div className="timeline-page__hero-inner cine-route-hero">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[2px] w-12 bg-[#ff1801]" />
            <span className="font-section-divider text-[12px] tracking-[0.2em] uppercase text-[rgba(255,24,1,0.82)]">
              FORMULA 1 · HISTORICAL ARCHIVE
            </span>
            <div className="h-[2px] w-12 bg-[#ff1801]" />
          </div>
          <h1 id="timeline-hero-title">Chronological Timeline</h1>
          <div className="h-[2px] w-24 bg-[#ff1801] mt-2 mx-auto" />
          <p className="timeline-page__deck">The narrative history of Formula 1</p>
          <p className="timeline-page__detail">Scroll the decades · Open any story</p>
        </div>
        <div className="absolute bottom-6 left-0 right-0 flex justify-center md:hidden" style={{ zIndex: 9 }} aria-hidden="true">
          <span className="animate-bounce text-white/50 text-lg leading-none select-none">↓</span>
        </div>
      </header>

      <div className="timeline-page__fade" aria-hidden="true" />

      <div className="timeline-page__body" ref={containerRef}>
        <aside className="timeline-page__spine" aria-label="Decades">
          <nav className="timeline-page__spine-rail">
            <span className="timeline-page__spine-line" aria-hidden="true" />
            {decades.map((decade) => (
              <a
                key={decade}
                href={`#decade-${decade}`}
                className={`timeline-page__spine-decade${
                  storiesByDecade[decade].some((s) => s.year === selectedYear) ? ' is-active' : ''
                }`}
              >
                {decade}s
              </a>
            ))}
          </nav>
        </aside>

        <motion.div
          className="timeline-page__feed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {decades.map((decade, decadeIndex) => (
            <motion.section
              key={decade}
              id={`decade-${decade}`}
              className="timeline-decade"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.5, delay: decadeIndex * 0.05 }}
            >
              <div className="timeline-decade__label">
                <span>{decade}s</span>
              </div>

              {storiesByDecade[decade].map((story, storyIndex) => {
                const isReverse = storyIndex % 2 === 1;
                const heroImage = getDesktopOptimizedImage(story.heroImage, 'hero');
                const heroImageMobile = getMobileOptimizedImage(story.heroImage, 'hero');
                const isImageLoaded = imageLoaded[story.id];

                return (
                  <motion.article
                    key={story.id}
                    className="timeline-node"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-6%' }}
                    transition={{ duration: 0.45, delay: storyIndex * 0.06 }}
                    onMouseEnter={() => setSelectedYear(story.year)}
                    onMouseLeave={() => setSelectedYear(null)}
                  >
                    <div
                      className={`timeline-node__card cine-hover-lift${
                        isReverse ? ' timeline-node__card--reverse' : ''
                      }`}
                      onClick={() => handleStoryClick(story)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStoryClick(story);
                        }
                      }}
                      aria-label={`Read story: ${story.title}`}
                    >
                      <div className="timeline-node__media cine-duotone">
                        {!isImageLoaded && <ImageShimmer />}
                        <picture>
                          <source media="(max-width: 1023px)" srcSet={heroImageMobile} />
                          <img
                            src={heroImage}
                            alt={story.title}
                            className={isImageLoaded ? 'opacity-100' : 'opacity-0'}
                            onLoad={() => handleImageLoad(story.id)}
                            loading="lazy"
                            decoding="async"
                          />
                        </picture>
                        <span className="timeline-node__year">{story.year}</span>
                        <span className="timeline-node__category">{story.category}</span>
                      </div>

                      <div className="timeline-node__copy">
                        <h3 className="timeline-node__title">{story.title}</h3>
                        <p className="timeline-node__subtitle">{story.subtitle}</p>
                        <div className="timeline-node__cta" aria-hidden>
                          <span>Read story</span>
                          <span className="timeline-node__cta-line" />
                          <span>→</span>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.section>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Timeline;
