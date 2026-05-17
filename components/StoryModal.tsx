import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { Story, StoryContent } from '../types';
import { mobileWebpOf, aspectForLayout } from '../utils/images';
import { getOptimizedImagePath, getMobileOptimizedImage, getDesktopOptimizedImage, getResponsiveImageAttributes } from '../utils/optimizedImages';
import { findRelatedStories } from '../utils/relatedStories';
import { imagePreloader } from '../utils/imagePreloader';
import ImageShimmer from './ui/ImageShimmer';

interface StoryModalProps {
  story: Story;
  onClose: () => void;
  onOpenMenu?: () => void;
  onStorySelect?: (story: Story) => void;
}

const resolveHeroImage = (story: Story) => {
  // Use desktop version as default, mobile will be handled by <source> tag
  const originalPath = story.heroImage.startsWith('/') ? story.heroImage : `/${story.heroImage}`;
  return getDesktopOptimizedImage(originalPath, 'hero');
};

// HELPER: Group content by headings for sticky section navigation
const groupContentByHeadings = (content: StoryContent[]) => {
  const sections: { title: string | null; blocks: StoryContent[] }[] = [];
  let currentSection: { title: string | null; blocks: StoryContent[] } = { title: null, blocks: [] };

  content.forEach((item) => {
    if (item.type === 'heading') {
      if (currentSection.blocks.length > 0) sections.push(currentSection);
      currentSection = { title: item.text, blocks: [] };
    } else {
      currentSection.blocks.push(item);
    }
  });
  if (currentSection.blocks.length > 0) sections.push(currentSection);
  return sections;
};

