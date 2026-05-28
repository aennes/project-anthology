import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Story } from "../types";
import { storyMetadata } from "../data/storyMetadata";
import { mobileWebpOf } from "../utils/images";
import { getOptimizedImagePath, getDesktopOptimizedImage } from "../utils/optimizedImages";
import { preloadOnVisible } from "../utils/imagePreloader";
import {
  archiveCardContainer,
  archiveCardImage,
  archiveBadgeDot,
  anthologyYearBadge,
} from "./ui/classes";
import Button from "./ui/Button";
import ImageShimmer from "./ui/ImageShimmer";

// Story layout mapping - determines which image folder to use
const storyLayoutMap: Record<string, 'hero' | 'full' | 'portrait'> = {
  // Keep existing good ratios (hero/landscape)
  'senna-monaco': 'hero',
  'hunt-lauda': 'hero',
  'massa-2008': 'hero',
  'hakkinen-schumacher': 'hero',
  'fangio-nurburgring': 'hero',
  'collins-fangio-1956': 'hero',
  'senna-donington-1993': 'hero',
  'dijon-1979': 'hero',
  
  // Change to full (16:9 horizontal)
  'schumacher-ferrari': 'full',
  'hamilton-silverstone': 'full',
  'button-canada': 'full',
  'brawn-2009': 'full',
  'schumacher-1994-spain': 'full',
  'monaco-1982': 'full',
  'jerez-1997': 'full',
  
  // Change to portrait (9:16 vertical)
  'imola-1994': 'portrait',
};

const resolveHeroImage = (story: Story) => {
  // Use optimized PNG images from layout-specific folders
  // Default to desktop version, mobile will be handled by <source> tag
  const originalPath = story.heroImage.startsWith('/') ? story.heroImage : `/${story.heroImage}`;
  const layout = storyLayoutMap[story.id] || 'hero';
  return getDesktopOptimizedImage(originalPath, layout);
};

// Stitch 12-col masonry pattern — repeats every 4 cards
// Row 1: large (8) + small (4) at 500px
// Row 2: small (4) + large (8) at 400px
const CARD_PATTERN = [
  'lg:col-span-8 lg:h-[500px] aspect-[4/5] lg:aspect-auto',
  'lg:col-span-4 lg:h-[500px] aspect-video lg:aspect-auto',
  'lg:col-span-4 lg:h-[400px] aspect-video lg:aspect-auto',
  'lg:col-span-8 lg:h-[400px] aspect-video lg:aspect-auto',
] as const;



interface ArchiveSectionProps {
  onStorySelect: (story: Story) => void;
}

