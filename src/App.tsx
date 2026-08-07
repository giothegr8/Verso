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
import {
  ACTIVE_ATTEMPT_SCHEMA_VERSION,
  REVIEW_SCHEMA_VERSION,
  ActiveAttemptSnapshot,
  ActiveVerseSource,
  AppState,
  LanguageMode,
  MemorizeLanguage,
  ReviewSource,
  Translation,
  TRANSLATION_PAIRS,
  Verse
} from "./types";
import { MOCK_VERSES, getVerseByDate, PATHS } from "./constants";
import { getLocalDateString, getLocalizedBookName } from "./utils/verseUtils";
import {
  ensureReviewRecords,
  isDue,
  passageKeyForVerse,
  scopeToMemorizeMode,
  selectReviewQueue
} from "./utils/reviewQueue";
import { sanitizeReviewRecord, toIso } from "./utils/reviewSchedule";
import { rotateReminder } from "./utils/reminderRotation";
import { getVerseFromApiBible, BIBLE_VERSIONS } from "./services/apiBible";

// Contexts
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Components
import Home from "./components/Home";
import Memorize from "./components/Memorize";
import Review from "./components/Review";
import Flashcards from "./components/Flashcards";
import Saved from "./components/Saved";
import Onboarding from "./components/Onboarding";
import Settings from "./components/Settings";
import Paywall from "./components/Paywall";
import ProductTour from "./components/ProductTour";
import PathSelection from "./components/PathSelection";
import CustomPathCreate from "./components/CustomPathCreate";
import VersoLogo from "./components/VersoLogo";
import { BrandIcon, IconButton } from "./components/ui";
import type { BrandIconName } from "./components/ui";
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
    completionsByLanguage: {},
    completionsByTranslation: {},
    lastCompletedLanguage: {},
    lastCompletedTranslation: {},
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
  reviewRecords: {},
  activeReview: null,
  lastReviewCompletion: null,
};

const ES_TRANSLATIONS = ["RVR1960", "NVI", "NBLA"];
const isEsTranslation = (t: string) => ES_TRANSLATIONS.includes(t);
// A slot counts as successfully loaded only if it holds real text: not empty,
// not a "coming soon" placeholder, and not a loadVerseAndMerge failure sentinel.
const isSlotSuccessfullyLoaded = (txt?: string): boolean => {
  if (!txt) return false;
  const low = txt.trim().toLowerCase();
  if (low === "") return false;
  if (low.includes("coming soon") || low.includes("próximamente") || low.includes("proximamente")) return false;
  if (low.includes("error loading") || low.includes("error al cargar")) return false;
  return true;
};
// The literal failure strings loadVerseAndMerge writes when a fetch returns no
// text; distinguishes a definitive failure from a not-yet-loaded (empty) slot.
const isFailureSentinel = (txt?: string): boolean => {
  if (!txt) return false;
  const low = txt.toLowerCase();
  return low.includes("error loading") || low.includes("error al cargar");
};

type AttemptReviewPair = { mode: LanguageMode; es?: Translation; en?: Translation };

const getAttemptLanguageOrder = (
  mode: LanguageMode,
  uiLanguage: "es" | "en"
): MemorizeLanguage[] => {
  if (mode === "both") {
    return uiLanguage === "en" ? ["en", "es"] : ["es", "en"];
  }
  return [mode];
};

const sameLanguageOrder = (a?: MemorizeLanguage[], b?: MemorizeLanguage[]) => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((lang, idx) => lang === b[idx]);
};

const createAttemptId = () => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall back below.
  }
  return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getEmptyTranslationText = (): Verse["text"] => ({
  es: { RVR1960: "", NVI: "", NBLA: "", KJV: "", NIV: "", NASB: "" },
  en: { KJV: "", NIV: "", NASB: "", RVR1960: "", NVI: "", NBLA: "" }
});

const getAttemptPathId = (state: AppState) =>
  state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId || null;

const getAttemptPathDay = (state: AppState, source: ActiveVerseSource) => {
  if (source !== "path") return null;
  return state.pathProgress.selectedPathId
    ? state.pathProgress.currentDay
    : state.customPathProgress.selectedPathId
      ? state.customPathProgress.currentDay
      : null;
};

const getAttemptContextKey = (
  state: AppState,
  source: ActiveVerseSource,
  verse: Verse,
  reference: string
) => {
  const pathId = getAttemptPathId(state) || "";
  const pathDay = getAttemptPathDay(state, source) ?? "";
  const dailyDate = source === "daily" ? (state.lastVotdDate || getLocalDateString()) : "";
  const customId = source === "custom" ? verse.id : "";
  const savedId = source === "saved" ? verse.id : "";
  return JSON.stringify({
    source,
    verseId: verse.id,
    reference,
    pathId: source === "path" ? pathId : "",
    pathDay,
    dailyDate,
    customId,
    savedId
  });
};

const getAttemptVerseContentKey = (verse: Verse, translations: { es: Translation; en: Translation }) => {
  return JSON.stringify({
    verseId: verse.id,
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    preferredTranslation: verse.preferredTranslation || "",
    source: verse.source || "",
    esTranslation: translations.es,
    enTranslation: translations.en,
    esText: verse.text?.es?.[translations.es] || "",
    enText: verse.text?.en?.[translations.en] || ""
  });
};