const StoryModal: React.FC<StoryModalProps> = ({ story, onClose, onOpenMenu, onStorySelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);

  // Scroll to top when opening a different story (e.g. from related stories)
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [story.id]);

  // PROGRESS BAR LOGIC
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const heroResolved = resolveHeroImage(story);
  const mobileHeroSrc = mobileWebpOf(story.heroImage, 'hero');

  const sections = useMemo(() => groupContentByHeadings(story.content), [story.content]);
  const relatedStories = useMemo(() => findRelatedStories(story, 3), [story]);

  // Preload hero image immediately when modal opens
  useEffect(() => {
    imagePreloader.preloadImage(heroResolved, { fetchPriority: 'high' });
    imagePreloader.preloadImage(mobileHeroSrc, { fetchPriority: 'high' });
  }, [heroResolved, mobileHeroSrc]);

  // Lock body scroll on mount (position fixed + restore on unmount for WebKit/compat)
  useEffect(() => {
    const scrollY = window.scrollY;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = 'unset';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
      data-testid="story-modal"
      className="fixed inset-0 z-[80] bg-f1-black flex flex-col text-white"
      data-anthology-story-modal
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* PROGRESS BAR */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-[70]">
        <motion.div className="h-full bg-f1-red" style={{ scaleX, transformOrigin: "0%" }} />
      </div>

      {/* NAVIGATION OVERLAY */}
      <nav className="absolute top-0 w-full p-6 md:p-8 flex justify-between items-start z-[60] mix-blend-difference pointer-events-none">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-300">Archival Record</span>
          <span className="font-mono text-xs uppercase tracking-widest text-white font-bold mt-1">{story.id.toUpperCase()}</span>
        </div>
        <button
          onClick={onOpenMenu ?? onClose}
          aria-label={onOpenMenu ? 'Open menu and go to home' : 'Close story modal'}
          data-testid="story-modal-menu-button"
          className="pointer-events-auto group flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-white hover:text-f1-red transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black"
        >
          <span className="hidden md:inline-block opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-f1-red">[ ESC ]</span>
          <span className="border-b border-transparent group-hover:border-[#ff1801]">MENU</span>
        </button>
      </nav>

      {/* MAIN SCROLL CONTAINER */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative bg-f1-black hide-scrollbar"
        style={{ position: 'relative' }}
      >
        
        {/* HERO SECTION - Fixed at top with fade transition */}
        <div className="relative w-full bg-f1-black -mx-0 md:mx-0">
          {/* Hero Image Container - Full width, starts right below nav, no padding on mobile */}
          <div className="relative w-full" style={{ minHeight: '65vh', maxHeight: '95vh' }}>
            {!heroLoaded && (
              <ImageShimmer aspectRatio="16/9" className="absolute inset-0" />
            )}
            <picture className="block w-full h-full">
              <source media="(max-width: 640px)" srcSet={mobileWebpOf(story.heroImage, 'hero')} type="image/png" />
              <img 
                src={heroResolved} 
                className={`w-full h-full object-contain ${heroLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                alt={`${story.title} — ${story.year}`}
                width={1920}
                height={1080}
                style={{ 
                  aspectRatio: '16/9',
                  minHeight: '65vh',
                  maxHeight: '95vh',
                  objectFit: 'contain',
                  width: '100%'
                }}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onLoad={() => setHeroLoaded(true)}
              />
            </picture>
            
            {/* Enhanced smooth fade gradient at bottom - longer and smoother transition */}
            <div 
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{
                height: '400px',
                background: 'linear-gradient(to top, rgba(10, 10, 10, 1) 0%, rgba(10, 10, 10, 0.95) 20%, rgba(10, 10, 10, 0.85) 40%, rgba(10, 10, 10, 0.60) 60%, rgba(10, 10, 10, 0.30) 80%, transparent 100%)'
              }}
            />
            
            {/* Title overlay positioned lower in fade transition area */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 md:px-12 pb-8 md:pb-16 pointer-events-none">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                  <span className="px-2 md:px-3 py-1 border border-f1-red text-f1-red font-mono text-[9px] md:text-[10px] uppercase tracking-widest bg-f1-red/10 backdrop-blur-md shadow-[0_0_15px_rgba(255,24,1,0.3)]">
                    {story.year}
                  </span>
                  <span className="font-mono text-[10px] md:text-xs text-gray-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 bg-gray-300 rounded-full" /> {story.category}
                  </span>
                </div>
                
                <h1 id="story-modal-title" className="font-display text-4xl md:text-7xl lg:text-8xl leading-[0.9] text-white tracking-wide mb-4 md:mb-6 drop-shadow-2xl">
                  {story.title}
                </h1>
                
                <p className="font-sans text-sm md:text-lg text-gray-200 max-w-2xl leading-relaxed border-l-2 border-f1-red pl-3 md:pl-6 backdrop-blur-sm">
                  {story.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT LAYER */}
        <div className="relative z-20 bg-f1-black min-h-screen pt-8 md:pt-12 pb-48">
          <div className="max-w-screen-xl mx-auto px-6 md:px-8">
            
            {sections.map((section, idx) => {
              // Find background images in this section
              const backgroundImages = section.blocks.filter(
                block => block.type === 'image' && block.isBackground
              ) as Array<{ type: 'image'; src: string; layout: 'full' | 'portrait' | 'landscape'; isBackground: true }>;
              
              return (
                <section key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 mb-24 border-t border-white/5 pt-16 first:border-none first:pt-0 relative">
                  
                  {/* Sticky Chapter Marker */}
                  <div className="md:col-span-4 relative z-10">
                    <div className="sticky top-32 transition-all duration-500 bg-f1-black/80 backdrop-blur-md p-6 -ml-6 rounded-lg border border-white/5">
                      <span className="block font-mono text-[9px] text-f1-red mb-2 uppercase tracking-[0.2em]">
                        {section.title ? `Sequence 0${idx + 1}` : 'Prologue'}
                      </span>
                      {section.title && (
                        <h2 className="font-display text-4xl md:text-5xl text-white leading-none mb-4 tracking-wide">
                          {section.title}
                        </h2>
                      )}
                      <div className="w-12 h-[1px] bg-white/20" />
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="md:col-span-7 md:col-start-6 space-y-12 relative z-10">
                    {/* Render background images behind content */}
                    {backgroundImages.map((block, bgIdx) => (
                      <BackgroundImageBlock 
                        key={`bg-${bgIdx}`}
                        src={block.src} 
                        layout={block.layout} 
                        year={story.year}
                      />
                    ))}
                    
                    {/* Render regular content blocks */}
                    {section.blocks.map((block, bIdx) => (
                      <ContentBlock 
                        key={bIdx}
                        block={block} 
                        isFirst={idx === 0 && bIdx === 0} 
                        year={story.year}
                        skipRender={block.type === 'image' && block.isBackground}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Related Stories Section */}
            {relatedStories.length > 0 && (
              <div className="pt-32 pb-16 border-t border-white/10 mt-16">
                <div className="max-w-6xl mx-auto px-4 md:px-12">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="mb-12"
                  >
                    <h3 className="font-display text-4xl md:text-5xl text-white mb-4 tracking-wide">Related Stories</h3>
                    <p className="font-mono text-sm text-gray-400 uppercase tracking-widest">
                      Continue the narrative
                    </p>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {relatedStories.map((relatedStory, index) => (
                      <motion.div
                        key={relatedStory.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="group cursor-pointer"
                        onClick={() => {
                          if (onStorySelect) {
                            onStorySelect(relatedStory);
                          }
                        }}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden bg-f1-black/50 border border-white/10 rounded-sm mb-4">
                          <img
                            src={getDesktopOptimizedImage(relatedStory.heroImage.startsWith('/') ? relatedStory.heroImage : `/${relatedStory.heroImage}`, 'hero')}
                            alt={relatedStory.title}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-f1-black via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <span className="font-mono text-[10px] text-f1-red uppercase tracking-widest">
                              {relatedStory.year}
                            </span>
                          </div>
                        </div>
                        <h4 className="font-display text-2xl text-white mb-2 group-hover:text-f1-red transition-colors tracking-wide">
                          {relatedStory.title}
                        </h4>
                        <p className="font-mono text-xs text-gray-400 line-clamp-2">
                          {relatedStory.subtitle}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer/End Marker */}
            <div className="flex flex-col items-center justify-center pt-32 opacity-30 hover:opacity-60 transition-opacity duration-500 gap-4">
              <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-white to-transparent" />
              <div className="font-condensed text-2xl italic tracking-wide">End of Record</div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- SUB-COMPONENTS (Modular & Animated) ---

const ContentBlock: React.FC<{ block: StoryContent; isFirst: boolean; year: string; skipRender?: boolean }> = ({ block, isFirst, year, skipRender }) => {
  if (skipRender) return null;
  
  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock text={block.text} isFirst={isFirst} />;
    case 'quote':
      return <QuoteBlock text={block.text} author={block.author} />;
    case 'image':
      return <ImageBlock src={block.src} caption={block.caption} layout={block.layout} year={year} />;
    case 'heading':
      return null; // Handled in parent grouping
    default:
      return null;
  }
};

const ParagraphBlock: React.FC<{ text: string; isFirst: boolean }> = React.memo(({ text, isFirst }) => (
  <p className={`font-sans text-lg md:text-xl text-[#d4d4d4] leading-[1.7] font-light tracking-wide antialiased
    ${isFirst 
      ? 'first-letter:float-left first-letter:text-6xl md:first-letter:text-8xl first-letter:font-display first-letter:text-white first-letter:mr-4 first-letter:mt-[-10px] first-letter:leading-[0.8]' 
      : ''}
  `}>
    {text}
  </p>
));

const QuoteBlock: React.FC<{ text: string; author: string }> = React.memo(({ text, author }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  
  return (
    <motion.figure 
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative py-8 my-12 pl-6 md:pl-10 border-l-2 border-f1-red bg-white/[0.02] will-change-transform"
    >
      <blockquote className="font-condensed text-2xl md:text-3xl text-white leading-tight italic tracking-wide">
        "{text}"
      </blockquote>
      <figcaption className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10 w-fit">
        <span className="font-mono text-[10px] text-f1-red uppercase tracking-widest font-bold">{author}</span>
      </figcaption>
    </motion.figure>
  );
});

 

// Background image component for decorative elements
const BackgroundImageBlock: React.FC<{ src: string; layout: 'full' | 'portrait' | 'landscape'; year: string }> = React.memo(({ src, layout, year }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });
  const [loaded, setLoaded] = useState(false);
  
  const originalPath = src.startsWith('/') ? src : `/${src}`;
  const desktopSrc = getDesktopOptimizedImage(originalPath, layout);
  const mobileSrc = getMobileOptimizedImage(originalPath, layout);
  
  useEffect(() => {
    if (isInView && !loaded) {
      imagePreloader.preloadImage(desktopSrc, { fetchPriority: 'low' });
      if (mobileSrc !== desktopSrc) {
        imagePreloader.preloadImage(mobileSrc, { fetchPriority: 'low' });
      }
    }
  }, [isInView, desktopSrc, mobileSrc, loaded]);

  return (
    <div ref={ref} className="absolute top-0 left-0 right-0 bottom-0 -z-10 overflow-hidden pointer-events-none opacity-0" style={{ minHeight: '400px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={isInView ? { opacity: 0.12, scale: 1 } : {}}
        transition={{ duration: 2, ease: "easeOut" }}
        className="relative w-full h-full flex items-center justify-center"
      >
        <picture>
          <source media="(max-width: 640px)" srcSet={mobileSrc} type="image/png" />
          <img 
            src={desktopSrc}
            alt="" 
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            width={aspectForLayout(layout).width}
            height={aspectForLayout(layout).height}
            style={{ 
              aspectRatio: layout === 'portrait' ? '3/4' : layout === 'landscape' ? '16/9' : '16/9',
              objectFit: 'contain',
              maxWidth: '60%',
              maxHeight: '80%',
              filter: 'blur(0.5px)',
            }}
            onLoad={() => setLoaded(true)}
            className="grayscale-[70%] contrast-[0.7] brightness-[0.6]"
          />
        </picture>
      </motion.div>
    </div>
  );
});

BackgroundImageBlock.displayName = 'BackgroundImageBlock';

const ImageBlock: React.FC<{ src: string; caption: string; layout: 'full' | 'portrait' | 'landscape'; year: string }> = React.memo(({ src, caption, layout, year }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  
  // Get optimized image paths
  const originalPath = src.startsWith('/') ? src : `/${src}`;
  const optimizedSrc = getOptimizedImagePath(originalPath, layout);
  const mobileSrc = getMobileOptimizedImage(originalPath, layout);
  const desktopSrc = getDesktopOptimizedImage(originalPath, layout);
  
  // Preload image when in view - prioritize story images (23-40)
  useEffect(() => {
    if (isInView && !loaded) {
      // Extract image number from path to determine priority
      const imageNumberMatch = desktopSrc.match(/\/(\d+)\.png$/);
      const imageNumber = imageNumberMatch ? parseInt(imageNumberMatch[1]) : 0;
      const isNewStoryImage = imageNumber >= 23 && imageNumber <= 40;
      
      const priority = isNewStoryImage ? 'high' : 'auto';
      imagePreloader.preloadImage(desktopSrc, { fetchPriority: priority });
      if (mobileSrc !== desktopSrc) {
        imagePreloader.preloadImage(mobileSrc, { fetchPriority: priority });
      }
    }
  }, [isInView, desktopSrc, mobileSrc, loaded]);

  // Layout logic: Break the grid for full width images
  const containerClass = layout === 'full' 
    ? 'w-[100vw] relative left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] md:w-[120%] md:left-auto md:right-auto md:-ml-[15%]' 
    : 'w-full';

  return (
    <div ref={ref} className={`my-20 ${containerClass}`}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 1, ease: "circOut" }}
        className="relative group will-change-transform"
      >
        {!errored && (
          <picture>
            {/* AVIF support for modern browsers */}
            {(() => {
              const responsiveAttrs = getResponsiveImageAttributes(originalPath, layout);
              return (
                <>
                  <source 
                    media="(max-width: 640px)" 
                    srcSet={mobileSrc} 
                    type="image/png" 
                  />
                  {responsiveAttrs.srcSet && (
                    <source 
                      srcSet={responsiveAttrs.srcSet} 
                      sizes={responsiveAttrs.sizes}
                      type="image/avif" 
                    />
                  )}
                </>
              );
            })()}
            <img 
              src={desktopSrc}
              srcSet={getResponsiveImageAttributes(originalPath, layout).srcSet}
              sizes={getResponsiveImageAttributes(originalPath, layout).sizes}
              alt={caption} 
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              fetchPriority={(() => {
                const imageNumberMatch = desktopSrc.match(/\/(\d+)\.png$/);
                const imageNumber = imageNumberMatch ? parseInt(imageNumberMatch[1]) : 0;
                return (imageNumber >= 23 && imageNumber <= 40) ? 'high' : 'low';
              })()}
              width={aspectForLayout(layout).width}
              height={aspectForLayout(layout).height}
              style={{ 
                aspectRatio: layout === 'portrait' ? '3/4' : layout === 'landscape' ? '16/9' : '16/9'
              }}
              onLoad={() => {
                setLoaded(true);
                setErrored(false);
              }}
              onError={(e) => {
                console.warn(`Failed to load image: ${desktopSrc}`);
                setErrored(true);
                setLoaded(false);
              }}
              className={`w-full h-auto object-cover max-h-[80vh] ${parseInt(year) <= 1980 ? 'sepia-[15%] contrast-[1.0]' : parseInt(year) <= 2005 ? 'grayscale-[20%] contrast-[1.05]' : 'grayscale-[10%] contrast-[1.1]'} group-hover:grayscale-0 transition-all duration-[1500ms] ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </picture>
        )}
        {!loaded && !errored && (
          <ImageShimmer 
            aspectRatio={layout === 'portrait' ? '3/4' : layout === 'landscape' ? '16/9' : '16/9'}
            className="absolute inset-0"
          />
        )}
        {errored && (
          <div className="w-full h-64 flex items-center justify-center bg-f1-black/50 border border-white/10">
            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              Image unavailable
            </p>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex justify-between items-end">
           <p className="font-mono text-[10px] text-white uppercase tracking-widest">
             FIG_Ref: {caption}
           </p>
           <div className="h-[1px] w-12 bg-f1-red" />
        </div>
      </motion.div>
    </div>
  );
});

export default StoryModal;
