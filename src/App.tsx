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
  RotateCcw,
  Loader2,
  AlertCircle
} from "lucide-react";
import { AppState, LanguageMode, Translation, TRANSLATION_PAIRS, Verse } from "./types";
import { MOCK_VERSES, getVerseByDate, PATHS } from "./constants";
import { getLocalDateString, getLocalizedBookName } from "./utils/verseUtils";
import { rotateReminder } from "./utils/reminderRotation";
import { getVerseFromApiBible, BIBLE_VERSIONS } from "./services/apiBible";

// Contexts
import { AuthProvider, useAuth } from "./contexts/AuthContext";

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
import CustomPathCreate from "./components/CustomPathCreate";
import VersoLogo from "./components/VersoLogo";
import { CustomPath, Path } from "./types";

// Services
import { captureUtmParams } from "./services/marketingService";

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
  customPaths: [],
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
    completionCounts: {},
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
    previouslyCompletedPathIds: [],
    savedProgress: {},
  },
  customPathProgress: {
    selectedPathId: null,
    currentDay: 1,
    lastCompletedAt: null,
    pathCompletedToday: false,
    completedPathIds: [],
    previouslyCompletedPathIds: [],
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
  isLoadingAnotherVerse: false,
  anotherVerseError: null,
  loadingTranslations: {},
  activeAttempt: null,
};