const createCompletedLanguages = (languageOrder: MemorizeLanguage[]) => {
  return languageOrder.reduce<Partial<Record<MemorizeLanguage, boolean>>>((acc, lang) => {
    acc[lang] = false;
    return acc;
  }, {});
};

const isValidAttemptSnapshotShape = (attempt?: ActiveAttemptSnapshot | null): attempt is ActiveAttemptSnapshot => {
  if (!attempt || attempt.schemaVersion !== ACTIVE_ATTEMPT_SCHEMA_VERSION) return false;
  if (!attempt.attemptId || typeof attempt.attemptId !== "string") return false;
  if (attempt.uiLanguage !== "es" && attempt.uiLanguage !== "en") return false;
  if (!attempt.translations?.es || !attempt.translations?.en) return false;
  if (attempt.memorizeMode !== "es" && attempt.memorizeMode !== "en" && attempt.memorizeMode !== "both") return false;
  if (!attempt.verse || attempt.verseId !== attempt.verse.id) return false;
  if (!attempt.contextKey || !attempt.verseContentKey) return false;

  const expectedOrder = getAttemptLanguageOrder(attempt.memorizeMode, attempt.uiLanguage);
  if (!sameLanguageOrder(attempt.languageOrder, expectedOrder)) return false;

  const passIndex = attempt.currentPassIndex ?? 0;
  if (!Number.isInteger(passIndex) || passIndex < 0 || passIndex >= expectedOrder.length) return false;

  return attempt.verseContentKey === getAttemptVerseContentKey(attempt.verse, attempt.translations);
};

const sanitizeHydratedAttemptState = (merged: AppState) => {
  const activeAttempt = isValidAttemptSnapshotShape(merged.activeAttempt)
    ? merged.activeAttempt
    : null;
  merged.activeAttempt = activeAttempt;

  const stages = merged.progress.verseStages || {};
  const nextStages: Record<string, number> = {};
  const activeAttemptCardsReady = !!(
    activeAttempt?.cardsReady &&
    activeAttempt.textComplete &&
    activeAttempt.languageOrder?.every(lang => activeAttempt.completedLanguages?.[lang] === true)
  );
  Object.entries(stages).forEach(([verseId, stageValue]) => {
    const stage = Number(stageValue);
    if (stage === 7) {
      nextStages[verseId] = 7;
      return;
    }
    if (
      activeAttempt &&
      verseId === activeAttempt.verseId &&
      stage >= 1 &&
      (stage <= 5 || (stage === 6 && activeAttemptCardsReady))
    ) {
      nextStages[verseId] = stage;
    }
  });
  merged.progress.verseStages = nextStages;
};

/**
 * PHASE 4A — hydration repair for the review layer. Nothing here can throw, and
 * nothing here deletes a review record: a malformed field is clamped or reset
 * to its neutral value so real mastery is never silently lost.
 */
const sanitizeHydratedReviewState = (merged: AppState) => {
  const nowMs = Date.now();

  const rawRecords = merged.reviewRecords;
  if (!rawRecords || typeof rawRecords !== "object") {
    merged.reviewRecords = {};
  } else {
    const repaired: AppState["reviewRecords"] = {};
    Object.entries(rawRecords).forEach(([key, value]) => {
      if (!key) return;
      repaired![key] = sanitizeReviewRecord(value as any, key, nowMs);
    });
    merged.reviewRecords = repaired;
  }

  const draft = merged.activeReview;
  const validDraft =
    !!draft &&
    typeof draft.sessionId === "string" &&
    !!draft.sessionId &&
    typeof draft.passageKey === "string" &&
    !!draft.passageKey &&
    typeof draft.verseId === "string" &&
    (draft.source === "queue" || draft.source === "practice") &&
    typeof draft.wasDueAtStart === "boolean" &&
    (draft.currentStage === "recall" || draft.currentStage === "citation");

  // A review draft is only meaningful alongside the attempt snapshot that owns
  // its Scripture. If the attempt did not survive hydration, the draft is
  // dropped rather than left pointing at nothing.
  merged.activeReview =
    validDraft && merged.activeAttempt?.reviewSessionId === draft!.sessionId ? draft! : null;

  const completion = merged.lastReviewCompletion;
  const validCompletion =
    !!completion &&
    typeof completion.sessionId === "string" &&
    typeof completion.passageKey === "string" &&
    typeof completion.nextReviewAt === "string";
  merged.lastReviewCompletion = validCompletion ? completion! : null;
};

const resolveVerseForAttempt = (
  state: AppState,
  verseId: string,
  source: ActiveVerseSource
): Verse => {
  if (source === "custom" && state.selectedCustomVerse) {
    return state.selectedCustomVerse;
  }

  if (verseId) {
    const fromMock = MOCK_VERSES.find(v => v.id === verseId);
    const fromCustomList = state.customVerses.find(v => v.id === verseId);
    if (fromMock) return fromMock;
    if (fromCustomList) return fromCustomList;

    for (const p of state.customPaths) {
      const vData = p.verses.find(v => v.id === verseId);
      if (vData) {
        const isEsText = vData.translation
          ? isEsTranslation(vData.translation)
          : p.language === "es";
        const slotKey = vData.translation || (isEsText ? "RVR1960" : "KJV");
        const ptext = getEmptyTranslationText();
        if (vData.text) {
          ptext[isEsText ? "es" : "en"][slotKey] = vData.text;
        }
        return {
          id: vData.id,
          book: vData.reference.split(" ").slice(0, -1).join(" "),
          chapter: parseInt(vData.reference.split(" ").pop()?.split(":")[0] || "1"),
          verse: parseInt(vData.reference.split(" ").pop()?.split(":")[1] || "1"),
          text: ptext,
          copyright: vData.copyright
        } as Verse;
      }
    }
  }

  return getVerseByDate(getLocalDateString());
};

