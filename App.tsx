import React, { useEffect, useState, Suspense, useCallback, lazy } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Routes, Route, useLocation, useMatch, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ShortcutsModal from './components/ui/ShortcutsModal';
import OfflineIndicator from './components/OfflineIndicator';
import NavBar from './components/ui/NavBar';
import { Story, LocationState } from './types';
import { storyMetadata } from './data/storyMetadata';
import { createKeyboardShortcuts } from './utils/keyboardShortcuts';
import { preloadStoryHeroes } from './utils/imagePreloader';
import { getDesktopOptimizedImage } from './utils/optimizedImages';
import { useMetadata } from './hooks/useMetadata';
import { warmNewsOnLoad } from './utils/newsService';
import metadata from './metadata.json';

const HeroSection = lazy(() => import('./components/HeroSection'));
const ArchiveSection = lazy(() => import('./components/ArchiveSection'));
const StoryModal = lazy(() => import('./components/StoryModal'));
const Timeline = lazy(() => import('./components/Timeline'));
const News = lazy(() => import('./components/News'));

const routePageSuspenseFallback = (
  <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-f1-black px-6 pt-28 pb-20">
    <p className="font-mono text-sm text-gray-500">Loading…</p>
  </div>
);

const Shell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const match = useMatch('/story/:id');
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const handleSelect = useCallback((story: Story) => {
    navigate(`/story/${story.id}`, { state: { backgroundLocation: location } });
  }, [navigate, location]);

  const handleClose = useCallback(() => {
    const state = location.state as LocationState | null;
    if (state?.backgroundLocation) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate, location]);

  useEffect(() => {
    const cleanup = createKeyboardShortcuts({
      onEscape: () => {
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        } else if (activeStory) {
          handleClose();
        }
      },
      onArrowLeft: () => {
        if (!activeStory) return;
        const currentStoryIndex = storyMetadata.findIndex(s => s.id === activeStory.id);
        if (currentStoryIndex > 0) {
          const prevStory = storyMetadata[currentStoryIndex - 1];
          handleSelect({ ...prevStory, content: [] });
        }
      },
      onArrowRight: () => {
        if (!activeStory) return;
        const currentStoryIndex = storyMetadata.findIndex(s => s.id === activeStory.id);
        if (currentStoryIndex < storyMetadata.length - 1) {
          const nextStory = storyMetadata[currentStoryIndex + 1];
          handleSelect({ ...nextStory, content: [] });
        }
      },
      onSpace: () => {
        if (!activeStory && !isShortcutsOpen) {
          window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'auto' });
        }
      },
      onQuestionMark: () => {
        setIsShortcutsOpen(prev => !prev);
      },
      onHome: () => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      },
      onEnd: () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
      },
    });

    return cleanup;
  }, [activeStory, isShortcutsOpen, handleSelect, handleClose]);

  useEffect(() => {
    const id = match?.params?.id;
    if (id) {
      import('./data/storyContent').then(({ storyContentMap }) => {
        const storyMeta = storyMetadata.find((s) => s.id === id);
        if (storyMeta) {
          const content = storyContentMap[id] || [];
          setActiveStory({ ...storyMeta, content });
        } else {
          setActiveStory(null);
        }
      }).catch(() => {
        setActiveStory(null);
      });
    } else {
      setActiveStory(null);
    }
  }, [match?.params?.id]);

  useEffect(() => {
    const firstSix = storyMetadata.slice(0, 6).map((s) => {
      const originalPath = s.heroImage.startsWith('/') ? s.heroImage : `/${s.heroImage}`;
      return getDesktopOptimizedImage(originalPath, 'hero');
    });

    const newStoryIds = ['schumacher-1994-spain', 'collins-fangio-1956', 'monaco-1982', 'jerez-1997', 'senna-donington-1993'];
    const newStoryHeroes = storyMetadata
      .filter(s => newStoryIds.includes(s.id))
      .map((s) => {
        const originalPath = s.heroImage.startsWith('/') ? s.heroImage : `/${s.heroImage}`;
        return getDesktopOptimizedImage(originalPath, 'hero');
      });

    preloadStoryHeroes([...firstSix, ...newStoryHeroes]);
  }, []);

  const isStoryView = !!activeStory;
  const pageTitle = isStoryView
    ? `${activeStory.title} — ${metadata.name}`
    : `${metadata.name} — ${metadata.description}`;
  const pageDescription = isStoryView
    ? activeStory.subtitle
    : metadata.description;

  useMetadata({
    title: pageTitle,
    description: pageDescription,
    image: isStoryView && activeStory ? activeStory.heroImage : undefined,
    type: isStoryView ? 'article' : 'website',
  });

  return (
    <div className="relative min-h-screen bg-f1-black text-paper selection:bg-f1-red selection:text-white overflow-x-hidden">
      <OfflineIndicator />

      <NavBar variant="overlay" showCategories />

      <main className="relative z-10">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex min-h-[50vh] items-center justify-center px-6 py-24">
                <p className="font-mono text-sm text-gray-500">Loading…</p>
              </div>
            }
          >
            <HeroSection />
            <ArchiveSection onStorySelect={handleSelect} />
          </Suspense>
        </ErrorBoundary>
      </main>

      <AnimatePresence>
        {activeStory && (
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-f1-black/90 px-6">
                  <p className="font-mono text-sm text-gray-500">Loading…</p>
                </div>
              }
            >
              <StoryModal
                story={activeStory}
                onClose={handleClose}
                onOpenMenu={() => { navigate('/'); }}
                onStorySelect={handleSelect}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </AnimatePresence>

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <footer className="relative z-10 py-24 px-8 border-t border-white/10 mt-24">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <h2 className="font-display text-4xl mb-4 tracking-wide">The Pursuit of Speed</h2>
            <p className="font-mono text-sm text-gray-400 max-w-md">
              An archival project dedicated to the narrative history of Formula 1.
              Not just the numbers, but the blood, sweat, and oil.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const RoutedPageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-f1-black text-paper selection:bg-f1-red selection:text-white overflow-x-hidden">
      <NavBar />
      {children}
    </div>
  );
};

const TimelineShell: React.FC = () => {
  const navigate = useNavigate();
  const handleSelect = useCallback((story: Story) => {
    navigate(`/story/${story.id}`);
  }, [navigate]);

  useMetadata({
    title: `Timeline — ${metadata.name}`,
    description: 'Chronological timeline of Formula 1 stories',
    type: 'website',
  });

  return (
    <RoutedPageShell>
      <Suspense fallback={routePageSuspenseFallback}>
        <ErrorBoundary>
          <Timeline onStorySelect={handleSelect} onClose={() => navigate('/')} />
        </ErrorBoundary>
      </Suspense>
    </RoutedPageShell>
  );
};

const NewsShell: React.FC = () => {
  const navigate = useNavigate();

  useMetadata({
    title: `News — ${metadata.name}`,
    description: 'Latest Formula 1 news and headlines',
    type: 'website',
  });

  return (
    <RoutedPageShell>
      <Suspense fallback={routePageSuspenseFallback}>
        <ErrorBoundary>
          <News onClose={() => navigate('/')} />
        </ErrorBoundary>
      </Suspense>
    </RoutedPageShell>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Kick off a fresh /api/news fetch in the background on first load
    // regardless of which route the user lands on. Non-blocking, error-swallowing.
    warmNewsOnLoad();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Shell />} />
      <Route path="/story/:id" element={<Shell />} />
      <Route path="/timeline" element={<TimelineShell />} />
      <Route path="/news" element={<NewsShell />} />
    </Routes>
  );
};

export default App;