function AppInner() {
  const { user, profile, isPremium: realPremium, loading: authLoading } = useAuth();
  const [mockPremium, setMockPremium] = useState(() => localStorage.getItem('verso_test_premium') === 'true');

  const isPremium = realPremium || mockPremium;

  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem("verso_state");
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') throw new Error("Invalid state format");
        
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
          customPathProgress: {
            ...INITIAL_STATE.customPathProgress,
            ...(parsed.customPathProgress || {}),
            savedProgress: {
              ...(INITIAL_STATE.customPathProgress.savedProgress || {}),
              ...(parsed.customPathProgress?.savedProgress || {})
            }
          },
          reminders: { ...INITIAL_STATE.reminders, ...(parsed.reminders || {}) },
          selectedTranslations: { ...INITIAL_STATE.selectedTranslations, ...(parsed.selectedTranslations || {}) }
        };

        if (!merged.reminders.timezone) {
          merged.reminders.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        }

        if (!merged.recentVerseIds) merged.recentVerseIds = [];
        if (!merged.customVerses) merged.customVerses = [];
        if (!merged.customPaths) merged.customPaths = [];
        merged.loadingTranslations = {};
        if (merged.activeSource === undefined) merged.activeSource = "daily";
        if (merged.selectedCustomVerse === undefined) merged.selectedCustomVerse = null;
        if (!merged.onboardingProfile) merged.onboardingProfile = {};
        if (merged.hasCompletedTour === undefined) merged.hasCompletedTour = false;
        if (!merged.progress.completionCounts) {
          merged.progress.completionCounts = {};
        }
        if (!merged.pathProgress) {
          merged.pathProgress = INITIAL_STATE.pathProgress;
        }
        if (!merged.pathProgress.previouslyCompletedPathIds) {
          merged.pathProgress.previouslyCompletedPathIds = [];
        }
        if (!merged.customPathProgress) {
          merged.customPathProgress = INITIAL_STATE.customPathProgress;
        }
        if (!merged.customPathProgress.previouslyCompletedPathIds) {
          merged.customPathProgress.previouslyCompletedPathIds = [];
        }
        
        return merged;
      } catch (e) {
        localStorage.removeItem("verso_state");
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("verso_active_tab") || "home";
  });
  const [pendingAttempt, setPendingAttempt] = useState<{
    type: "start" | "another";
    verseId?: string;
    source?: "daily" | "path" | "custom" | "extra" | "saved" | "daily";
  } | null>(null);
  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
  };
  const handleGoToPaths = (path?: Path | CustomPath) => {
    if (path) {
      setSelectedPath(path);
    } else {
      setSelectedPath(null);
    }
    handleSetActiveTab("paths");
  };
  const [showSettings, setShowSettings] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [editingPath, setEditingPath] = useState<CustomPath | null>(null);
  const [selectedPath, setSelectedPath] = useState<Path | CustomPath | null>(null);
  const [currentTourStepId, setCurrentTourStepId] = useState<string | null>(null);

  useEffect(() => {
    captureUtmParams();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("verso_state", JSON.stringify(state));
    } catch (e) {
      console.error("[App] Failed to save state to localStorage:", e);
    }
  }, [state]);

  useEffect(() => {
    localStorage.setItem("verso_active_tab", activeTab);
  }, [activeTab]);

  // Streak & Votd Daily Update Logic
  useEffect(() => {
    if (!state.onboarded) return;

    const checkDailyUpdate = () => {
      const today = getLocalDateString();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

      setState(prev => {
        if (prev.activeAttempt) {
          return prev;
        }

        if (prev.progress.lastPracticeDate === today && prev.lastVotdDate === today) {
          return prev;
        }

        let newStreak = prev.progress.currentStreak;
        let newBestStreak = prev.progress.bestStreak;
        let newProgress = { ...prev.progress };
        let updateNeeded = false;

        if (prev.progress.lastPracticeDate !== today) {
          updateNeeded = true;
          if (prev.progress.lastPracticeDate === yesterdayStr) {
            newStreak += 1;
          } else {
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

        if (prev.lastVotdDate !== today) {
          updateNeeded = true;
          return {
            ...prev,
            lastVotdDate: today,
            selectedVerseId: null, 
            progress: newProgress,
            pathProgress: {
              ...prev.pathProgress,
              pathCompletedToday: prev.pathProgress.lastCompletedAt === today
            },
            customPathProgress: {
              ...prev.customPathProgress,
              pathCompletedToday: prev.customPathProgress.lastCompletedAt === today
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
  }, [state.onboarded, !!state.activeAttempt]);

  useEffect(() => {
    const isDark = 
      state.theme === "dark" || 
      (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }, [state.theme]);

  // Reset memorization stages when configuration changes
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
    localStorage.removeItem(`memorize_failed_${verseId}`);
    
    // 1. If we click on the SAME verse that is currently active, resume it
    if (state.activeAttempt && state.activeAttempt.verseId === verseId) {
      setActiveTab("memorize");
      return;
    }

    // 2. If we have an active attempt on a DIFFERENT verse, prompt them first
    if (state.activeAttempt) {
      setPendingAttempt({ type: "start", verseId, source });
      return;
    }

    // 3. Otherwise, proceed to memorize
    startMemorizingBypassingCheck(verseId, source);
  };

  const startMemorizingBypassingCheck = (verseId: string, source: "daily" | "path" | "custom" | "extra" | "saved" = "daily") => {
    localStorage.removeItem(`memorize_failed_${verseId}`);
    setState(s => {
      let resolvedVerse: Verse;
      if (source === "custom" && s.selectedCustomVerse) {
        resolvedVerse = s.selectedCustomVerse;
      } else if (verseId) {
        const fromMock = MOCK_VERSES.find(v => v.id === verseId);
        const fromCustomList = s.customVerses.find(v => v.id === verseId);
        if (fromMock) {
          resolvedVerse = fromMock;
        } else if (fromCustomList) {
          resolvedVerse = fromCustomList;
        } else {
          let pathVerse: Verse | null = null;
          for (const p of s.customPaths) {
            const vData = p.verses.find(v => v.id === verseId);
            if (vData) {
              pathVerse = {
                id: vData.id,
                book: vData.reference.split(' ').slice(0, -1).join(' '),
                chapter: parseInt(vData.reference.split(' ').pop()?.split(':')[0] || '1'),
                verse: parseInt(vData.reference.split(' ').pop()?.split(':')[1] || '1'),
                text: {
                  es: { RVR1960: vData.text || "", NVI: vData.text || "", NBLA: vData.text || "", KJV: "", NIV: "", NASB: "" },
                  en: { KJV: vData.text || "", NIV: vData.text || "", NASB: vData.text || "", RVR1960: "", NVI: "", NBLA: "" }
                },
                copyright: vData.copyright
              } as Verse;
              break;
            }
          }
          resolvedVerse = pathVerse || getVerseByDate(getLocalDateString());
        }
      } else {
        resolvedVerse = getVerseByDate(getLocalDateString());
      }

      const reference = `${resolvedVerse.book} ${resolvedVerse.chapter}:${resolvedVerse.verse}`;
      const snapshot = {
        verseId: resolvedVerse.id,
        reference,
        translations: { ...s.selectedTranslations },
        memorizeMode: s.memorizeMode,
        verse: resolvedVerse,
        source: source,
        pathId: s.pathProgress.selectedPathId || s.customPathProgress.selectedPathId,
        pathDay: source === "path" ? (s.pathProgress.selectedPathId ? s.pathProgress.currentDay : s.customPathProgress.currentDay) : null,
      };

      return { 
        ...s, 
        selectedVerseId: verseId,
        activeSource: source,
        activeAttempt: snapshot,
        progress: {
          ...s.progress,
          verseStages: {
            ...s.progress.verseStages,
            [verseId]: 1
          }
        }
      };
    });
    setActiveTab("memorize");
  };

  const getAnotherVerse = async () => {
    if (state.activeAttempt) {
      setPendingAttempt({ type: "another" });
      return;
    }
    await getAnotherVerseBypassingCheck();
  };

  const getAnotherVerseBypassingCheck = async () => {
    const today = getLocalDateString();
    const votd = getVerseByDate(today);
    const currentActiveId = state.selectedVerseId || votd.id;
    const excludedIds = new Set([
      votd.id,
      currentActiveId,
      ...state.recentVerseIds
    ]);

    let eligiblePool = MOCK_VERSES.filter((v: any) => !excludedIds.has(v.id));

    if (eligiblePool.length === 0) {
      eligiblePool = MOCK_VERSES.filter((v: any) => v.id !== currentActiveId);
    }
    if (eligiblePool.length === 0) {
      eligiblePool = MOCK_VERSES;
    }

    const randomVerse = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
    
    if (!randomVerse) return;

    setState(prev => ({
      ...prev,
      isLoadingAnotherVerse: true,
      anotherVerseError: null
    }));

    try {
      const activePair = state.selectedTranslations;
      const esTrans = activePair.es;
      const enTrans = activePair.en;
      const mode = state.memorizeMode;

      const esBookName = getLocalizedBookName(randomVerse.book, 'es');
      const enBookName = getLocalizedBookName(randomVerse.book, 'en');
      const esRef = `${esBookName} ${randomVerse.chapter}:${randomVerse.verse}`;
      const enRef = `${enBookName} ${randomVerse.chapter}:${randomVerse.verse}`;

      let esRes: { text: string; reference: string; copyright: string } | null = null;
      let enRes: { text: string; reference: string; copyright: string } | null = null;

      if (mode === "es" || mode === "both") {
        const esBibleId = BIBLE_VERSIONS[esTrans] || BIBLE_VERSIONS.es;
        esRes = await getVerseFromApiBible(esRef, esBibleId);
        if (!esRes) {
          throw new Error(state.primaryLanguage === 'es' ? "No se pudo cargar la versión en español." : "Could not fetch Spanish translation.");
        }
      }

      if (mode === "en" || mode === "both") {
        const enBibleId = BIBLE_VERSIONS[enTrans] || BIBLE_VERSIONS.en;
        enRes = await getVerseFromApiBible(enRef, enBibleId);
        if (!enRes) {
          throw new Error(state.primaryLanguage === 'es' ? "No se pudo cargar la versión en inglés." : "Could not fetch English translation.");
        }
      }

      const initialEs: Record<Translation, string> = {
        RVR1960: esTrans === "RVR1960" ? (esRes ? esRes.text : "") : "",
        NVI: esTrans === "NVI" ? (esRes ? esRes.text : "") : "",
        NBLA: esTrans === "NBLA" ? (esRes ? esRes.text : "") : "",
        KJV: "", NIV: "", NASB: ""
      };

      const initialEn: Record<Translation, string> = {
        KJV: enTrans === "KJV" ? (enRes ? enRes.text : "") : "",
        NIV: enTrans === "NIV" ? (enRes ? enRes.text : "") : "",
        NASB: enTrans === "NASB" ? (enRes ? enRes.text : "") : "",
        RVR1960: "", NVI: "", NBLA: ""
      };

      const newVerseId = randomVerse.id;
      const newVerse: Verse = {
        id: newVerseId,
        book: randomVerse.book,
        chapter: randomVerse.chapter,
        verse: randomVerse.verse,
        text: {
          es: initialEs,
          en: initialEn
        },
        copyright: esRes?.copyright || enRes?.copyright,
        source: "api-bible"
      };

      const newRecent = [newVerseId, ...state.recentVerseIds].slice(0, 14);

      setState(prev => {
        const exists = prev.customVerses.some(v => v.id === newVerseId);
        let updatedCustom;
        if (exists) {
          updatedCustom = prev.customVerses.map(v => v.id === newVerseId ? newVerse : v);
        } else {
          updatedCustom = [...prev.customVerses, newVerse];
        }

        const reference = `${newVerse.book} ${newVerse.chapter}:${newVerse.verse}`;
        const snapshot = {
          verseId: newVerseId,
          reference,
          translations: { ...prev.selectedTranslations },
          memorizeMode: prev.memorizeMode,
          verse: newVerse,
          source: "extra" as const,
          pathId: prev.pathProgress.selectedPathId || prev.customPathProgress.selectedPathId,
          pathDay: null,
        };

        return {
          ...prev,
          selectedVerseId: newVerseId,
          activeSource: "extra",
          activeAttempt: snapshot,
          recentVerseIds: newRecent,
          customVerses: updatedCustom,
          isLoadingAnotherVerse: false,
          anotherVerseError: null,
          progress: {
            ...prev.progress,
            verseStages: {
              ...prev.progress.verseStages,
              [newVerseId]: 1
            }
          }
        };
      });

    } catch (err: any) {
      console.error("Failed to fetch another verse:", err);
      setState(prev => ({
        ...prev,
        isLoadingAnotherVerse: false,
        anotherVerseError: err.message || (state.primaryLanguage === 'es' ? "Error al cargar el versículo." : "Failed to load verse.")
      }));

      setTimeout(() => {
        setState(prev => {
          if (prev.anotherVerseError) {
            return { ...prev, anotherVerseError: null };
          }
          return prev;
        });
      }, 4000);
    }
  };

  const handleSelectPath = (pathId: string) => {
    const isCustom = pathId.startsWith('custom-path-');
    
    setState(s => {
      let saved = isCustom 
        ? (s.customPathProgress?.savedProgress || {})[pathId] || { currentDay: 1, completedDays: [] }
        : (s.pathProgress?.savedProgress || {})[pathId] || { currentDay: 1, completedDays: [] };
        
      if (isCustom) {
        const customPathObj = s.customPaths.find(p => p.id === pathId);
        if (customPathObj) {
          const totalDays = customPathObj.verses.length;
          const filteredCompleted = (saved.completedDays || []).filter(d => d <= totalDays);
          
          let computedDay = 1;
          for (let d = 1; d <= totalDays; d++) {
            if (!filteredCompleted.includes(d)) {
              computedDay = d;
              break;
            }
          }
          if (filteredCompleted.length === totalDays && totalDays > 0) {
            computedDay = totalDays;
          }
          
          saved = {
            currentDay: computedDay,
            completedDays: filteredCompleted
          };
        }
      }
      
      const isPathFullyCompleted = isCustom 
        ? (s.customPathProgress?.completedPathIds || []).includes(pathId)
        : (s.pathProgress?.completedPathIds || []).includes(pathId);
      
      const todayString = getLocalDateString();
      const lastCompletedAt = isCustom ? s.customPathProgress.lastCompletedAt : s.pathProgress.lastCompletedAt;

      // When selecting a path, we reset other explicit verse selections 
      // so the app correctly resolves the current path verse.
      const baseState = {
        ...s,
        activeSource: "path" as const,
        selectedVerseId: null,
        selectedCustomVerse: null
      };

      if (isCustom) {
        return {
          ...baseState,
          pathProgress: {
            ...s.pathProgress,
            selectedPathId: null // Clear preset selection when a custom path is chosen
          },
          customPathProgress: {
            ...s.customPathProgress,
            selectedPathId: pathId,
            currentDay: saved.currentDay,
            pathCompletedToday: lastCompletedAt === todayString && (saved.completedDays.includes(saved.currentDay) || isPathFullyCompleted)
          }
        };
      }

      return {
        ...baseState,
        customPathProgress: {
          ...s.customPathProgress,
          selectedPathId: null // Clear custom selection when a preset path is chosen
        },
        pathProgress: {
          ...s.pathProgress,
          selectedPathId: pathId,
          currentDay: saved.currentDay,
          pathCompletedToday: lastCompletedAt === todayString && (saved.completedDays.includes(saved.currentDay) || isPathFullyCompleted)
        }
      };
    });
    handleSetActiveTab("home");
  };

  const handleCompletePathDay = (): boolean => {
    const today = getLocalDateString();
    
    // Check which path is currently "active" in the progress tracker
    const customPathId = state.customPathProgress.selectedPathId;
    const presetPathId = state.pathProgress.selectedPathId;
    
    // Determine the active path ID exactly like Home.tsx
    const currentPathId = presetPathId || customPathId;
    if (!currentPathId) {
      return false;
    }

    const activeCustomPath = state.customPaths.find(p => p.id === currentPathId);
    const activePresetPath = PATHS.find(p => p.id === currentPathId);
    
    const isCustomActive = !!activeCustomPath;

    if (isCustomActive && activeCustomPath) {
      setState(s => {
        const dayNum = s.customPathProgress.currentDay;
        const isLastDay = dayNum >= activeCustomPath.verses.length;
        const nextDay = isLastDay ? dayNum : dayNum + 1;
        
        const currentSaved = (s.customPathProgress?.savedProgress || {})[currentPathId] || { currentDay: 1, completedDays: [] };
        const newCompletedDays = Array.from(new Set([...currentSaved.completedDays, dayNum]));
        
        const newSavedProgress = {
          ...(s.customPathProgress?.savedProgress || {}),
          [currentPathId]: { currentDay: nextDay, completedDays: newCompletedDays }
        };

        return {
          ...s,
          customPathProgress: {
            ...s.customPathProgress,
            currentDay: nextDay,
            lastCompletedAt: today,
            pathCompletedToday: true,
            completedPathIds: isLastDay && !(s.customPathProgress?.completedPathIds || []).includes(currentPathId)
              ? [...(s.customPathProgress?.completedPathIds || []), currentPathId]
              : (s.customPathProgress?.completedPathIds || []),
            savedProgress: newSavedProgress
          }
        };
      });
      return true;
    }

    if (activePresetPath) {
      setState(s => {
        const dayNum = s.pathProgress.currentDay;
        const isLastDay = dayNum >= activePresetPath.duration;
        const nextDay = isLastDay ? dayNum : dayNum + 1;
        
        const currentSaved = (s.pathProgress?.savedProgress || {})[currentPathId] || { currentDay: 1, completedDays: [] };
        const newCompletedDays = Array.from(new Set([...currentSaved.completedDays, dayNum]));
        
        const newSavedProgress = {
          ...(s.pathProgress?.savedProgress || {}),
          [currentPathId]: { currentDay: nextDay, completedDays: newCompletedDays }
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
      return true;
    }

    return false;
  };

  const handleSaveCustomPath = (path: CustomPath) => {
    setState(s => {
      const exists = s.customPaths.some(p => p.id === path.id);
      const newPaths = exists 
        ? s.customPaths.map(p => p.id === path.id ? path : p)
        : [...s.customPaths, path];
        
      const savedProgress = s.customPathProgress.savedProgress || {};
      const currentSaved = savedProgress[path.id] || { currentDay: 1, completedDays: [] };
      const filteredCompletedDays = (currentSaved.completedDays || []).filter(d => d <= path.verses.length);
      
      let computedDay = 1;
      for (let d = 1; d <= path.verses.length; d++) {
        if (!filteredCompletedDays.includes(d)) {
          computedDay = d;
          break;
        }
      }
      if (filteredCompletedDays.length === path.verses.length && path.verses.length > 0) {
        computedDay = path.verses.length;
      }
      
      const updatedSavedProgress = {
        ...savedProgress,
        [path.id]: {
          currentDay: computedDay,
          completedDays: filteredCompletedDays
        }
      };
      
      const isCurrentlyActive = s.customPathProgress.selectedPathId === path.id;
      
      const isCompleted = filteredCompletedDays.length === path.verses.length && path.verses.length > 0;
      const completedPathIds = s.customPathProgress.completedPathIds || [];
      const updatedCompletedPathIds = isCompleted 
        ? (completedPathIds.includes(path.id) ? completedPathIds : [...completedPathIds, path.id])
        : completedPathIds.filter(id => id !== path.id);
        
      return {
        ...s,
        customPaths: newPaths,
        customPathProgress: {
          ...s.customPathProgress,
          currentDay: isCurrentlyActive ? computedDay : s.customPathProgress.currentDay,
          completedPathIds: updatedCompletedPathIds,
          savedProgress: updatedSavedProgress
        }
      };
    });
    
    setSelectedPath(path);
    setEditingPath(null);
    handleSetActiveTab("paths");
  };

  const handleDeleteCustomPath = (pathId: string) => {
    setState(s => {
      const isSelected = s.customPathProgress.selectedPathId === pathId;
      return {
        ...s,
        customPaths: s.customPaths.filter(p => p.id !== pathId),
        customPathProgress: {
          ...s.customPathProgress,
          selectedPathId: isSelected ? null : s.customPathProgress.selectedPathId,
          // Clear saved progress for this path too
          savedProgress: Object.fromEntries(
            Object.entries(s.customPathProgress.savedProgress || {}).filter(([id]) => id !== pathId)
          )
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
          onGoToSaved={() => handleSetActiveTab('saved')} 
          onGoToPaths={(path) => handleGoToPaths(path)}
          onCompletePathDay={handleCompletePathDay}
        />
      );
      case "paths": 
        if (!isPremium) {
          return (
            <Paywall 
              state={state} 
              isDismissible={true}
              onSubscribe={() => {
                setMockPremium(true);
              }}
              onClose={() => handleSetActiveTab("home")}
            />
          );
        }
        return (
          <PathSelection 
            state={state} 
            setState={setState}
            onSelectPath={handleSelectPath} 
            onBack={() => handleSetActiveTab("home")} 
            onMemorize={(id, source) => startMemorizing(id, source || "path")}
            onCreateCustom={() => handleSetActiveTab("create-path")}
            onEditCustom={(path) => {
              setEditingPath(path);
              handleSetActiveTab("create-path");
            }}
            onDeleteCustom={handleDeleteCustomPath}
            selectedPath={selectedPath}
            setSelectedPath={setSelectedPath}
          />
        );
      case "create-path":
        return (
          <CustomPathCreate 
            state={state}
            onBack={() => {
              setEditingPath(null);
              handleSetActiveTab("paths");
            }}
            onSave={handleSaveCustomPath}
            initialPath={editingPath || undefined}
          />
        );
      case "memorize": return (
        <Memorize 
          state={state} 
          setState={setState} 
          onComplete={() => handleSetActiveTab("saved")} 
          onGoToFlashcards={(verseId) => {
            setState(s => {
              let nextAttempt = s.activeAttempt;
              if (!nextAttempt || nextAttempt.verseId !== verseId) {
                const resolvedVerse = MOCK_VERSES.find(v => v.id === verseId) || 
                                      s.customVerses.find(v => v.id === verseId);
                if (resolvedVerse) {
                  const reference = `${resolvedVerse.book} ${resolvedVerse.chapter}:${resolvedVerse.verse}`;
                  nextAttempt = {
                    verseId: resolvedVerse.id,
                    reference,
                    translations: { ...s.selectedTranslations },
                    memorizeMode: s.memorizeMode,
                    verse: resolvedVerse,
                    source: s.activeSource || "saved",
                    pathId: s.pathProgress.selectedPathId || s.customPathProgress.selectedPathId,
                    pathDay: s.activeSource === "path" ? (s.pathProgress.selectedPathId ? s.pathProgress.currentDay : s.customPathProgress.currentDay) : null,
                  };
                }
              }
              return {
                ...s,
                selectedVerseId: verseId,
                activeAttempt: nextAttempt
              };
            });
            setActiveTab("flashcards");
          }}
          onAbandon={() => {
            setState(s => {
              const nextProgress = { ...s.progress };
              if (nextProgress.verseStages && s.activeAttempt) {
                const updatedStages = { ...nextProgress.verseStages };
                if (s.progress.completedVerses.includes(s.activeAttempt.verseId)) {
                  updatedStages[s.activeAttempt.verseId] = 7;
                } else {
                  delete updatedStages[s.activeAttempt.verseId];
                }
                nextProgress.verseStages = updatedStages;
              }
              return {
                ...s,
                activeAttempt: null,
                progress: nextProgress
              };
            });
            handleSetActiveTab("home");
          }}
          tourStepId={currentTourStepId}
        />
      );
      case "flashcards": return (
        <Flashcards 
          state={state} 
          setState={setState} 
          onMemorize={(id) => startMemorizing(id, state.activeSource)} 
          onGoToSaved={() => handleSetActiveTab("saved")}
          onComplete={() => {
            if (state.activeSource === 'path') {
              handleCompletePathDay();
            }
          }}
        />
      );
      case "saved": return (
        <Saved 
          state={state} 
          setState={setState} 
          onStartMemorizing={(id, src) => startMemorizing(id, src || "saved")} 
          onGoToFlashcards={(verseId) => {
            setState(s => ({ ...s, selectedVerseId: verseId }));
            setActiveTab("flashcards");
          }}
        />
      );
      default: return null;
    }
  };

  const renderContentInner = () => {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-parchment dark:bg-espresso flex items-center justify-center">
          <Loader2 className="animate-spin text-teal" size={40} />
        </div>
      );
    }

    const onboardingNeeded = !state.onboarded;
    const paywallNeeded = !isPremium && state.onboarded; 
    
    if (onboardingNeeded) {
      return (
        <Onboarding 
          onComplete={(prefs) => {
            setState(prev => ({ 
              ...prev, 
              ...prefs, 
              onboarded: true,
              hasCompletedTour: false
            }));
            // After or during onboarding, if they "subscribed" in mock mode
            if (localStorage.getItem('verso_test_premium') === 'true') {
              setMockPremium(true);
            }
          }} 
        />
      );
    }

    if (paywallNeeded) {
      return (
        <Paywall 
          state={state}
          onSubscribe={() => setMockPremium(true)}
        />
      );
    }

    // Main App Layout
    return (
      <div className="flex flex-col min-h-screen-dynamic relative overflow-x-hidden bg-parchment dark:bg-espresso transition-colors duration-500">
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

        <main className="flex-1 flex flex-col pt-4 sm:pt-6 pb-24 sm:pb-32">
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

        <div 
          className="fixed bottom-0 left-0 right-0 z-40 px-6 pointer-events-none"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <nav className="max-w-xl mx-auto bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 px-6 sm:px-10 py-3.5 flex justify-around items-center rounded-[32px] shadow-[0_15px_50px_rgba(0,0,0,0.15)] pointer-events-auto transition-colors duration-500">
            <NavButton id="nav-home" active={activeTab === 'home'} activeColor="text-playful-purple" onClick={() => handleSetActiveTab('home')} icon={<HomeIcon size={22} />} label={state.primaryLanguage === 'es' ? 'Inicio' : 'Home'} />
            <NavButton id="nav-memorize" active={activeTab === 'memorize'} activeColor="text-gold" onClick={() => setActiveTab('memorize')} icon={<BookOpen size={22} />} label={state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'} />
            <NavButton id="nav-flashcards" active={activeTab === 'flashcards'} activeColor="text-coral" onClick={() => setActiveTab('flashcards')} icon={<Layers size={22} />} label={state.primaryLanguage === 'es' ? 'Tarjetas' : 'Cards'} />
            <NavButton id="nav-paths" active={activeTab === 'paths'} activeColor="text-sky-blue" onClick={() => { setSelectedPath(null); setEditingPath(null); handleSetActiveTab('paths'); }} icon={<Compass size={22} />} label={state.primaryLanguage === 'es' ? 'Series' : 'Paths'} />
            <NavButton id="nav-saved" active={activeTab === 'saved'} activeColor="text-teal" onClick={() => handleSetActiveTab('saved')} icon={<Sprout size={22} />} label={state.primaryLanguage === 'es' ? 'Guardados' : 'Saved'} />
          </nav>
        </div>

        <AnimatePresence>
          {showSettings && (
            <Settings state={state} setState={setState} onClose={() => setShowSettings(false)} onShowTour={() => { setShowSettings(false); setShowTour(true); }} />
          )}
        </AnimatePresence>

        {showTour && (
          <ProductTour 
            isOpen={showTour} 
            onClose={() => { setShowTour(false); setCurrentTourStepId(null); setState(s => ({ ...s, hasCompletedTour: true })); }} 
            primaryLanguage={state.primaryLanguage}
            onTabChange={setActiveTab}
            onStepChange={setCurrentTourStepId}
          />
        )}

        <AnimatePresence>
          {pendingAttempt && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-md"
                onClick={() => setPendingAttempt(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-charcoal rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 p-8 space-y-6 z-10"
              >
                <div className="space-y-3 text-center">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-4">
                    <AlertCircle size={28} />
                  </div>
                  <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                    {state.primaryLanguage === 'es' ? "Reto en curso" : "Challenge in progress"}
                  </h3>
                  <p className="text-xs font-semibold text-earth-light dark:text-lavender-muted leading-relaxed text-center">
                    {state.primaryLanguage === 'es' 
                      ? "Ya tienes un versículo en progreso. ¿Deseas continuar con tu reto actual o abandonarlo para empezar uno nuevo?"
                      : "You already have a verse challenge in progress. Do you want to continue your current challenge or quit it to start a new one?"}
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    onClick={() => {
                      const activeVerseId = state.activeAttempt?.verseId;
                      setPendingAttempt(null);
                      if (activeVerseId) {
                        const currentStage = state.progress.verseStages?.[activeVerseId] || 1;
                        if (currentStage === 6) {
                          setActiveTab("flashcards");
                        } else {
                          setActiveTab("memorize");
                        }
                      }
                    }}
                    className="w-full h-14 bg-teal text-white hover:bg-teal-600 rounded-3xl font-black uppercase tracking-widest text-xs transition-colors shadow-md shadow-teal/10"
                  >
                    {state.primaryLanguage === 'es' ? "continuar reto actual" : "continue current challenge"}
                  </button>
                  <button 
                    onClick={() => {
                      const nextAction = pendingAttempt;
                      setPendingAttempt(null);
                      
                      // Safety clear activeAttempt and reset stage for that verse
                      setState(s => {
                        const nextProgress = { ...s.progress };
                        if (nextProgress.verseStages && s.activeAttempt) {
                          const updatedStages = { ...nextProgress.verseStages };
                          delete updatedStages[s.activeAttempt.verseId];
                          nextProgress.verseStages = updatedStages;
                        }
                        return {
                          ...s,
                          activeAttempt: null,
                          progress: nextProgress
                        };
                      });

                      // Trigger pending action using the updated / cleared state
                      setTimeout(() => {
                        if (nextAction.type === "start" && nextAction.verseId) {
                          startMemorizingBypassingCheck(nextAction.verseId, nextAction.source || "daily");
                        } else if (nextAction.type === "another") {
                          getAnotherVerseBypassingCheck();
                        }
                      }, 50);
                    }}
                    className="w-full h-14 bg-coral/10 hover:bg-coral/20 text-coral rounded-3xl font-black uppercase tracking-widest text-xs transition-colors"
                  >
                    {state.primaryLanguage === 'es' ? "abandonar reto actual" : "quit current challenge"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return renderContentInner();
}

export default function App() {
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen bg-parchment dark:bg-espresso flex flex-col items-center justify-center text-center p-8 space-y-6">
        <div className="w-20 h-20 bg-lavender/10 rounded-3xl flex items-center justify-center">
          <RotateCcw size={40} className="text-lavender" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-black text-earth dark:text-ivory">Error</h2>
          <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto">Please restart the app.</p>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="btn-primary px-8">Reset App</button>
      </div>
    }>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function NavButton({ id, active, activeColor, onClick, icon, label }: { id: string, active: boolean, activeColor: string, onClick: () => void, icon: any, label: string }) {
  return (
    <button id={id} onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? activeColor : 'text-earth/40 dark:text-parchment/40'}`}>
      <motion.div animate={{ scale: active ? 1.1 : 1, y: active ? -3 : 0 }} whileHover={{ scale: active ? 1.15 : 1.05, y: active ? -4 : -2 }} whileTap={{ scale: 0.95, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
        {icon}
      </motion.div>
      <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40 scale-100'}`}>{label}</span>
    </button>
  );
}