const buildAttemptSnapshot = (
  state: AppState,
  resolvedVerse: Verse,
  source: ActiveVerseSource,
  reviewPair?: AttemptReviewPair
): ActiveAttemptSnapshot => {
  const effMode: LanguageMode = reviewPair?.mode ?? state.memorizeMode;
  const translations = {
    es: reviewPair?.es ?? state.selectedTranslations.es,
    en: reviewPair?.en ?? state.selectedTranslations.en,
  };
  const reference = `${resolvedVerse.book} ${resolvedVerse.chapter}:${resolvedVerse.verse}`;
  const languageOrder = getAttemptLanguageOrder(effMode, state.primaryLanguage);

  // PHASE 4A. Every attempt — review or ordinary Memorize — carries the
  // canonical passage identity and whether the passage was already due at the
  // MOMENT this session began. Capturing it here (never at completion) is what
  // stops voluntary early practice from farming mastery, and what lets an
  // ordinary Memorize session on an already-acquired passage update its
  // existing review record under the same rules.
  const reviewPassageKey = passageKeyForVerse(resolvedVerse) || undefined;
  const reviewRecord = reviewPassageKey ? state.reviewRecords?.[reviewPassageKey] : undefined;
  const wasDueAtStart = reviewRecord ? isDue(reviewRecord, Date.now()) : true;

  return {
    schemaVersion: ACTIVE_ATTEMPT_SCHEMA_VERSION,
    attemptId: createAttemptId(),
    reviewPassageKey,
    wasDueAtStart,
    verseId: resolvedVerse.id,
    reference,
    translations,
    memorizeMode: effMode,
    verse: resolvedVerse,
    source,
    pathId: getAttemptPathId(state),
    pathDay: getAttemptPathDay(state, source),
    dayReference: source === "path" ? reference : null,
    uiLanguage: state.primaryLanguage,
    languageOrder,
    currentPassIndex: 0,
    completedLanguages: createCompletedLanguages(languageOrder),
    cardsReady: false,
    textComplete: false,
    contextKey: getAttemptContextKey(state, source, resolvedVerse, reference),
    verseContentKey: getAttemptVerseContentKey(resolvedVerse, translations),
  };
};

const isAttemptCompatibleWithRequest = (
  attempt: ActiveAttemptSnapshot | null | undefined,
  expected: ActiveAttemptSnapshot
) => {
  if (!isValidAttemptSnapshotShape(attempt)) return false;
  return (
    attempt.verseId === expected.verseId &&
    attempt.source === expected.source &&
    attempt.contextKey === expected.contextKey &&
    attempt.memorizeMode === expected.memorizeMode &&
    attempt.uiLanguage === expected.uiLanguage &&
    sameLanguageOrder(attempt.languageOrder, expected.languageOrder) &&
    attempt.translations.es === expected.translations.es &&
    attempt.translations.en === expected.translations.en &&
    attempt.verseContentKey === expected.verseContentKey
  );
};

