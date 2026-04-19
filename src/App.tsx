import * as React from "react";
import { useState, useEffect, Component } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Home as HomeIcon, 
  BookOpen, 
  Layers, 
  Bookmark, 
  Settings as SettingsIcon,
  Moon,
  Sun,
  RotateCcw
} from "lucide-react";
import { AppState, LanguageMode, Translation, TRANSLATION_PAIRS } from "./types";
import { MOCK_VERSES, getVerseByDate } from "./constants";
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
  selectedVerseId: null,
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
  reminders: {
    enabled: false,
    type: "notification",
    time: "09:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
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
          reminders: { ...INITIAL_STATE.reminders, ...(parsed.reminders || {}) },
          selectedTranslations: { ...INITIAL_STATE.selectedTranslations, ...(parsed.selectedTranslations || {}) }
        };

        // Migration for reminders timezone
        if (!merged.reminders.timezone) {
          merged.reminders.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        }

        // Initialize new fields
        if (!merged.recentVerseIds) merged.recentVerseIds = [];
        if (merged.hasCompletedTour === undefined) merged.hasCompletedTour = false;
        
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

  useEffect(() => {
    if (state.onboarded && !state.hasCompletedTour) {
      // Small delay to ensure the main app layout is fully rendered before the tour starts
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.onboarded, state.hasCompletedTour]);

  useEffect(() => {
    try {
      localStorage.setItem("verso_state", JSON.stringify(state));
    } catch (e) {
      console.error("[App] Failed to save state to localStorage (likely quota exceeded):", e);
    }
  }, [state]);

  // Daily Reset Logic - Using Local Midnight
  useEffect(() => {
    const checkMidnight = () => {
      const today = getLocalDateString();
      if (state.lastVotdDate !== today) {
        setState(prev => {
          // Check if streak should reset
          // If today is not yesterday + 1, reset streak
          // Yesterday calculation
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
          
          let newStreak = prev.progress.currentStreak;
          // If the last completion was NOT yesterday and NOT today, reset streak
          if (prev.progress.lastPracticeDate !== yesterdayStr && prev.progress.lastPracticeDate !== today) {
            newStreak = 0;
          }

          return {
            ...prev,
            lastVotdDate: today,
            selectedVerseId: null, // Reset to VOTD
            progress: {
              ...prev.progress,
              currentStreak: newStreak
            }
          };
        });
      }
    };

    // Check on mount and every minute
    checkMidnight();
    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, [state.lastVotdDate, state.progress.lastPracticeDate]);

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

  const startMemorizing = (verseId: string) => {
    setState(s => ({ 
      ...s, 
      selectedVerseId: verseId,
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

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <Home state={state} setState={setState} onStartMemorizing={startMemorizing} onGetAnotherVerse={getAnotherVerse} />;
      case "memorize": return (
        <Memorize 
          state={state} 
          setState={setState} 
          onComplete={() => setActiveTab("saved")} 
          onGoToFlashcards={(verseId) => {
            setState(s => ({ ...s, selectedVerseId: verseId }));
            setActiveTab("flashcards");
          }}
        />
      );
      case "flashcards": return (
        <Flashcards 
          state={state} 
          setState={setState} 
          onMemorize={startMemorizing} 
          onGoToSaved={() => setActiveTab("saved")}
        />
      );
      case "saved": return <Saved state={state} setState={setState} onStartMemorizing={startMemorizing} />;
      default: return <Home state={state} setState={setState} onStartMemorizing={startMemorizing} onGetAnotherVerse={getAnotherVerse} />;
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
        className="flex flex-col min-h-screen relative overflow-x-hidden bg-parchment dark:bg-espresso transition-colors duration-500"
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-parchment/90 dark:bg-espresso/90 backdrop-blur-xl border-b border-earth/10 dark:border-white/10 transition-colors duration-500">
          <div className="content-column py-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-playful-purple rounded-2xl flex items-center justify-center shadow-lg shadow-playful-purple/20">
                <BookOpen size={20} className="text-white" />
              </div>
              <h1 className="text-2xl font-serif font-black text-playful-purple tracking-tight">Verso</h1>
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

        {/* Content */}
        <main className="flex-1 py-8 sm:py-12 pb-48">
          <div className="content-column h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.98 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full"
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Navigation - Responsive Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none">
          <nav className="max-w-xl mx-auto bg-white/95 dark:bg-charcoal/95 backdrop-blur-2xl border border-earth/10 dark:border-white/10 px-4 sm:px-8 py-3 flex justify-around items-center rounded-[32px] shadow-2xl pointer-events-auto transition-colors duration-500">
            <NavButton id="nav-home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon size={22} />} label={state.primaryLanguage === 'es' ? 'Inicio' : 'Home'} />
            <NavButton id="nav-memorize" active={activeTab === 'memorize'} onClick={() => setActiveTab('memorize')} icon={<BookOpen size={22} />} label={state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'} />
            <NavButton id="nav-flashcards" active={activeTab === 'flashcards'} onClick={() => setActiveTab('flashcards')} icon={<Layers size={22} />} label={state.primaryLanguage === 'es' ? 'Tarjetas' : 'Cards'} />
            <NavButton id="nav-saved" active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} icon={<Bookmark size={22} />} label={state.primaryLanguage === 'es' ? 'Guardados' : 'Saved'} />
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
        <ProductTour 
          isOpen={showTour} 
          onClose={() => {
            setShowTour(false);
            setState(s => ({ ...s, hasCompletedTour: true }));
          }} 
          primaryLanguage={state.primaryLanguage}
          onTabChange={setActiveTab}
        />
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

function NavButton({ id, active, onClick, icon, label }: { id: string, active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-playful-purple' : 'text-earth/40 dark:text-parchment/40'}`}
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
      <span className={`text-[10px] font-black uppercase tracking-wider transition-all ${active ? 'opacity-100 scale-110' : 'opacity-60 scale-100'}`}>{label}</span>
    </button>
  );
}
