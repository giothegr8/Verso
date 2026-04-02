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
import { VERSE_OF_THE_DAY, MOCK_VERSES } from "./constants";

// Components
import Home from "./components/Home";
import Memorize from "./components/Memorize";
import Flashcards from "./components/Flashcards";
import Saved from "./components/Saved";
import Onboarding from "./components/Onboarding";
import Settings from "./components/Settings";
import Paywall from "./components/Paywall";

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
  languageMode: "es",
  memorizeMode: "es",
  translationMode: "default",
  activePairIndex: 0,
  customPair: { es: "RVR1960", en: "KJV" },
  theme: "system",
  onboarded: false,
  savedVerses: [],
  selectedVerseId: null,
  recentVerseIds: [],
  lastVotdDate: null,
  progress: {
    totalMemorized: 0,
    currentStreak: 0,
    bestStreak: 0,
    completedVerses: [],
    verseStages: {},
    lastPracticeDate: null,
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Ensure all fields from INITIAL_STATE exist
        const merged = { ...INITIAL_STATE, ...parsed };

        // Migration for reminders
        if (!parsed.reminders || !parsed.reminders.timezone) {
          merged.reminders = { ...INITIAL_STATE.reminders, ...parsed.reminders };
        }

        // Migration for old state if needed
        if (parsed.translationEn || parsed.translationEs) {
          merged.activePairIndex = 0;
          merged.selectedVerseId = null;
        }

        // Validate activePairIndex
        if (merged.activePairIndex === undefined || merged.activePairIndex < 0 || merged.activePairIndex >= TRANSLATION_PAIRS.length) {
          merged.activePairIndex = 0;
        }

        // Validate progress structure
        if (!merged.progress || typeof merged.progress !== 'object') {
          merged.progress = INITIAL_STATE.progress;
        } else {
          merged.progress = { ...INITIAL_STATE.progress, ...merged.progress };
        }

        // Initialize new fields if they don't exist
        if (!merged.recentVerseIds) merged.recentVerseIds = [];
        if (merged.lastVotdDate === undefined) merged.lastVotdDate = null;

        return merged;
      } catch (e) {
        console.error("Failed to parse saved state:", e);
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState("home");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem("verso_state", JSON.stringify(state));
  }, [state]);

  // Daily Reset Logic
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (state.lastVotdDate !== today) {
      setState(prev => ({
        ...prev,
        lastVotdDate: today,
        selectedVerseId: null, // Reset to VOTD
      }));
    }
  }, [state.lastVotdDate]);

  useEffect(() => {
    const isDark = 
      state.theme === "dark" || 
      (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    // Apply to both html and body for maximum compatibility
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }, [state.theme]);

  if (!state.onboarded) {
    return (
      <Onboarding 
        onComplete={(prefs) => setState(prev => ({ 
          ...prev, 
          ...prefs, 
          onboarded: true,
          trialStartDate: new Date().toISOString()
        }))} 
      />
    );
  }

  // Trial Logic
  const isTrialExpired = () => {
    if (state.isSubscribed) return false;
    if (!state.trialStartDate) return false;
    
    const startDate = new Date(state.trialStartDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 7;
  };

  if (isTrialExpired()) {
    return (
      <Paywall 
        state={state} 
        onSubscribe={() => setState(s => ({ ...s, isSubscribed: true }))} 
      />
    );
  }

  const startMemorizing = (verseId: string) => {
    setState(s => ({ ...s, selectedVerseId: verseId }));
    setActiveTab("memorize");
  };

  const getAnotherVerse = () => {
    // Exclude current VOTD, current active verse, and recent history
    const currentActiveId = state.selectedVerseId || VERSE_OF_THE_DAY.id;
    const excludedIds = new Set([
      VERSE_OF_THE_DAY.id,
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
      case "memorize": return <Memorize state={state} setState={setState} onComplete={() => setActiveTab("saved")} />;
      case "flashcards": return <Flashcards state={state} onMemorize={startMemorizing} />;
      case "saved": return <Saved state={state} setState={setState} onStartMemorizing={startMemorizing} />;
      default: return <Home state={state} setState={setState} onStartMemorizing={startMemorizing} onGetAnotherVerse={getAnotherVerse} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-parchment dark:bg-espresso selection:bg-playful-purple/30 transition-colors duration-500">
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
          <ErrorBoundary fallback={
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
              <div className="w-20 h-20 bg-lavender/10 rounded-3xl flex items-center justify-center">
                <RotateCcw size={40} className="text-lavender" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                  {state.primaryLanguage === 'es' ? 'Algo salió mal' : 'Something went wrong'}
                </h2>
                <p className="text-earth-light dark:text-lavender-muted max-w-xs">
                  {state.primaryLanguage === 'es' 
                    ? 'Hubo un error inesperado. Por favor intenta reiniciar la aplicación.' 
                    : 'An unexpected error occurred. Please try restarting the app.'}
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="btn-primary px-8"
              >
                {state.primaryLanguage === 'es' ? 'Reiniciar App' : 'Restart App'}
              </button>
            </div>
          }>
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
          </ErrorBoundary>
        </div>
      </main>

      {/* Navigation - Responsive Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none">
        <nav className="max-w-xl mx-auto bg-white/95 dark:bg-charcoal/95 backdrop-blur-2xl border border-earth/10 dark:border-white/10 px-4 sm:px-8 py-3 flex justify-around items-center rounded-[32px] shadow-2xl pointer-events-auto transition-colors duration-500">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon size={22} />} label={state.primaryLanguage === 'es' ? 'Inicio' : 'Home'} />
          <NavButton active={activeTab === 'memorize'} onClick={() => setActiveTab('memorize')} icon={<BookOpen size={22} />} label={state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'} />
          <NavButton active={activeTab === 'flashcards'} onClick={() => setActiveTab('flashcards')} icon={<Layers size={22} />} label={state.primaryLanguage === 'es' ? 'Tarjetas' : 'Cards'} />
          <NavButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} icon={<Bookmark size={22} />} label={state.primaryLanguage === 'es' ? 'Guardados' : 'Saved'} />
        </nav>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <Settings 
            state={state} 
            setState={setState} 
            onClose={() => setShowSettings(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
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