const ArchiveSectionComponent: React.FC<ArchiveSectionProps> = ({ onStorySelect }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category') || 'All';
  const [visibleCount, setVisibleCount] = useState(6);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    ['All', 'Rivalry', 'Tragedy', 'Myth'].includes(categoryFromUrl) ? categoryFromUrl : 'All'
  );

  // Sync selectedCategory from URL when category param changes (e.g. from navbar)
  useEffect(() => {
    if (['All', 'Rivalry', 'Tragedy', 'Myth'].includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
      setVisibleCount(6);
    }
  }, [categoryFromUrl]);

  // Filter categories: All, Rivalry, Tragedy, Myth
  const allCategories = ['All', 'Rivalry', 'Tragedy', 'Myth'];

  // Filter stories based on selected category
  const filteredStories = selectedCategory === 'All'
    ? storyMetadata
    : storyMetadata.filter(story => story.category === selectedCategory);
  
  // Virtual loading: Load more stories on scroll with smooth debouncing
  useEffect(() => {
    let ticking = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    
    const handleScroll = () => {
      if (!ticking && !isLoadingMore) {
        rafId = window.requestAnimationFrame(() => {
          const scrollPosition = window.innerHeight + window.scrollY;
          const documentHeight = document.documentElement.scrollHeight;
          const threshold = 800; // Load 800px before bottom for smoother experience
          
          if (scrollPosition >= documentHeight - threshold && visibleCount < filteredStories.length) {
            setIsLoadingMore(true);
            // Smooth loading without delay
            timeoutId = setTimeout(() => {
              setVisibleCount(prev => Math.min(prev + 6, filteredStories.length));
              setIsLoadingMore(false);
              timeoutId = null;
            }, 50);
          }
          ticking = false;
          rafId = null;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [visibleCount, isLoadingMore, filteredStories.length]);
  
  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(6);
  }, [selectedCategory]);
  
  const visibleStories = filteredStories.slice(0, visibleCount);
  
  return (
    <section data-archive-section className="relative z-20 px-4 md:px-8 lg:px-12 py-24 max-w-[1920px] mx-auto bg-f1-black" style={{ scrollBehavior: 'smooth' }}>
      {/* SECTION HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-end mb-20 gap-8">
        <div className="space-y-4">
          <h2 className="font-section-divider text-[48px] text-white">
            The Archive
          </h2>
          <div className="h-[2px] w-24 bg-[#ff1801] mt-2" />
          <p className="font-section-divider text-[14px] text-f1-red uppercase tracking-[0.2em] flex items-center gap-3">
            <span className="w-2 h-2 bg-f1-red rounded-full shadow-[0_0_8px_rgba(255,24,1,0.55)]" />
            Sector 2 /// Classified Historical Records
          </p>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 md:gap-3">
          {allCategories.map((category) => (
            <Button 
              key={category} 
              variant="glow"
              aria-label={`Filter stories by ${category} category`}
              aria-pressed={selectedCategory === category}
              onClick={() => {
                setSelectedCategory(category);
                setSearchParams(category === 'All' ? {} : { category });
              }}
              className={selectedCategory === category 
                ? 'bg-white text-black border-white' 
                : ''
              }
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* INTELLIGENT MASONRY GRID */}
      {/* 
         Smart layout based on image ratios:
         - Full/landscape (16:9): Wider cards
         - Portrait (9:16): Taller, narrower cards
         - Hero: Standard cards
         Virtual loading: Only render visible stories for performance
      */}
      <div 
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8"
        style={{ 
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {visibleStories.length > 0 ? visibleStories.map((storyMeta, index) => {
          const story: Story = {
            ...storyMeta,
            content: [],
          };

          return (
            <ArchiveCard
              key={story.id}
              story={story}
              index={index}
              spanClass={CARD_PATTERN[index % 4]}
              onClick={() => onStorySelect(story)}
            />
          );
        }) : null}
      </div>
      
      {/* Loading Indicator */}
      {visibleCount < filteredStories.length && (
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center gap-3 font-mono text-xs text-gray-400 uppercase tracking-widest">
            <span className="w-2 h-2 bg-f1-red rounded-full opacity-90" />
            Loading Archive...
          </div>
        </div>
      )}
      
      {/* No Results Message */}
      {filteredStories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="font-display text-4xl md:text-5xl text-white mb-4 tracking-wide">No stories found</p>
          <p className="font-mono text-sm text-gray-400 uppercase tracking-widest">
            Try selecting a different category
          </p>
        </div>
      )}
    </section>
  );
};

// --- ARCHIVE CARD COMPONENT ---
// Pure Tailwind CSS implementation. No external stylesheets.

const ArchiveCard: React.FC<{
  story: Story;
  index: number;
  spanClass: string;
  aspectRatio?: string;
  layout?: 'hero' | 'full' | 'portrait';
  onClick: () => void;
}> = React.memo(({ story, index, spanClass, aspectRatio = '16/9', layout = 'hero', onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(resolveHeroImage(story));
  const heroRaw = imageSrc;
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Preload image when card becomes visible
  useEffect(() => {
    if (cardRef.current && index > 0) {
      return preloadOnVisible(cardRef.current, heroRaw, {
        fetchPriority: index < 3 ? 'high' : 'low'
      });
    }
  }, [heroRaw, index]);
  
  // Prefetch story content and hero image on hover
  useEffect(() => {
    let prefetchLinks: HTMLLinkElement[] = [];
    
    const handleMouseEnter = () => {
      // Prefetch storyContent chunk for this specific story
      import('../data/storyContent').then((module) => {
        // Access the story content map to ensure it's loaded
        // This prefetches the chunk and makes the content available
        const content = module.storyContentMap[story.id];
        if (content) {
          // Content is now in memory, ready for when modal opens
          // Also prefetch any images referenced in the content
          // Use optimized image paths for better performance
          content.forEach((item) => {
            if (item.type === 'image' && item.src) {
              const originalPath = item.src.startsWith('/') ? item.src : `/${item.src}`;
              const optimizedPath = getDesktopOptimizedImage(originalPath, item.layout || 'landscape');
              const contentImg = new Image();
              contentImg.src = optimizedPath;
            }
          });
        }
      }).catch(() => {});
      
      // Prefetch hero image using link rel="prefetch" for better browser optimization
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = heroRaw;
      document.head.appendChild(link);
      prefetchLinks.push(link);
      
      // Also prefetch mobile version
      const storyLayout = storyLayoutMap[story.id] || 'hero';
      const mobileLink = document.createElement('link');
      mobileLink.rel = 'prefetch';
      mobileLink.as = 'image';
      mobileLink.href = mobileWebpOf(story.heroImage, storyLayout);
      document.head.appendChild(mobileLink);
      prefetchLinks.push(mobileLink);
    };
    
    if (cardRef.current) {
      cardRef.current.addEventListener('mouseenter', handleMouseEnter);
    }
    
    return () => {
      // Cleanup prefetch links
      prefetchLinks.forEach(link => {
        if (link.parentNode === document.head) {
          document.head.removeChild(link);
        }
      });
      prefetchLinks = [];
      
      if (cardRef.current) {
        cardRef.current.removeEventListener('mouseenter', handleMouseEnter);
      }
    };
  }, [heroRaw, story.id, story.heroImage]);
  
  return (
    <motion.div
      layoutId={`card-container-${story.id}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View story: ${story.title} from ${story.year}`}
      data-testid="archive-card"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.05 }}
      className={`${archiveCardContainer} ${spanClass} will-change-transform focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black`}
      ref={cardRef}
    >
      {/* 1. IMAGE LAYER */}
      <div className="absolute inset-0 overflow-hidden">
        {!loaded && !error && (
          <ImageShimmer aspectRatio={aspectRatio} className="absolute inset-0" />
        )}
        {!error && (
          <picture className="block w-full h-full" style={{ aspectRatio }}>
            {/* Mobile optimized PNG */}
            <source 
              media="(max-width: 640px)" 
              srcSet={mobileWebpOf(story.heroImage, storyLayoutMap[story.id] || 'hero')} 
              type="image/png"
            />
            {/* Desktop optimized PNG */}
            <motion.img
              layoutId={`hero-image-${story.id}`}
              src={heroRaw}
              alt={`${story.title} — ${story.year}`}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              referrerPolicy="no-referrer"
              decoding={index === 0 ? "sync" : "async"}
              width={1600}
              height={900}
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              style={{ aspectRatio: '16/9' }}
              onLoad={() => {
                setLoaded(true);
                setError(false);
              }}
              onError={(e) => {
                // If image fails to load, mark as error
                console.warn(`Failed to load image: ${heroRaw}`);
                setError(true);
                setLoaded(false);
              }}
              className={`${loaded ? archiveCardImage : "opacity-0"} transition-opacity duration-300`}
            />
          </picture>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-f1-black/50">
            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              Image unavailable
            </p>
          </div>
        )}

        {/* Cinematic Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-f1-black/20 to-f1-black opacity-90" />

        {/* Technical Grid Overlay (Scanlines) */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,#000_3px)] bg-[length:100%_4px] opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity duration-500 mix-blend-overlay" />
      </div>

      {/* 2. CONTENT LAYER */}
      <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-20">
        {/* Top Meta (Reveals on Hover) */}
        <div className="flex justify-between items-start opacity-0 group-hover:opacity-100 transform -translate-y-2 group-hover:translate-y-0 transition-all duration-500 ease-out delay-100">
          <div className="flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-sm border border-white/10">
            <span className={archiveBadgeDot} />
            <span className="font-mono text-[9px] uppercase tracking-widest text-white">
              Rec_0{index + 1}
            </span>
          </div>
          <span className="font-mono text-[9px] text-gray-300 border border-white/10 px-2 py-1 bg-black/60 backdrop-blur-sm">
            {story.id.toUpperCase().slice(0, 8)}...
          </span>
        </div>

        {/* Bottom Text */}
        <div className="transform group-hover:-translate-y-2 transition-transform duration-500 ease-out">
          <motion.div
            layoutId={`subtitle-${story.id}`}
            className="flex items-center gap-3 mb-3 will-change-transform"
          >
            <span className={anthologyYearBadge}>{story.year}</span>
            <span className="h-[1px] flex-grow bg-white/10 group-hover:bg-white/30 transition-colors duration-500" />
            <span className="font-section-divider text-[14px] text-gray-300 uppercase tracking-[0.2em]">
              {story.category}
            </span>
          </motion.div>

          <motion.h3
            layoutId={`title-${story.id}`}
            className="font-display text-4xl md:text-5xl lg:text-6xl text-white leading-[0.9] mb-3 group-hover:text-white mix-blend-screen transition-all duration-500 will-change-transform tracking-wide"
          >
            {story.title}
          </motion.h3>

          <p className="font-sans text-xs md:text-sm text-gray-300 max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-75 leading-[1.6] border-l border-[#ff1801] pl-3">
            {story.subtitle}
          </p>
        </div>
      </div>

      {/* 3. DECORATIVE UI ELEMENTS */}
      {/* Bottom Red Line */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-f1-red transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-in-out origin-left" />

      {/* Corner Accent */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
});

const ArchiveSection = React.memo(ArchiveSectionComponent);
export default ArchiveSection;