const isAttemptCompatibleWithCurrentConfig = (
  attempt: ActiveAttemptSnapshot | null | undefined,
  state: AppState
) => {
  if (!isValidAttemptSnapshotShape(attempt)) return false;
  const expectedOrder = getAttemptLanguageOrder(state.memorizeMode, state.primaryLanguage);
  return (
    attempt.memorizeMode === state.memorizeMode &&
    attempt.uiLanguage === state.primaryLanguage &&
    sameLanguageOrder(attempt.languageOrder, expectedOrder) &&
    attempt.translations.es === state.selectedTranslations.es &&
    attempt.translations.en === state.selectedTranslations.en &&
    attempt.verseContentKey === getAttemptVerseContentKey(attempt.verse, attempt.translations)
  );
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
        // Backward-compatible defaults for language/translation completion
        // history. Missing on older saved records; default to empty so existing
        // progress is never reset, and never retroactively attribute old
        // combined completions to a language.
        if (!merged.progress.completionsByLanguage) {
          merged.progress.completionsByLanguage = {};
        }
        if (!merged.progress.completionsByTranslation) {
          merged.progress.completionsByTranslation = {};
        }
        if (!merged.progress.lastCompletedLanguage) {
          merged.progress.lastCompletedLanguage = {};
        }
        if (!merged.progress.lastCompletedTranslation) {
          merged.progress.lastCompletedTranslation = {};
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
        sanitizeHydratedAttemptState(merged);
        sanitizeHydratedReviewState(merged);

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
    type: "start" | "another" | "navigate";
    verseId?: string;
    source?: ActiveVerseSource;
    destinationTab?: string;
    // Review Now (Saved) may request reopening a completed verse in the exact
    // language/translation it was completed in, overriding the global selection.
    reviewPair?: { mode: LanguageMode; es?: Translation; en?: Translation };
  } | null>(null);
  // An attempt is only "protected" (guarded by the challenge-in-progress warning)
  // once it has advanced past Step 1. The `started` flag latches the first time the
  // verse reaches stage >= 2 (see the latch effect below) and survives reviewing
  // back to Step 1, so we rely on it rather than the live (non-monotonic) stage.
  // Step 1 of a fresh attempt stays unguarded; the flag clears naturally whenever
  // activeAttempt is cleared/replaced (abandon, confirmed exit, completion, new verse).
  const activeAttemptInProgress = !!state.activeAttempt && state.activeAttempt.started === true;
  const handleSetActiveTab = (tab: string) => {
    if (activeAttemptInProgress && state.activeAttempt) {
      // Phase 3C: Citation is Step 6 of Memorize, so an in-progress attempt is
      // always safe on the Memorize tab — including stage 6, which previously
      // routed to Cards.
      const safeTab = "memorize";
      if (tab !== safeTab) {
        setPendingAttempt({ type: "navigate", destinationTab: tab });
        return;
      }
    }
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
  // Tracks an in-flight translation change on an active custom verse (from the
  // Home Quick Switch or Settings Save). preferredTranslation is reconciled to
  // `target` only after its slot loads successfully; on failure the global
  // selection rolls back to `prevPreferred`. Keyed by verseId so a verse change
  // discards a stale pending switch. Not persisted.
  const [pendingSwitch, setPendingSwitch] = useState<{ verseId: string; lang: 'es' | 'en'; target: Translation; prevPreferred: Translation } | null>(null);

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

  // Shared, fetch-gated "change active translation" operation used by both the
  // Home Quick Switch and Settings Save. It updates selectedTranslations now (the
  // single fetch is performed by Home's existing on-the-fly loading effect); for
  // an active custom verse it defers the preferredTranslation flip to the
  // reconciliation effect below, so label, Bible ID, reference, and body move as
  // one snapshot only after the requested translation loads.
  // Returns the outcome for the *currently active custom verse* only. The global
  // selectedTranslations preference below is always saved and never rolled back.
  // 'verse-unavailable' signals that the active custom verse has no loaded text
  // for the newly selected translation yet, so its body is intentionally left on
  // its existing translation and the caller should warn rather than claim a full
  // success. For any other case (daily/mock/path verse, or an already-loaded
  // slot) the result is 'switched'.
  const changeActiveTranslation = (lang: 'es' | 'en', id: Translation): 'switched' | 'verse-unavailable' => {
    const cv = state.activeSource === "custom" ? state.selectedCustomVerse : null;
    const pref = cv?.preferredTranslation;
    let result: 'switched' | 'verse-unavailable' = 'switched';
    if (cv && pref && (isEsTranslation(pref) ? 'es' : 'en') === lang && pref !== id) {
      // Defer the custom verse's preferredTranslation flip to the reconciliation
      // effect; it flips only if/when the requested translation loads. If the verse
      // has no successfully-loaded text for the target translation yet, report it
      // so the global preference is saved without claiming the verse now displays it.
      setPendingSwitch({ verseId: cv.id, lang, target: id, prevPreferred: pref });
      if (!isSlotSuccessfullyLoaded(cv.text?.[lang]?.[id])) {
        result = 'verse-unavailable';
      }
    }
    setState(s => ({ ...s, selectedTranslations: { ...s.selectedTranslations, [lang]: id } }));
    return result;
  };

  // Reconcile a pending custom-verse translation change once its slot resolves.
  // On success the snapshot flips atomically; on a definitive failure the global
  // selection rolls back so it never claims a translation that did not load.
  useEffect(() => {
    if (!pendingSwitch) return;
    const cv = state.activeSource === "custom" ? state.selectedCustomVerse : null;
    if (!cv || cv.id !== pendingSwitch.verseId) {
      setPendingSwitch(null);
      return;
    }
    const { lang, target } = pendingSwitch;
    // Still fetching the requested translation — wait.
    if (state.loadingTranslations && state.loadingTranslations[`${cv.id}_${target}`]) return;
    const slot = cv.text?.[lang]?.[target];
    if (isSlotSuccessfullyLoaded(slot)) {
      setState(s => {
        if (s.activeSource !== "custom" || !s.selectedCustomVerse) return s;
        if (s.selectedCustomVerse.preferredTranslation === target) return s;
        const updated = { ...s.selectedCustomVerse, preferredTranslation: target };
        return {
          ...s,
          selectedCustomVerse: updated,
          customVerses: s.customVerses.map(v => v.id === updated.id ? { ...v, preferredTranslation: target } : v)
        };
      });
      setPendingSwitch(null);
    } else if (isFailureSentinel(slot)) {
      // The active custom verse cannot be loaded in the requested translation.
      // The global translation preference is independent of whether this single
      // verse is available, so it is NOT rolled back. Leave the verse on its
      // existing preferredTranslation so its body is never falsely relabeled;
      // future verses use the saved preference.
      setPendingSwitch(null);
    }
    // else: empty/not-yet-loaded — keep waiting for the loading effect.
  }, [pendingSwitch, state.selectedCustomVerse, state.loadingTranslations, state.activeSource]);

  // Streak & Votd Daily Update Logic
  useEffect(() => {
    if (!state.onboarded) return;

    const checkDailyUpdate = () => {
      const today = getLocalDateString();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

      setState(prev => {
        // MIDNIGHT / DATE-ROLLOVER PROTECTION. While any session owns the
        // screen — an ordinary Memorize attempt OR a Phase 4A review — the
        // daily refresh is frozen, so the active passage, its Scripture and its
        // Citation can never be replaced mid-flow. Queue eligibility refreshes
        // separately and never touches active session content.
        if (prev.activeAttempt || prev.activeReview) {
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
  }, [state.onboarded, !!state.activeAttempt, !!state.activeReview]);

  // =========================================================================
  // PHASE 4A — review clock, lazy initialization and controlled refresh.
  //
  // `reviewNowMs` is the ONLY clock the queue reads. It advances at four
  // defined moments — app start, Review screen open, window focus regained,
  // and immediately after a review finalizes — never on a per-second tick.
  // Refreshing it recomputes eligibility only; it can never swap the Scripture
  // of a session already in flight.
  // =========================================================================
  const [reviewNowMs, setReviewNowMs] = useState(() => Date.now());
  const refreshReviewClock = React.useCallback(() => setReviewNowMs(Date.now()), []);

  useEffect(() => {
    const onFocus = () => refreshReviewClock();
    const onVisibility = () => {
      if (!document.hidden) refreshReviewClock();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshReviewClock]);

  // Lazy initialization: create one review record per unique acquired passage
  // that has none. Never a destructive or all-at-once migration — it adds
  // bookkeeping only, and `ensureReviewRecords` returns null when nothing
  // changed, so this can never loop.
  useEffect(() => {
    if (!state.onboarded) return;
    setState(s => {
      const next = ensureReviewRecords(s, Date.now());
      return next ? { ...s, reviewRecords: next } : s;
    });
  }, [
    state.onboarded,
    state.progress.completedVerses,
    state.customVerses,
    state.selectedTranslations.es,
    state.selectedTranslations.en
  ]);

  useEffect(() => {
    // V1 ships dark-only. Force the dark theme regardless of the persisted
    // `state.theme` preference (which is left untouched so no user data is lost
    // and Settings is not modified). Light mode is not implemented in V1.
    const root = document.documentElement;
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
    document.body.classList.add("dark");
  }, [state.theme]);

  // Reset memorization stages only when the memorization configuration genuinely
  // changes after mount. The ref captures the initial hydrated configuration, so a
  // browser reload (where these values equal their hydrated originals) never wipes
  // the restored verseStages and a completed verse stays Cards-eligible. We compare
  // the actual previous values rather than a bare first-render boolean, so repeated
  // or StrictMode effect replays with unchanged values can never trigger a reset.
  const prevMemorizeConfigRef = React.useRef({
    es: state.selectedTranslations.es,
    en: state.selectedTranslations.en,
    mode: state.memorizeMode,
    uiLanguage: state.primaryLanguage,
  });
  useEffect(() => {
    const prev = prevMemorizeConfigRef.current;
    if (
      prev.es === state.selectedTranslations.es &&
      prev.en === state.selectedTranslations.en &&
      prev.mode === state.memorizeMode &&
      prev.uiLanguage === state.primaryLanguage
    ) {
      return;
    }
    prevMemorizeConfigRef.current = {
      es: state.selectedTranslations.es,
      en: state.selectedTranslations.en,
      mode: state.memorizeMode,
      uiLanguage: state.primaryLanguage,
    };
    setState(s => {
      if (!s.activeAttempt) return s;
      // PHASE 4A. A Review session's languages are fixed by its own saved scope,
      // not by the global memorize preference, so this compatibility check does
      // not apply to it. Dropping the attempt here would let an interface-
      // language change end an in-flight review — exactly what the immutable
      // session snapshot exists to prevent.
      if (s.activeReview && s.activeAttempt.reviewSessionId === s.activeReview.sessionId) return s;
      if (isAttemptCompatibleWithCurrentConfig(s.activeAttempt, s)) return s;

      const nextStages = { ...(s.progress.verseStages || {}) };
      if (Number(nextStages[s.activeAttempt.verseId]) !== 7) {
        delete nextStages[s.activeAttempt.verseId];
      }

      return {
        ...s,
        activeAttempt: null,
        progress: {
          ...s.progress,
          verseStages: nextStages
        }
      };
    });
  }, [state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode, state.primaryLanguage]);

  // Latch activeAttempt.started once the verse advances past Step 1 (stage 2-6).
  // Once latched it stays set even if the user reviews back to Step 1, so the
  // challenge-in-progress guard keeps protecting the attempt. It clears naturally
  // when activeAttempt is cleared/replaced (abandon, confirmed exit, completion,
  // starting another verse).
  useEffect(() => {
    if (!state.activeAttempt || state.activeAttempt.started) return;
    const stage = state.progress.verseStages?.[state.activeAttempt.verseId];
    if (stage === undefined || stage < 2 || stage > 6) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.started) return s;
      const liveStage = s.progress.verseStages?.[s.activeAttempt.verseId];
      if (liveStage === undefined || liveStage < 2 || liveStage > 6) return s;
      return { ...s, activeAttempt: { ...s.activeAttempt, started: true } };
    });
  }, [state.activeAttempt, state.progress.verseStages]);

  const startMemorizing = (verseId: string, source: ActiveVerseSource = "daily", reviewPair?: AttemptReviewPair) => {
    localStorage.removeItem(`memorize_failed_${verseId}`);
    // Phase 3C: the legacy citation failure flag must never survive into a new
    // or resumed attempt, or the Citation Step would open with zero attempts.
    localStorage.removeItem(`citation_failed_${verseId}`);

    const resolvedVerse = resolveVerseForAttempt(state, verseId, source);
    const expectedAttempt = buildAttemptSnapshot(state, resolvedVerse, source, reviewPair);

    // 1. If we click on the same compatible attempt, resume it.
    if (isAttemptCompatibleWithRequest(state.activeAttempt, expectedAttempt)) {
      setActiveTab("memorize");
      return;
    }

    // 2. If a different compatible attempt is in progress, prompt before leaving it.
    // An incompatible same-verse attempt is replaced with a fresh attempt below.
    if (activeAttemptInProgress && state.activeAttempt && state.activeAttempt.verseId !== verseId) {
      setPendingAttempt({ type: "start", verseId, source, reviewPair });
      return;
    }

    // 3. Otherwise, proceed with a fresh attempt for the requested context.
    startMemorizingBypassingCheck(verseId, source, reviewPair);
  };

  const startMemorizingBypassingCheck = (verseId: string, source: ActiveVerseSource = "daily", reviewPair?: AttemptReviewPair) => {
    localStorage.removeItem(`memorize_failed_${verseId}`);
    localStorage.removeItem(`citation_failed_${verseId}`);
    setState(s => {
      const resolvedVerse = resolveVerseForAttempt(s, verseId, source);
      const snapshot = buildAttemptSnapshot(s, resolvedVerse, source, reviewPair);

      // Review Now from Saved supplies the completed language/translation so the
      // verse reopens in the translation represented by the Saved card rather
      // than whatever is currently selected in Settings. When no override is
      // supplied this is a no-op and the global selection is used as before.
      const effMode = snapshot.memorizeMode;
      const effTranslations = snapshot.translations;

      // Custom verses resolve their displayed translation from preferredTranslation
      // (see getValidatedVerse). Align it with the reviewed translation so the
      // override is honored; this is a no-op for older single-translation records.
      const reviewedSingle: Translation | undefined =
        reviewPair && effMode !== 'both' ? (effMode === 'es' ? effTranslations.es : effTranslations.en) : undefined;
      const isCustomResolved = resolvedVerse.source === "custom";
      const nextSelectedCustomVerse =
        reviewedSingle && isCustomResolved && s.selectedCustomVerse && s.selectedCustomVerse.id === resolvedVerse.id
          ? { ...s.selectedCustomVerse, preferredTranslation: reviewedSingle }
          : s.selectedCustomVerse;
      const nextCustomVerses =
        reviewedSingle && isCustomResolved
          ? s.customVerses.map(v => v.id === resolvedVerse.id ? { ...v, preferredTranslation: reviewedSingle } : v)
          : s.customVerses;

      return {
        ...s,
        selectedVerseId: verseId,
        activeSource: source,
        selectedTranslations: effTranslations,
        memorizeMode: effMode,
        selectedCustomVerse: nextSelectedCustomVerse,
        customVerses: nextCustomVerses,
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

  /**
   * PHASE 4A — launch a review of one already-acquired passage.
   *
   * The session opens directly in the approved Step 5 Recall Workspace and
   * continues to the approved Step 6 Citation. It creates NO new Saved passage
   * and NO new acquisition: `completedVerses`, `savedVerses`, `completionCounts`
   * and `verseStages` are all left exactly as they are, and the passage stays
   * acquired throughout.
   *
   * The attempt snapshot it builds is the immutable session content — canonical
   * passage key, localized reference, valid Scripture, translations and
   * language availability — so midnight, a focus change, a Home refresh, a
   * queue refresh, a rerender or a reload cannot replace the passage.
   */
  const startReview = (
    passageKey: string,
    source: ReviewSource,
    /**
     * OPTIONAL SINGLE-LANGUAGE PRACTICE of a bilingual passage. When present
     * the session runs that one language and can NEVER satisfy the bilingual
     * due review — nothing is scheduled, cleared or advanced by it.
     */
    practiceLanguage?: MemorizeLanguage
  ) => {
    const queue = selectReviewQueue(state, Date.now());
    const row =
      queue.due.find(r => r.passage.passageKey === passageKey) ||
      queue.upcoming.find(r => r.passage.passageKey === passageKey) ||
      null;
    if (!row) return;

    const resolvedVerse = row.passage.verse;
    const verseId = row.passage.verseId;

    // The SAVED scope decides the session's languages — never the interface
    // language, and never the user's global memorize preference. A practice
    // language, when chosen, narrows this one session only.
    const sessionMode: LanguageMode = practiceLanguage
      ? practiceLanguage
      : scopeToMemorizeMode(row.scope);
    const qualifiesAsReview = !practiceLanguage;

    // A stale failure flag would otherwise open Step 5 or the Citation Step
    // with zero attempts left.
    try {
      localStorage.removeItem(`memorize_failed_${verseId}`);
      localStorage.removeItem(`citation_failed_${verseId}`);
    } catch (e) {
      console.warn("[Review] Failed to clear stale failure keys", e);
    }

    const sessionId = createAttemptId();

    setState(s => {
      // The session's languages ride the IMMUTABLE attempt snapshot, so a
      // reload, a midnight rollover or an interface-language change can never
      // turn a bilingual review into monolingual practice, or one practice
      // language into the other.
      const snapshot = buildAttemptSnapshot(s, resolvedVerse, "saved", { mode: sessionMode });
      return {
        ...s,
        selectedVerseId: verseId,
        activeSource: "saved",
        activeAttempt: {
          ...snapshot,
          reviewSessionId: sessionId,
          reviewSource: source,
          reviewPassageKey: passageKey,
          reviewPracticeLanguage: practiceLanguage,
          reviewQualifies: qualifiesAsReview,
          // Captured once, at the moment the session begins.
          wasDueAtStart: isDue(row.record, Date.now()),
          reviewFinalized: false,
        },
        activeReview: {
          schemaVersion: REVIEW_SCHEMA_VERSION,
          sessionId,
          passageKey,
          verseId,
          startedAt: toIso(Date.now()),
          source,
          wasDueAtStart: isDue(row.record, Date.now()),
          currentStage: "recall",
          practiceLanguage,
          qualifiesAsReview,
        },
        lastReviewCompletion: null,
      };
    });

    setActiveTab("memorize");
  };

  const getAnotherVerse = async () => {
    if (activeAttemptInProgress) {
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

        const snapshot = buildAttemptSnapshot(prev, newVerse, "extra");

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
          onChangeTranslation={changeActiveTranslation}
          onStartMemorizing={(id) => startMemorizing(id, state.activeSource)}
          onGetAnotherVerse={getAnotherVerse}
          onGoToSaved={() => handleSetActiveTab('saved')}
          onGoToPaths={(path) => handleGoToPaths(path)}
          onCompletePathDay={handleCompletePathDay}
          reviewNowMs={reviewNowMs}
          onOpenReview={() => handleSetActiveTab('review')}
        />
      );
      // Phase 4A: the Review screen is reached from the compact Home module.
      // It is deliberately NOT added to `navItems` — no permanent navigation
      // tab is introduced in this phase.
      case "review": return (
        <Review
          state={state}
          setState={setState}
          nowMs={reviewNowMs}
          onLaunchReview={startReview}
          onGoHome={() => handleSetActiveTab("home")}
          onRefresh={refreshReviewClock}
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
          onReviewFinalized={() => {
            // The review finalizer has already cleared activeAttempt and
            // activeReview in the same commit; the raw setter is used so the
            // challenge-in-progress guard cannot re-prompt on stale state.
            refreshReviewClock();
            setActiveTab("review");
          }}
          onGoToFlashcards={(verseId) => {
            setState(s => {
              let nextAttempt = s.activeAttempt;
              if (!nextAttempt || nextAttempt.verseId !== verseId) {
                const resolvedVerse = MOCK_VERSES.find(v => v.id === verseId) || 
                                      s.customVerses.find(v => v.id === verseId);
                if (resolvedVerse) {
                  nextAttempt = buildAttemptSnapshot(s, resolvedVerse, s.activeSource || "saved");
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
                // An explicit abandon ends the review session too. Merely
                // navigating away does not: the draft and the Step 5/6 state
                // both survive so the exact original passage resumes.
                activeReview: null,
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
          onRestartMemorization={(id) => startMemorizingBypassingCheck(id, state.activeSource)}
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
          onStartMemorizing={(id, src, reviewPair) => startMemorizing(id, src || "saved", reviewPair)}
          onGoToFlashcards={(verseId) => {
            // Phase 3C: the Saved "challenge: citation" affordance is unchanged,
            // but its destination is now Memorize Step 6. Latch citationStarted
            // so the attempt opens directly in the Citation Step rather than the
            // stage-6 handoff screen.
            setState(s => ({
              ...s,
              selectedVerseId: verseId,
              activeAttempt: s.activeAttempt && s.activeAttempt.verseId === verseId
                ? { ...s.activeAttempt, citationStarted: true }
                : s.activeAttempt,
            }));
            setActiveTab("memorize");
          }}
        />
      );
      default: return null;
    }
  };

  const renderContentInner = () => {
    if (authLoading) {
      return (
        <div className="min-h-screen-dynamic bg-midnight text-cool-white flex items-center justify-center">
          <Loader2 className="animate-spin text-royal-soft" size={40} />
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
    const isEs = state.primaryLanguage === 'es';
    const navItems: {
      id: string;
      domId: string;
      icon: BrandIconName;
      label: string;
      onClick: () => void;
    }[] = [
      { id: 'home', domId: 'nav-home', icon: 'ui-home', label: isEs ? 'Inicio' : 'Home', onClick: () => handleSetActiveTab('home') },
      { id: 'memorize', domId: 'nav-memorize', icon: 'ui-memorize', label: isEs ? 'Memorizar' : 'Memorize', onClick: () => handleSetActiveTab('memorize') },
      { id: 'flashcards', domId: 'nav-flashcards', icon: 'ui-cards', label: isEs ? 'Tarjetas' : 'Cards', onClick: () => handleSetActiveTab('flashcards') },
      { id: 'paths', domId: 'nav-paths', icon: 'ui-paths', label: isEs ? 'Series' : 'Paths', onClick: () => { setSelectedPath(null); setEditingPath(null); handleSetActiveTab('paths'); } },
      { id: 'saved', domId: 'nav-saved', icon: 'ui-saved', label: isEs ? 'Guardados' : 'Saved', onClick: () => handleSetActiveTab('saved') },
    ];
    const openSettings = () => {
      if (activeAttemptInProgress) {
        setPendingAttempt({ type: "navigate", destinationTab: "settings" });
        return;
      }
      setShowSettings(true);
    };
    const settingsLabel = isEs ? 'Ajustes' : 'Settings';

    return (
      <div className="verso-shell flex flex-col relative overflow-x-hidden">
        {/* Desktop left rail (>=1280): same five destinations, royal active state */}
        <nav className="verso-rail" aria-label={isEs ? 'Navegación principal' : 'Primary'}>
          <div className="verso-rail__brand">
            <VersoLogo size="sm" showText={true} />
          </div>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`verso-rail__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <BrandIcon name={item.icon} size={21} className="verso-rail__icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div style={{ marginTop: 'auto' }}>
            <button
              type="button"
              onClick={openSettings}
              className="verso-rail__item"
            >
              <BrandIcon name="ui-settings" size={21} className="verso-rail__icon" />
              <span>{settingsLabel}</span>
            </button>
          </div>
        </nav>

        <header className="verso-header">
          <div className="verso-frame py-6 flex justify-between items-center">
            <div className="flex items-center gap-3 xl:hidden">
              <VersoLogo size="md" showText={true} />
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <IconButton
                id="nav-settings"
                label={settingsLabel}
                onClick={openSettings}
                icon={<BrandIcon name="ui-settings" size={20} />}
              />
            </div>
          </div>
        </header>

        <main className="verso-main flex-1 flex flex-col pt-4 sm:pt-6">
          <div className="verso-frame flex-1">
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

        {/* Mobile (<768) full-width bar / tablet (768–1279) centered pill */}
        <nav className="verso-bottomnav" aria-label={isEs ? 'Navegación principal' : 'Primary'}>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <NavButton
                key={item.id}
                id={item.domId}
                active={active}
                onClick={item.onClick}
                iconName={item.icon}
                label={item.label}
              />
            );
          })}
        </nav>

        <AnimatePresence>
          {showSettings && (
            <Settings state={state} setState={setState} onChangeTranslation={changeActiveTranslation} onClose={() => setShowSettings(false)} onShowTour={() => { setShowSettings(false); setShowTour(true); }} />
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
                        // Phase 3C: every in-progress stage, including stage 6
                        // Citation, continues inside Memorize.
                        setActiveTab("memorize");
                      }
                    }}
                    className="w-full h-14 bg-teal text-white hover:bg-teal-600 rounded-3xl font-black uppercase tracking-widest text-xs transition-colors shadow-md shadow-teal/10"
                  >
                    {state.primaryLanguage === 'es' ? "continuar reto actual" : "continue current challenge"}
                  </button>
                  <button
                    onClick={() => {
                      const nextAction = pendingAttempt;
                      const quitVerseId = state.activeAttempt?.verseId;
                      setPendingAttempt(null);

                      if (quitVerseId) {
                        localStorage.removeItem(`citation_failed_${quitVerseId}`);
                      }

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
                          // Quitting is an explicit exit, so any review session
                          // riding this attempt ends with it.
                          activeReview: null,
                          progress: nextProgress
                        };
                      });

                      // Trigger pending action using the updated / cleared state
                      setTimeout(() => {
                        if (nextAction?.type === "start" && nextAction.verseId) {
                          startMemorizingBypassingCheck(nextAction.verseId, nextAction.source || "daily", nextAction.reviewPair);
                        } else if (nextAction?.type === "another") {
                          getAnotherVerseBypassingCheck();
                        } else if (nextAction?.type === "navigate") {
                          if (nextAction.destinationTab === "settings") {
                            // Settings is an overlay and does not change the tab, so the
                            // Memorize/Flashcards deck would stay mounted with its stale
                            // Step 2/3 local state and could rewrite verseStages, letting
                            // the restore effects recreate the attempt we just quit. Move
                            // off the live deck first (raw setter, no guard re-prompt) so
                            // it unmounts before opening Settings.
                            setActiveTab("home");
                            setShowSettings(true);
                          } else if (nextAction.destinationTab) {
                            setActiveTab(nextAction.destinationTab);
                          }
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
      <div className="min-h-screen-dynamic bg-midnight text-cool-white flex flex-col items-center justify-center text-center p-8 space-y-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "var(--glass-fill)", border: "1px solid var(--rim-royal)" }}>
          <RotateCcw size={40} className="text-royal-soft" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif text-cool-white">Error</h2>
          <p className="text-cold-grey max-w-xs mx-auto">Please restart the app.</p>
        </div>
        <button type="button" onClick={() => { localStorage.clear(); window.location.reload(); }} className="vbtn vbtn--primary">Reset App</button>
      </div>
    }>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function NavButton({ id, active, onClick, iconName, label }: { id: string, active: boolean, onClick: () => void, iconName: BrandIconName, label: string }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`verso-tab${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="verso-tab__halo">
        <BrandIcon name={iconName} size={21} className="verso-tab__icon" />
      </span>
      <span>{label}</span>
    </button>
  );
}
