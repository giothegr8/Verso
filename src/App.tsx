import * as React from "react";
import { useState, useEffect, Component } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Home as HomeIcon, 
  BookOpen, 
  Layers, 
  Sprout, 
  Compass,
  Settings as SettingsIcon,
  Moon,
  Sun,
  RotateCcw
} from "lucide-react";
import { AppState, LanguageMode, Translation, TRANSLATION_PAIRS } from "./types";
import { MOCK_VERSES, getVerseByDate, PATHS } from "./constants";
import { getLocalDateString } from "./utils/verseUtils";

// Components
import Home from "./components/Home";
import Memorize from "./components/Memorize";
import Flashcards from "./components/Flashcards";
import Saved from "./components/Saved";
import Onboarding from "./components/Onboarding";
import Settings from "./components/Settings";
import Paywall from "./components/Paywall";
import ProductTour from "./components/ProductTour";
import PathSelection from "./components/PathSelection";
import VersoLogo from "./components/VersoLogo";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Verso App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const INITIAL_STATE: AppState = {
  primaryLanguage: "es",
  memorizeMode: "es",
  selectedTranslations: { es: "RVR1960", en: "KJV" },
  theme: "system",
  onboarded: false,
  hasCompletedTour: false,
  savedVerses: [],
  customVerses: [],
  selectedVerseId: null,
  selectedCustomVerse: null,
  activeSource: "daily",
  recentVerseIds: [],
  lastVotdDate: getLocalDateString(),
  progress: {
    totalMemorized: 0,
    currentStreak: 0,
    bestStreak: 0,
    completedVerses: [],
    verseStages: {},
    lastPracticeDate: null,
    lastStreakDate: null,
    lastCompletedDailyVerseDate: null,
  },
  pathProgress: {
    selectedPathId: null,
    currentDay: 1,
    lastCompletedAt: null,
    pathCompletedToday: false,
    completedPathIds: [],
    savedProgress: {},
  },
  reminders: {
    enabled: false,
    type: "notification",
    time: "09:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  onboardingProfile: {},
  trialStartDate: null,
  isSubscribed: false,
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem("verso_state");
    console.log("[App] State Init: localStorage found:", !!saved);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') throw new Error("Invalid state format");
        
        console.log("[App] State parsed. Onboarded status:", parsed.onboarded, "Language:", parsed.primaryLanguage);
        
        // Ensure all fields from INITIAL_STATE exist with a robust deep-ish merge
        const merged: AppState = { 
          ...INITIAL_STATE, 
          ...parsed,
          progress: { ...INITIAL_STATE.progress, ...(parsed.progress || {}) },
          pathProgress: { 
            ...INITIAL_STATE.pathProgress, 
            ...(parsed.pathProgress || {}),
            savedProgress: { 
              ...(INITIAL_STATE.pathProgress.savedProgress || {}), 
              ...(parsed.pathProgress?.savedProgress || {}) 
            }
          },
          reminders: { ...INITIAL_STATE.reminders, ...(parsed.reminders || {}) },
          selectedTranslations: { ...INITIAL_STATE.selectedTranslations, ...(parsed.selectedTranslations || {}) }
        };

        // Migration for reminders timezone
        if (!merged.reminders.timezone) {
          merged.reminders.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        }

        // Initialize new fields
        if (!merged.recentVerseIds) merged.recentVerseIds = [];
        if (!merged.customVerses) merged.customVerses = [];
        if (merged.activeSource === undefined) merged.activeSource = "daily";
        if (merged.selectedCustomVerse === undefined) merged.selectedCustomVerse = null;
        if (!merged.onboardingProfile) merged.onboardingProfile = {};
        if (merged.hasCompletedTour === undefined) merged.hasCompletedTour = false;
        if (!merged.pathProgress) {
          merged.pathProgress = INITIAL_STATE.pathProgress;
        }
        
        return merged;
      } catch (e) {
        console.error("[App] Failed to parse saved state, resetting to INITIAL_STATE:", e);
        localStorage.removeItem("verso_state");
        return INITIAL_STATE;
      }
    }
    console.log("[App] Initializing with fresh state (onboarded: false)");
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState("home");
  const [showSettings, setShowSettings] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [currentTourStepId, setCurrentTourStepId] = useState<string | null>(null);

  useEffect(() => {
    // Auto-launch product tour disabled as per requested refinements
    // Access moved to Settings only
    /*
    if (state.onboarded && !state.hasCompletedTour) {
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    */
  }, [state.onboarded, state.hasCompletedTour]);

  useEffect(() => {
    try {
      localStorage.setItem("verso_state", JSON.stringify(state));
    } catch (e) {
      console.error("[App] Failed to save state to localStorage (likely quota exceeded):", e);
    }
  }, [state]);

  // Streak & Votd Daily Update Logic
  useEffect(() => {
    if (!state.onboarded) return;

    const checkDailyUpdate = () => {
      const today = getLocalDateString();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

      setState(prev => {
        // Only trigger update if the date has shifted
        if (prev.progress.lastPracticeDate === today && prev.lastVotdDate === today) {
          return prev;
        }

        let newStreak = prev.progress.currentStreak;
        let newBestStreak = prev.progress.bestStreak;
        let newProgress = { ...prev.progress };
        let updateNeeded = false;

        // If today is a new day relative to lastPracticeDate
        if (prev.progress.lastPracticeDate !== today) {
          updateNeeded = true;
          if (prev.progress.lastPracticeDate === yesterdayStr) {
            // Consecutive day visit
            newStreak += 1;
          } else {
            // Missed a day or first visit
            newStreak = 1;
          }

          if (newStreak > newBestStreak) {
            newBestStreak = newStreak;
          }

          newProgress = {
            ...newProgress,
            currentStreak: newStreak,
            bestStreak: newBestStreak,
            lastPracticeDate: today
          };
        }

        // If today is a new day relative to VOTD
        if (prev.lastVotdDate !== today) {
          updateNeeded = true;
          return {
            ...prev,
            lastVotdDate: today,
            selectedVerseId: null, // Reset to VOTD on new day
            progress: newProgress,
            pathProgress: {
              ...prev.pathProgress,
              pathCompletedToday: false
            }
          };
        }

        if (updateNeeded) {
          return {
            ...prev,
            progress: newProgress
          };
        }

        return prev;
      });
    };

    checkDailyUpdate();
    const interval = setInterval(checkDailyUpdate, 60000);
    return () => clearInterval(interval);
  }, [state.onboarded]);

  useEffect(() => {
    const isDark = 
      state.theme === "dark" || 
      (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    console.log("[App] Applying theme:", state.theme, "isDark:", isDark);
    
    // Apply to both html and body for maximum compatibility
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }, [state.theme]);

  // Reset memorization stages when configuration changes to ensure a fresh start
  const isTrialExpired = () => {
    if (state.isSubscribed) return false;
    
    // Trial is currently disabled for prototype stability unless explicitly desired
    // To enable, uncomment the logic below
    /*
    if (!state.trialStartDate) return false;
    const startDate = new Date(state.trialStartDate);
    if (isNaN(startDate.getTime())) return false;
    
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
    */
    return false; // For now, never expire during this test phase
  };

  useEffect(() => {
    setState(s => ({
      ...s,
      progress: {
        ...s.progress,
        verseStages: {}
      }
    }));
  }, [state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode]);

  const startMemorizing = (verseId: string, source: "daily" | "path" | "custom" | "extra" | "saved" = "daily") => {
    setState(s => ({ 
      ...s, 
      selectedVerseId: verseId,
      activeSource: source,
      progress: {
        ...s.progress,
        verseStages: {
          ...s.progress.verseStages,
          [verseId]: 1
        }
      }
    }));
    setActiveTab("memorize");
  };

  const getAnotherVerse = () => {
    const today = getLocalDateString();
    const votd = getVerseByDate(today);
    // Exclude current VOTD, current active verse, and recent history
    const currentActiveId = state.selectedVerseId || votd.id;
    const excludedIds = new Set([
      votd.id,
      currentActiveId,
      ...state.recentVerseIds
    ]);

    let eligiblePool = MOCK_VERSES.filter((v: any) => !excludedIds.has(v.id));

    // If pool is exhausted, recycle but still exclude current active
    if (eligiblePool.length === 0) {
      eligiblePool = MOCK_VERSES.filter((v: any) => v.id !== currentActiveId);
    }

    const randomVerse = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
    
    if (randomVerse) {
      // Update history (keep last 14)
      const newRecent = [randomVerse.id, ...state.recentVerseIds].slice(0, 14);
      
      setState(prev => ({
        ...prev,
        selectedVerseId: randomVerse.id,
        recentVerseIds: newRecent,
        // Reset memorization flow for the new verse
        progress: {
          ...prev.progress,
          verseStages: {
            ...prev.progress.verseStages,
            [randomVerse.id]: 1
          }
        }
      }));
    }
  };

  const handleSelectPath = (pathId: string) => {
    setState(s => {
      const saved = (s.pathProgress?.savedProgress || {})[pathId] || { currentDay: 1, completedDays: [] };
      // Also check if the path has been previously completed entirely
      const isPathFullyCompleted = (s.pathProgress?.completedPathIds || []).includes(pathId);
      
      return {
        ...s,
        pathProgress: {
          ...s.pathProgress,
          selectedPathId: pathId,
          currentDay: saved.currentDay,
          pathCompletedToday: s.pathProgress.lastCompletedAt === getLocalDateString() && (saved.completedDays.includes(saved.currentDay) || isPathFullyCompleted)
        }
      };
    });
    setActiveTab("home");
  };

  const handleCompletePathDay = () => {
    const today = getLocalDateString();
    const currentPathId = state.pathProgress.selectedPathId;
    const currentPath = PATHS.find(p => p.id === currentPathId);
    if (!currentPath || !currentPathId) return;

    setState(s => {
      const dayNum = s.pathProgress.currentDay;
      const isLastDay = dayNum >= currentPath.duration;
      const nextDay = isLastDay ? dayNum : dayNum + 1;
      
      const currentSaved = (s.pathProgress?.savedProgress || {})[currentPathId] || { currentDay: 1, completedDays: [] };
      const newCompletedDays = Array.from(new Set([...currentSaved.completedDays, dayNum]));
      
      const newSavedProgress = {
        ...(s.pathProgress?.savedProgress || {}),
        [currentPathId]: {
          currentDay: nextDay,
          completedDays: newCompletedDays
        }
      };

      return {
        ...s,
        pathProgress: {
          ...s.pathProgress,
          currentDay: nextDay,
          lastCompletedAt: today,
          pathCompletedToday: true,
          completedPathIds: isLastDay && !(s.pathProgress?.completedPathIds || []).includes(currentPathId)
            ? [...(s.pathProgress?.completedPathIds || []), currentPathId]
            : (s.pathProgress?.completedPathIds || []),
          savedProgress: newSavedProgress
        }
      };
    });
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home": return (
        <Home 
          state={state} 
          setState={setState} 
          onStartMemorizing={(id) => startMemorizing(id, state.activeSource)} 
          onGetAnotherVerse={getAnotherVerse} 
          onGoToSaved={() => setActiveTab('saved')} 
          onGoToPaths={() => setActiveTab('paths')}
          onCompletePathDay={handleCompletePathDay}
        />
      );
      case "paths": return (
        <PathSelection 
          state={state} 
          onSelectPath={handleSelectPath} 
          onBack={() => setActiveTab("home")} 
        />
      );
      case "memorize": return (
        <Memorize 
          state={state} 
          setState={setState} 
          onComplete={() => setActiveTab("saved")} 
          onGoToFlashcards={(verseId) => {
            setState(s => ({ ...s, selectedVerseId: verseId }));
            setActiveTab("flashcards");
          }}
          tourStepId={currentTourStepId}
        />
      );
      case "flashcards": return (
        <Flashcards 
          state={state} 
          setState={setState} 
          onMemorize={(id) => startMemorizing(id, state.activeSource)} 
          onGoToSaved={() => setActiveTab("saved")}
        />
      );
      case "saved": return <Saved state={state} setState={setState} onStartMemorizing={(id, src) => startMemorizing(id, src || "saved")} />;
      default: return (
        <Home 
          state={state} 
          setState={setState} 
          onStartMemorizing={startMemorizing} 
          onGetAnotherVerse={getAnotherVerse} 
          onGoToSaved={() => setActiveTab('saved')} 
          onGoToPaths={() => setActiveTab('paths')}
          onCompletePathDay={handleCompletePathDay}
        />
      );
    }
  };

  const renderContent = () => {
    const onboardingNeeded = !state.onboarded;
    const trialExpired = isTrialExpired();
    
    console.log("[App] renderContent decision:", { onboardingNeeded, trialExpired, lang: state.primaryLanguage });

    if (onboardingNeeded) {
      console.log("[App] Rendering Onboarding flow.");
      return (
        <Onboarding 
          onComplete={(prefs) => {
            console.log("[App] Onboarding process finished. Merging preferences:", prefs);
            setState(prev => {
              const newState = { 
                ...prev, 
                ...prefs, 
                onboarded: true,
                hasCompletedTour: false,
                trialStartDate: new Date().toISOString()
              };
              console.log("[App] New state generated after onboarding. Persisting...");
              return newState;
            });
          }} 
        />
      );
    }

    if (trialExpired) {
      console.log("[App] Trial limit reached. Showing Paywall overlay.");
      return (
        <Paywall 
          state={state} 
          onSubscribe={() => {
            console.log("[App] User clicked subscribe. Updating state...");
            setState(s => ({ ...s, isSubscribed: true }));
          }} 
        />
      );
    }

    console.log("[App] Rendering Main Layout. ActiveTab:", activeTab);
    return (
      <div 
        key={state.onboarded ? "main-app" : "booting"} // Force re-mount if state changes significantly
        className="flex flex-col min-h-screen-dynamic relative overflow-x-hidden bg-parchment dark:bg-espresso transition-colors duration-500"
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-parchment/90 dark:bg-espresso/90 backdrop-blur-xl border-b border-earth/10 dark:border-white/10 transition-colors duration-500">
          <div className="content-column py-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <VersoLogo size="md" showText={true} />
            </div>
            <div className="flex items-center gap-4">
              <button 
                id="nav-settings"
                onClick={() => setShowSettings(true)}
                className="btn-icon bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 shadow-sm transition-colors duration-500"
                aria-label="Settings"
              >
                <SettingsIcon size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area - Page Level Scroll */}
        <main 
          className="flex-1 flex flex-col pt-4 sm:pt-6"
          style={{ paddingBottom: "calc(var(--nav-height) + 2rem + var(--safe-area-bottom))" }}
        >
          <div className="content-column flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col"
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Navigation - Responsive Bottom Bar */}
        <div 
          className="fixed bottom-0 left-0 right-0 z-40 px-6 pointer-events-none"
          style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
        >
          <nav className="max-w-xl mx-auto bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 px-6 sm:px-10 py-3.5 flex justify-around items-center rounded-[32px] shadow-[0_15px_50px_rgba(0,0,0,0.15)] pointer-events-auto transition-colors duration-500 h-[var(--nav-height)]">
            <NavButton id="nav-home" active={activeTab === 'home'} activeColor="text-playful-purple" onClick={() => setActiveTab('home')} icon={<HomeIcon size={22} />} label={state.primaryLanguage === 'es' ? 'Inicio' : 'Home'} />
            <NavButton id="nav-memorize" active={activeTab === 'memorize'} activeColor="text-gold" onClick={() => setActiveTab('memorize')} icon={<BookOpen size={22} />} label={state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'} />
            <NavButton id="nav-flashcards" active={activeTab === 'flashcards'} activeColor="text-coral" onClick={() => setActiveTab('flashcards')} icon={<Layers size={22} />} label={state.primaryLanguage === 'es' ? 'Tarjetas' : 'Cards'} />
            <NavButton id="nav-paths" active={activeTab === 'paths'} activeColor="text-sky-blue" onClick={() => setActiveTab('paths')} icon={<Compass size={22} />} label={state.primaryLanguage === 'es' ? 'Caminos' : 'Paths'} />
            <NavButton id="nav-saved" active={activeTab === 'saved'} activeColor="text-teal" onClick={() => setActiveTab('saved')} icon={<Sprout size={22} />} label={state.primaryLanguage === 'es' ? 'Guardados' : 'Saved'} />
          </nav>
        </div>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <Settings 
              state={state} 
              setState={setState} 
              onClose={() => setShowSettings(false)} 
              onShowTour={() => {
                setShowSettings(false);
                setShowTour(true);
              }}
            />
          )}
        </AnimatePresence>

        {/* Product Tour */}
        {showTour && (
          <ProductTour 
            isOpen={showTour} 
            onClose={() => {
              setShowTour(false);
              setCurrentTourStepId(null);
              setState(s => ({ ...s, hasCompletedTour: true }));
            }} 
            primaryLanguage={state.primaryLanguage}
            onTabChange={setActiveTab}
            onStepChange={setCurrentTourStepId}
          />
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen bg-parchment dark:bg-espresso flex flex-col items-center justify-center text-center p-8 space-y-6">
        <div className="w-20 h-20 bg-lavender/10 rounded-3xl flex items-center justify-center">
          <RotateCcw size={40} className="text-lavender" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-black text-earth dark:text-ivory">
            {state.primaryLanguage === 'es' ? 'Algo salió mal' : 'Something went wrong'}
          </h2>
          <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto">
            {state.primaryLanguage === 'es' 
              ? 'Hubo un error inesperado. Por favor intenta reiniciar la aplicación.' 
              : 'An unexpected error occurred. Please try restarting the app.'}
          </p>
        </div>
        <button 
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="btn-primary px-8"
        >
          {state.primaryLanguage === 'es' ? 'Reiniciar App y Datos' : 'Reset App & Data'}
        </button>
      </div>
    }>
      {renderContent()}
    </ErrorBoundary>
  );
}

function NavButton({ id, active, activeColor, onClick, icon, label }: { id: string, active: boolean, activeColor: string, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? activeColor : 'text-earth/40 dark:text-parchment/40'}`}
    >
      <motion.div
        animate={{ 
          scale: active ? 1.1 : 1,
          y: active ? -3 : 0
        }}
        whileHover={{
          scale: active ? 1.15 : 1.05,
          y: active ? -4 : -2
        }}
        whileTap={{ 
          scale: 0.95,
          y: 0
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 15 
        }}
      >
        {icon}
      </motion.div>
      <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40 scale-100'}`}>{label}</span>
    </button>
  );
}
