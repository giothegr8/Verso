import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ACTIVE_ATTEMPT_SCHEMA_VERSION,
  ActiveAttemptSnapshot,
  AppState,
  MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
  MemorizeLanguage,
  TRANSLATION_PAIRS,
  TRANSLATION_DETAILS,
  Verse
} from "../types";
import { loadVerseAndMerge } from "../services/bibleService";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Trophy, Sparkles, AlertCircle, Bookmark, Layers, BookOpen, Loader2 } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, removeAccents } from "../utils/verseUtils";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
  onAbandon?: () => void;
  tourStepId?: string | null;
}

const STAGES = [
  { id: 1, label: "Reading", es: "Lectura" },
  { id: 2, label: "", es: "" }, 
  { id: 3, label: "", es: "" }, 
  { id: 4, label: "Recall", es: "Recuerdo" },
  { id: 5, label: "Typing", es: "Escritura" },
];

type MemorizeTypingStateV2 = {
  schemaVersion: number;
  attemptId: string;
  currentPassIndex: number;
  currentStep: number;
  showHalfwayTransition: boolean;
  userInputEs: string[];
  userInputEn: string[];
  cursorIndexEs: number;
  cursorIndexEn: number;
  clueCountEs: number;
  clueCountEn: number;
  revealedIndicesEs: number[];
  revealedIndicesEn: number[];
  isWrongEs: boolean;
  isWrongEn: boolean;
  hasSubmittedEs: boolean;
  hasSubmittedEn: boolean;
  incorrectIndicesEs: number[];
  incorrectIndicesEn: number[];
  submittedWrongCharsEs: Record<number, string>;
  submittedWrongCharsEn: Record<number, string>;
  isCorrectEs: boolean;
  isCorrectEn: boolean;
  didFailFlowEs: boolean;
  didFailFlowEn: boolean;
};

const getExpectedLanguageOrder = (
  mode: AppState["memorizeMode"],
  uiLanguage: AppState["primaryLanguage"]
): MemorizeLanguage[] => {
  if (mode === "both") return uiLanguage === "en" ? ["en", "es"] : ["es", "en"];
  return [mode];
};

const sameLanguageOrder = (a?: MemorizeLanguage[], b?: MemorizeLanguage[]) => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((lang, idx) => lang === b[idx]);
};

const clampPassIndex = (idx: number, order: MemorizeLanguage[]) => {
  if (!Number.isInteger(idx) || idx < 0) return 0;
  return Math.min(idx, Math.max(order.length - 1, 0));
};

const getAttemptVerseContentKey = (attempt: ActiveAttemptSnapshot) => {
  return JSON.stringify({
    verseId: attempt.verse.id,
    book: attempt.verse.book,
    chapter: attempt.verse.chapter,
    verse: attempt.verse.verse,
    preferredTranslation: attempt.verse.preferredTranslation || "",
    source: attempt.verse.source || "",
    esTranslation: attempt.translations.es,
    enTranslation: attempt.translations.en,
    esText: attempt.verse.text?.es?.[attempt.translations.es] || "",
    enText: attempt.verse.text?.en?.[attempt.translations.en] || ""
  });
};

const getVerseContentKey = (verse: Verse, translations: AppState["selectedTranslations"]) => {
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

const getContextKey = (
  state: AppState,
  source: AppState["activeSource"],
  verse: Verse,
  reference: string
) => {
  const pathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId || "";
  const pathDay = source === "path"
    ? state.pathProgress.selectedPathId
      ? state.pathProgress.currentDay
      : state.customPathProgress.selectedPathId
        ? state.customPathProgress.currentDay
        : ""
    : "";
  return JSON.stringify({
    source,
    verseId: verse.id,
    reference,
    pathId: source === "path" ? pathId : "",
    pathDay,
    dailyDate: source === "daily" ? (state.lastVotdDate || getLocalDateString()) : "",
    customId: source === "custom" ? verse.id : "",
    savedId: source === "saved" ? verse.id : ""
  });
};

const buildMemorizeAttemptSnapshot = (state: AppState, verse: Verse): ActiveAttemptSnapshot => {
  const source = state.activeSource || "saved";
  const reference = `${verse.book} ${verse.chapter}:${verse.verse}`;
  const languageOrder = getExpectedLanguageOrder(state.memorizeMode, state.primaryLanguage);
  return {
    schemaVersion: ACTIVE_ATTEMPT_SCHEMA_VERSION,
    attemptId: createAttemptId(),
    verseId: verse.id,
    reference,
    translations: { ...state.selectedTranslations },
    memorizeMode: state.memorizeMode,
    verse,
    source,
    pathId: state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId,
    pathDay: source === "path"
      ? state.pathProgress.selectedPathId
        ? state.pathProgress.currentDay
        : state.customPathProgress.currentDay
      : null,
    dayReference: source === "path" ? reference : null,
    uiLanguage: state.primaryLanguage,
    languageOrder,
    currentPassIndex: 0,
    completedLanguages: languageOrder.reduce<Partial<Record<MemorizeLanguage, boolean>>>((acc, lang) => {
      acc[lang] = false;
      return acc;
    }, {}),
    cardsReady: false,
    textComplete: false,
    contextKey: getContextKey(state, source, verse, reference),
    verseContentKey: getVerseContentKey(verse, state.selectedTranslations),
  };
};

const isValidMemorizeAttempt = (
  attempt: ActiveAttemptSnapshot | null | undefined,
  verseId?: string
): attempt is ActiveAttemptSnapshot => {
  if (!attempt || attempt.schemaVersion !== ACTIVE_ATTEMPT_SCHEMA_VERSION) return false;
  if (!attempt.attemptId || typeof attempt.attemptId !== "string") return false;
  if (verseId && attempt.verseId !== verseId) return false;
  if (!attempt.verse || attempt.verseId !== attempt.verse.id) return false;
  if (attempt.uiLanguage !== "es" && attempt.uiLanguage !== "en") return false;
  if (!attempt.translations?.es || !attempt.translations?.en) return false;
  if (!attempt.contextKey || !attempt.verseContentKey) return false;

  const expectedOrder = getExpectedLanguageOrder(attempt.memorizeMode, attempt.uiLanguage);
  if (!sameLanguageOrder(attempt.languageOrder, expectedOrder)) return false;
  if (attempt.verseContentKey !== getAttemptVerseContentKey(attempt)) return false;

  const passIndex = attempt.currentPassIndex ?? 0;
  return Number.isInteger(passIndex) && passIndex >= 0 && passIndex < expectedOrder.length;
};

const isValidTypingState = (
  raw: any,
  attemptId: string | null,
  order: MemorizeLanguage[]
): raw is MemorizeTypingStateV2 => {
  if (!attemptId || !raw || typeof raw !== "object") return false;
  if (raw.schemaVersion !== MEMORIZE_TYPING_STATE_SCHEMA_VERSION) return false;
  if (raw.attemptId !== attemptId) return false;
  if (!Number.isInteger(raw.currentStep) || raw.currentStep < 1 || raw.currentStep > 5) return false;
  if (!Number.isInteger(raw.currentPassIndex) || raw.currentPassIndex < 0 || raw.currentPassIndex >= order.length) return false;
  return true;
};

export default function Memorize({ state, setState, onComplete, onGoToFlashcards, onAbandon, tourStepId }: MemorizeProps) {
  const today = getLocalDateString();
  const votd = getVerseByDate(today);
  
  // Path Logic for Fallback 
  const currentPathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId;
  const isCustomPath = !!state.customPaths.find(p => p.id === currentPathId);
  const selectedPath = isCustomPath 
    ? state.customPaths.find(p => p.id === currentPathId)
    : (state.pathProgress.selectedPathId ? (MOCK_VERSES.length > 0 ? null : null) : null); // We don't have PATHS available here easily, so we rely on AppState or similar

  // Helper to resolve the correct verse
  const getResolvedVerse = (): Verse => {
    // 0. Use the locked active attempt snapshot if present
    if (isValidMemorizeAttempt(state.activeAttempt) && state.activeAttempt.verse) {
      return state.activeAttempt.verse;
    }

    // 1. If explicitly custom
    if (state.activeSource === "custom" && state.selectedCustomVerse) {
      return state.selectedCustomVerse;
    }
    
    // 2. If explicit verse ID selected
    if (state.selectedVerseId) {
      const fromMock = MOCK_VERSES.find(v => v.id === state.selectedVerseId);
      const fromCustomList = state.customVerses.find(v => v.id === state.selectedVerseId);
      if (fromMock) return fromMock;
      if (fromCustomList) return fromCustomList;
      
      // Check in custom paths
      for (const p of state.customPaths) {
        const vData = p.verses.find(v => v.id === state.selectedVerseId);
        if (vData) {
          return {
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
        }
      }
    }
    
    // 3. Fallback for Path source
    if (state.activeSource === "path") {
      // In Memorize, we can't easily recalculate activePathVerse without access to all constants.
      // But App.tsx should have set state optimally.
      // If we are here and no ID is set, it means we are in a 'Path' flow.
      // We'll rely on the VOTD if all else fails, but ideally Home passed the ID or it's resolved.
    }

    return votd;
  };

  const verse = getResolvedVerse();
  const activeAttempt = isValidMemorizeAttempt(state.activeAttempt, verse.id) ? state.activeAttempt : null;
  const attemptLanguageOrder = activeAttempt?.languageOrder && activeAttempt.languageOrder.length > 0
    ? activeAttempt.languageOrder
    : getExpectedLanguageOrder(state.memorizeMode, state.primaryLanguage);
  const attemptId = activeAttempt?.attemptId || null;
  const typingStateKey = attemptId ? `memorize_typing_state_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}` : null;

  const savedTypingState = useMemo(() => {
    if (!typingStateKey) return null;
    try {
      const stored = localStorage.getItem(typingStateKey);
      const parsed = stored ? JSON.parse(stored) : null;
      return isValidTypingState(parsed, attemptId, attemptLanguageOrder) ? parsed : null;
    } catch {
      return null;
    }
  }, [typingStateKey, attemptId, attemptLanguageOrder]);

  // Load missing verse text automatically on the fly
  useEffect(() => {
    if (!verse) return;
    
    const activePair = getCurrentTranslationPair(state);
    const mode = state.memorizeMode;
    
    let needsEs = false;
    let needsEn = false;
    
    if (mode === "es" || mode === "both") {
      const txt = verse.text.es[activePair.es];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEs = true;
      }
    }
    
    if (mode === "en" || mode === "both") {
      const txt = verse.text.en[activePair.en];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEn = true;
      }
    }
    
    if (needsEs || needsEn) {
      const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
      loadVerseAndMerge(ref, verse.id, state, setState);
    }
  }, [
    verse?.id,
    state.memorizeMode,
    state.selectedTranslations?.es,
    state.selectedTranslations?.en,
    state.activeSource
  ]);

  const globalVerseStage = state.progress.verseStages[verse.id] || 1;
  const [stage, setStage] = useState(() => Math.min(5, savedTypingState?.currentStep || globalVerseStage));
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(() => {
    try {
      const failed = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
      return (globalVerseStage === 6 && activeAttempt?.cardsReady === true) || failed;
    } catch {
      return globalVerseStage === 6 && activeAttempt?.cardsReady === true;
    }
  });
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [coachType, setCoachType] = useState<'encouragement' | 'suggestion' | 'tip'>('encouragement');
  const activePair = getCurrentTranslationPair(state);

  const attemptsKeyEs = attemptId ? `memorize_attempts_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}_es_${activePair?.es || 'RVR1960'}` : null;
  const attemptsKeyEn = attemptId ? `memorize_attempts_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}_en_${activePair?.en || 'KJV'}` : null;

  const [attemptsEs, setAttemptsEs] = useState(() => {
    if (!attemptsKeyEs) return 0;
    const stored = localStorage.getItem(attemptsKeyEs);
    return stored ? parseInt(stored) : 0;
  });
  const [attemptsEn, setAttemptsEn] = useState(() => {
    if (!attemptsKeyEn) return 0;
    const stored = localStorage.getItem(attemptsKeyEn);
    return stored ? parseInt(stored) : 0;
  });

  // Persist attempts to localStorage
  useEffect(() => {
    if (!attemptsKeyEs) return;
    localStorage.setItem(attemptsKeyEs, attemptsEs.toString());
  }, [attemptsEs, attemptsKeyEs]);

  useEffect(() => {
    if (!attemptsKeyEn) return;
    localStorage.setItem(attemptsKeyEn, attemptsEn.toString());
  }, [attemptsEn, attemptsKeyEn]);

  const [userInputEs, setUserInputEs] = useState<string[]>(() => savedTypingState?.userInputEs || []);
  const [userInputEn, setUserInputEn] = useState<string[]>(() => savedTypingState?.userInputEn || []);
  const [cursorIndexEs, setCursorIndexEs] = useState(() => savedTypingState?.cursorIndexEs || 0);
  const [cursorIndexEn, setCursorIndexEn] = useState(() => savedTypingState?.cursorIndexEn || 0);
  // Latest-value cursor refs for the synchronous event stream. Rapid keystrokes
  // and arrow presses can fire before React re-renders, so render-scope closures
  // go stale; every cursor write goes through the Live setters below so the ref
  // always carries the newest position and no event can act on an older one.
  const cursorIndexEsRef = useRef(savedTypingState?.cursorIndexEs || 0);
  const cursorIndexEnRef = useRef(savedTypingState?.cursorIndexEn || 0);
  const setCursorIndexEsLive = (v: number) => {
    cursorIndexEsRef.current = v;
    setCursorIndexEs(v);
  };
  const setCursorIndexEnLive = (v: number) => {
    cursorIndexEnRef.current = v;
    setCursorIndexEn(v);
  };
  const [clueCountEs, setClueCountEs] = useState(() => savedTypingState?.clueCountEs || 0);
  const [clueCountEn, setClueCountEn] = useState(() => savedTypingState?.clueCountEn || 0);
  const [revealedIndicesEs, setRevealedIndicesEs] = useState<number[]>(() => savedTypingState?.revealedIndicesEs || []);
  const [revealedIndicesEn, setRevealedIndicesEn] = useState<number[]>(() => savedTypingState?.revealedIndicesEn || []);
  const [isWrongEs, setIsWrongEs] = useState(() => savedTypingState?.isWrongEs || false);
  const [isWrongEn, setIsWrongEn] = useState(() => savedTypingState?.isWrongEn || false);
  const [hasSubmittedEs, setHasSubmittedEs] = useState(() => savedTypingState?.hasSubmittedEs || false);
  const [hasSubmittedEn, setHasSubmittedEn] = useState(() => savedTypingState?.hasSubmittedEn || false);
  const [incorrectIndicesEs, setIncorrectIndicesEs] = useState<number[]>(() => savedTypingState?.incorrectIndicesEs || []);
  const [incorrectIndicesEn, setIncorrectIndicesEn] = useState<number[]>(() => savedTypingState?.incorrectIndicesEn || []);
  const [submittedWrongCharsEs, setSubmittedWrongCharsEs] = useState<Record<number, string>>(() => savedTypingState?.submittedWrongCharsEs || {});
  const [submittedWrongCharsEn, setSubmittedWrongCharsEn] = useState<Record<number, string>>(() => savedTypingState?.submittedWrongCharsEn || {});
  const [isCorrectEs, setIsCorrectEs] = useState(() => savedTypingState?.isCorrectEs || false);
  const [isCorrectEn, setIsCorrectEn] = useState(() => savedTypingState?.isCorrectEn || false);
  const [didFailFlowEs, setDidFailFlowEs] = useState(() => savedTypingState?.didFailFlowEs || false);
  const [didFailFlowEn, setDidFailFlowEn] = useState(() => savedTypingState?.didFailFlowEn || false);
  const [sessionFailed, setSessionFailed] = useState(() => {
    try {
      return localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    } catch {
      return false;
    }
  });
  const languageOrderKey = attemptLanguageOrder.join("|");
  const initialCurrentPassIndex = clampPassIndex(
    savedTypingState?.currentPassIndex ?? activeAttempt?.currentPassIndex ?? 0,
    attemptLanguageOrder
  );
  const shouldResumeHalfwayTransition =
    state.memorizeMode === "both" &&
    !!activeAttempt &&
    initialCurrentPassIndex < attemptLanguageOrder.length - 1 &&
    activeAttempt.completedLanguages?.[attemptLanguageOrder[initialCurrentPassIndex]] === true &&
    activeAttempt.cardsReady !== true;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showHalfwayTransition, setShowHalfwayTransition] = useState(() =>
    !!savedTypingState?.showHalfwayTransition || shouldResumeHalfwayTransition
  );
  const [currentPassIndex, setCurrentPassIndexState] = useState(() => initialCurrentPassIndex);
  const activeLanguage = attemptLanguageOrder[currentPassIndex] || attemptLanguageOrder[0] || "es";
  const bilingualPass = currentPassIndex + 1;
  const setCurrentPassIndex = (idx: number) => {
    setCurrentPassIndexState(clampPassIndex(idx, attemptLanguageOrder));
  };
  const setBilingualPass = (pass: number) => {
    setCurrentPassIndex(pass - 1);
  };
  const setActiveLanguage = (lang: MemorizeLanguage) => {
    const nextIndex = attemptLanguageOrder.indexOf(lang);
    setCurrentPassIndex(nextIndex === -1 ? 0 : nextIndex);
  };

  useEffect(() => {
    setCurrentPassIndexState(prev => clampPassIndex(prev, attemptLanguageOrder));
  }, [attemptId, languageOrderKey]);

  useEffect(() => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      if (s.activeAttempt.currentPassIndex === currentPassIndex) return s;
      return {
        ...s,
        activeAttempt: {
          ...s.activeAttempt,
          currentPassIndex,
        },
      };
    });
  }, [attemptId, currentPassIndex, setState]);

  const celebratedHalfwayRef = useRef<string>("");
  const celebratedAlmostDoneRef = useRef<string>("");

  // Refs and helper to always hold the latest state values for non-reactive access in debounced save
  const stateRef = useRef({
    schemaVersion: MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
    attemptId: attemptId || "",
    currentPassIndex,
    currentStep: stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    hasSubmittedEs,
    hasSubmittedEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
  });

  // Keep stateRef up to date on every render
  stateRef.current = {
    schemaVersion: MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
    attemptId: attemptId || "",
    currentPassIndex,
    currentStep: stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    hasSubmittedEs,
    hasSubmittedEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
  };

  const saveStateImmediately = () => {
    if (!typingStateKey || !attemptId) return;
    try {
      localStorage.setItem(typingStateKey, JSON.stringify(stateRef.current));
    } catch (e) {
      console.warn("Failed to save typing state", e);
    }
  };

  // 1. Debounced save for the hot path (typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveStateImmediately();
    }, 800); // 800ms debounce
    return () => clearTimeout(timer);
  }, [
    typingStateKey,
    attemptId,
    currentPassIndex,
    stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
  ]);

  // 2. Instantly save state on checkpoints, or on unmount
  useEffect(() => {
    saveStateImmediately();
  }, [
    stage,
    currentPassIndex,
    typingStateKey,
    attemptId,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
    hasSubmittedEs,
    hasSubmittedEn,
    showHalfwayTransition,
  ]);

  useEffect(() => {
    return () => {
      saveStateImmediately();
    };
  }, [typingStateKey]);

  const attempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
  const isWrong = activeLanguage === 'es' ? isWrongEs : isWrongEn;
  const hasSubmitted = activeLanguage === 'es' ? hasSubmittedEs : hasSubmittedEn;
  const isCorrect = activeLanguage === 'es' ? isCorrectEs : isCorrectEn;
  const didFailFlow = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;

  const isEsDone = isCorrectEs || didFailFlowEs;
  const isEnDone = isCorrectEn || didFailFlowEn;
  const isStepComplete = state.memorizeMode === 'both' ? (isEsDone && isEnDone) : (state.memorizeMode === 'es' ? isEsDone : isEnDone);
  
  const isOverallSuccess = state.memorizeMode === 'both' 
    ? (isCorrectEs && isCorrectEn) 
    : (state.memorizeMode === 'es' ? isCorrectEs : isCorrectEn);

  const isAnyPartFailed = (state.memorizeMode === 'both'
    ? (didFailFlowEs || didFailFlowEn)
    : (state.memorizeMode === 'es' ? didFailFlowEs : didFailFlowEn)) || sessionFailed;

  const activeClueCount = activeLanguage === 'es' ? clueCountEs : clueCountEn;
  const activeAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
  const activeDidFailFlow = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
  const activeIsCorrect = activeLanguage === 'es' ? isCorrectEs : isCorrectEn;

  const canShowClue =
    stage === 5 &&
    !isRevealed &&
    !activeIsCorrect &&
    !activeDidFailFlow &&
    activeAttempts < 3;

  const canUseClue =
    canShowClue &&
    activeClueCount < 1;

  const updateAttemptCompletion = (
    lang: MemorizeLanguage,
    options?: { cardsReady?: boolean; passIndex?: number }
  ) => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      const completedLanguages = {
        ...(s.activeAttempt.completedLanguages || {}),
        [lang]: true,
      };
      return {
        ...s,
        activeAttempt: {
          ...s.activeAttempt,
          completedLanguages,
          currentPassIndex: options?.passIndex ?? currentPassIndex,
          cardsReady: options?.cardsReady ? true : s.activeAttempt.cardsReady,
          textComplete: options?.cardsReady ? true : s.activeAttempt.textComplete,
        },
      };
    });
  };
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const mainActionRef = useRef<HTMLButtonElement>(null);
  const halfwayContinueRef = useRef<HTMLButtonElement>(null);
  const challengeCitationRef = useRef<HTMLButtonElement>(null);
  const isInputComposingRef = useRef(false);
  
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const cleanCacheRef = useRef<Record<string, string>>({});
  const getCleanLetters = (text: string | null | undefined) => {
    if (!text) return "";
    if (cleanCacheRef.current[text] !== undefined) {
      return cleanCacheRef.current[text];
    }
    const clean = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, "");
    if (Object.keys(cleanCacheRef.current).length > 200) {
      cleanCacheRef.current = {};
    }
    cleanCacheRef.current[text] = clean;
    return clean;
  };

  const { esText, enText, esError, enError, activePair: validatedPair } = getValidatedVerse(verse, state);
  const esTransToUse = validatedPair?.es || (state.selectedTranslations?.es || "RVR1960");
  const enTransToUse = validatedPair?.en || (state.selectedTranslations?.en || "KJV");
  const isEsLoading = !!(verse && state.loadingTranslations && state.loadingTranslations[`${verse.id}_${esTransToUse}`]);
  const isEnLoading = !!(verse && state.loadingTranslations && state.loadingTranslations[`${verse.id}_${enTransToUse}`]);

  const esTextCleanLen = useMemo(() => {
    return getCleanLetters(esText).length;
  }, [esText]);

  const enTextCleanLen = useMemo(() => {
    return getCleanLetters(enText).length;
  }, [enText]);

  const isEditable = (idx: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return false;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    const revealedIndices = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    return idx >= 0 && idx < cleanLen && !revealedIndices.includes(idx);
  };

  const isValidCursorIndex = (p: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return false;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    if (p < 0 || p > cleanLen) return false;
    
    // Position is valid if we can stand before an editable letter at p
    if (p < cleanLen && isEditable(p, lang)) return true;
    
    // Position is valid if we can stand after an editable letter at p - 1
    if (p - 1 >= 0 && isEditable(p - 1, lang)) return true;
    
    return false;
  };

  const findPreviousEditableIndex = (cursorPosition: number, lang: 'es' | 'en') => {
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (isEditable(i, lang)) {
        return i;
      }
    }
    return -1;
  };

  const findNextEditableIndex = (cursorPosition: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return -1;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    for (let i = cursorPosition; i < cleanLen; i++) {
      if (isEditable(i, lang)) {
        return i;
      }
    }
    return -1;
  };

  const getNearestCursorIndex = (p: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return 0;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    p = Math.max(0, Math.min(p, cleanLen));
    
    if (isValidCursorIndex(p, lang)) return p;
    
    let dist = 1;
    while (p - dist >= 0 || p + dist <= cleanLen) {
      if (p + dist <= cleanLen && isValidCursorIndex(p + dist, lang)) return p + dist;
      if (p - dist >= 0 && isValidCursorIndex(p - dist, lang)) return p - dist;
      dist++;
    }
    return 0;
  };

  const getNearestEditable = (idx: number, lang: 'es' | 'en') => {
    return getNearestCursorIndex(idx, lang);
  };

  interface WordGroup {
    wordIndex: number;
    wordText: string;
    cleanStartIndex: number;
    cleanEndIndex: number;
    editableIndices: number[];
  }

  const getWordGroups = (text: string | null | undefined, lang: 'es' | 'en'): WordGroup[] => {
    if (!text) return [];
    const words = text.split(" ");
    const groups: WordGroup[] = [];
    let cleanLetterAccumulator = 0;
    
    words.forEach((word, wordIndex) => {
      const wordStartIdx = cleanLetterAccumulator;
      const cleanWordLen = getCleanLetters(word).length;
      const cleanEndIdx = wordStartIdx + cleanWordLen;
      
      const editableIndices: number[] = [];
      for (let i = wordStartIdx; i < cleanEndIdx; i++) {
        if (isEditable(i, lang)) {
          editableIndices.push(i);
        }
      }
      
      groups.push({
        wordIndex,
        wordText: word,
        cleanStartIndex: wordStartIdx,
        cleanEndIndex: cleanEndIdx,
        editableIndices,
      });
      
      cleanLetterAccumulator += cleanWordLen;
    });
    
    return groups;
  };

  const findCurrentWordGroupIndex = (cursorIndex: number, groups: WordGroup[]): number => {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (cursorIndex >= g.cleanStartIndex && cursorIndex <= g.cleanEndIndex) {
        return i;
      }
    }
    return -1;
  };

  const findNextEditableWordStart = (cursorIndex: number, lang: 'es' | 'en'): number => {
    const text = lang === 'es' ? esText : enText;
    const groups = getWordGroups(text, lang);
    const currentGroupIdx = findCurrentWordGroupIndex(cursorIndex, groups);
    
    for (let i = currentGroupIdx + 1; i < groups.length; i++) {
      const g = groups[i];
      if (g.editableIndices.length > 0) {
        return g.editableIndices[0];
      }
    }
    return -1;
  };

  const findPreviousEditableWordStart = (cursorIndex: number, lang: 'es' | 'en'): number => {
    const text = lang === 'es' ? esText : enText;
    const groups = getWordGroups(text, lang);
    const currentGroupIdx = findCurrentWordGroupIndex(cursorIndex, groups);
    
    if (currentGroupIdx === -1) return -1;
    
    const currentGroup = groups[currentGroupIdx];
    const isAtStartOfWord = currentGroup.editableIndices.length > 0 && cursorIndex === currentGroup.editableIndices[0];
    const startIdx = isAtStartOfWord ? currentGroupIdx - 1 : currentGroupIdx;
    
    for (let i = startIdx; i >= 0; i--) {
      const g = groups[i];
      if (g.editableIndices.length > 0) {
        return g.editableIndices[0];
      }
    }
    return -1;
  };

  const processedEs = useMemo(() => {
    if (isRevealed) return esText;
    if (!esText) return "";
    const words = esText.split(" ");
    return words.map((word, idx) => {
      if (!word) return "";
      if (stage === 1) return word.length > 2 ? word.slice(0, 2) + word.slice(2).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_") : word;
      if (stage === 2) return idx % 2 === 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 3) return idx % 2 !== 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 4) return (word[0] || "") + word.slice(1).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 5) return word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      return word;
    }).join(" ");
  }, [esText, stage, isRevealed]);

  const processedEn = useMemo(() => {
    if (isRevealed) return enText;
    if (!enText) return "";
    const words = enText.split(" ");
    return words.map((word, idx) => {
      if (!word) return "";
      if (stage === 1) return word.length > 2 ? word.slice(0, 2) + word.slice(2).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_") : word;
      if (stage === 2) return idx % 2 === 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 3) return idx % 2 !== 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 4) return (word[0] || "") + word.slice(1).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      if (stage === 5) return word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      return word;
    }).join(" ");
  }, [enText, stage, isRevealed]);

  const lastConfigRef = useRef({
    selectedTranslationsEs: state.selectedTranslations.es,
    selectedTranslationsEn: state.selectedTranslations.en,
    memorizeMode: state.memorizeMode,
    verseId: verse.id,
    attemptId,
  });

  // Reset stage when verse, translations, or display mode changes
  useEffect(() => {
    const prevConfig = lastConfigRef.current;
    const contentConfigChanged =
      prevConfig.selectedTranslationsEs !== state.selectedTranslations.es ||
      prevConfig.selectedTranslationsEn !== state.selectedTranslations.en ||
      prevConfig.memorizeMode !== state.memorizeMode ||
      prevConfig.verseId !== verse.id;
    const attemptChanged = prevConfig.attemptId !== attemptId;

    if (contentConfigChanged || attemptChanged) {
      const dbStage = state.progress.verseStages[verse.id] || 1;
      const nextStage = activeAttempt
        ? Math.min(5, savedTypingState?.currentStep || dbStage)
        : 1;
      setStage(nextStage);
      setIsRevealed(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      if (activeAttempt) {
        setCurrentPassIndex(
          clampPassIndex(
            savedTypingState?.currentPassIndex ?? activeAttempt.currentPassIndex ?? 0,
            attemptLanguageOrder
          )
        );
        setShowHalfwayTransition(!!savedTypingState?.showHalfwayTransition || shouldResumeHalfwayTransition);
      } else {
        setCurrentPassIndex(0);
        setShowHalfwayTransition(false);
      }
      setIsAlmostDone(dbStage === 6 && activeAttempt?.cardsReady === true);
      
      // Preserve attempts if it's the same verse and translations
      if (prevConfig.verseId !== verse.id ||
          prevConfig.selectedTranslationsEs !== state.selectedTranslations.es ||
          prevConfig.selectedTranslationsEn !== state.selectedTranslations.en ||
          attemptChanged) {
        setAttemptsEs(0);
        setAttemptsEn(0);
      }
      
      setUserInputEs(savedTypingState?.userInputEs || []);
      setUserInputEn(savedTypingState?.userInputEn || []);
      setSubmittedWrongCharsEs(savedTypingState?.submittedWrongCharsEs || {});
      setSubmittedWrongCharsEn(savedTypingState?.submittedWrongCharsEn || {});
      setClueCountEs(savedTypingState?.clueCountEs || 0);
      setClueCountEn(savedTypingState?.clueCountEn || 0);
      setIsWrongEs(savedTypingState?.isWrongEs || false);
      setIsWrongEn(savedTypingState?.isWrongEn || false);
      setHasSubmittedEs(savedTypingState?.hasSubmittedEs || false);
      setHasSubmittedEn(savedTypingState?.hasSubmittedEn || false);
      setIncorrectIndicesEs(savedTypingState?.incorrectIndicesEs || []);
      setIncorrectIndicesEn(savedTypingState?.incorrectIndicesEn || []);
      setIsCorrectEs(savedTypingState?.isCorrectEs || false);
      setIsCorrectEn(savedTypingState?.isCorrectEn || false);
      setFeedback(null);
      setRevealedIndicesEs(savedTypingState?.revealedIndicesEs || []);
      setRevealedIndicesEn(savedTypingState?.revealedIndicesEn || []);
      setCursorIndexEsLive(savedTypingState?.cursorIndexEs || 0);
      setCursorIndexEnLive(savedTypingState?.cursorIndexEn || 0);
      
      lastConfigRef.current = {
        selectedTranslationsEs: state.selectedTranslations.es,
        selectedTranslationsEn: state.selectedTranslations.en,
        memorizeMode: state.memorizeMode,
        verseId: verse.id,
        attemptId,
      };
    }
  }, [verse.id, attemptId, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode, setState]);

  // Legacy/orphan transient stage state is not enough to reconstruct a safe
  // bilingual attempt. Preserve completed stage 7 records, but do not recreate an
  // active attempt without its v2 identity, language order, and completion state.
  // The cleanup is armed only after an attempt has been observed in this mounted
  // instance: restored progress is never cleared during the mount/hydration
  // cycle (a reload mid-attempt must always win), only on a genuine in-session
  // transition to an attempt-less state.
  const orphanCleanupArmedRef = useRef(false);
  useEffect(() => {
    if (state.activeAttempt) {
      orphanCleanupArmedRef.current = true;
      return;
    }
    if (!orphanCleanupArmedRef.current) return;
    const dbStage = state.progress.verseStages[verse.id];
    if (dbStage === undefined || dbStage < 2 || dbStage > 6) return;
    setState(s => {
      if (s.activeAttempt) return s;
      const liveStage = s.progress.verseStages[verse.id];
      if (liveStage === undefined || liveStage < 2 || liveStage > 6) return s;
      const nextStages = { ...s.progress.verseStages };
      delete nextStages[verse.id];
      return {
        ...s,
        progress: {
          ...s.progress,
          verseStages: nextStages,
        },
      };
    });
  }, [verse.id, state.activeAttempt, state.progress.verseStages, setState]);

  // Sync state with tour steps
  useEffect(() => {
    if (tourStepId === 'recall-challenge') {
      console.log("[Memorize Debug] Tour step 'recall-challenge' detected. Forcing Stage 5.");
      setStage(5);
      setIsRevealed(false);
      setHasSubmittedEs(false);
      setHasSubmittedEn(false);
      setIncorrectIndicesEs([]);
      setIncorrectIndicesEn([]);
      setSubmittedWrongCharsEs({});
      setSubmittedWrongCharsEn({});
      setIsCorrectEs(false);
      setIsCorrectEn(false);
    } else if (tourStepId === 'practice-mechanic' || tourStepId === 'nav-memorize-step') {
      console.log(`[Memorize Debug] Tour step '${tourStepId}' detected. Resetting to Stage 1.`);
      setStage(1);
      setIsRevealed(false);
    }
  }, [tourStepId]);

  // Sync input selection with cursorIndex
  useEffect(() => {
    if (stage === 5 && !isRevealed && !isAlmostDone && !isInputComposingRef.current && inputRef.current) {
      // For the stream-based input, we always want the cursor at the end (position 1 because value is " ")
      inputRef.current.setSelectionRange(1, 1);
    }
  }, [cursorIndexEs, cursorIndexEn, activeLanguage, stage, isRevealed, isAlmostDone]);

  // Initialize stage-specific content
  useEffect(() => {
    if (stage === 5) {
      if (esText && userInputEs.length === 0) {
        setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
      }
      if (enText && userInputEn.length === 0) {
        setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
      }
    }
  }, [stage, esText, enText, userInputEs.length, userInputEn.length]);

  // Focus management for Stage 5 typing
  useEffect(() => {
    // Allow focus if in stage 5, not revealed, and they haven't won or failed completely
    const canEdit = stage === 5 && !isRevealed && !isAlmostDone && !isCorrect && !didFailFlow;
    
    if (canEdit) {
      const focusInput = () => {
        if (inputRef.current && !isInputComposingRef.current) {
          inputRef.current.focus();
          // Keep selection at the end for detection
          inputRef.current.setSelectionRange(1, 1);
        }
      };
      
      // Initial focus
      focusInput();
      
      // Re-focus on window focus to ensure typing always works
      window.addEventListener('focus', focusInput);
      return () => window.removeEventListener('focus', focusInput);
    }
  }, [stage, isRevealed, isAlmostDone, isCorrect, didFailFlow, activeLanguage, clueCountEs, clueCountEn]);

  // Non-typing steps use the focused arrow button's native Enter activation.
  useEffect(() => {
    if (stage < 1 || stage >= 5 || isAlmostDone || showHalfwayTransition) return;
    const timer = window.setTimeout(() => {
      try {
        mainActionRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Main action focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [stage, isAlmostDone, showHalfwayTransition]);

  // Successful bilingual handoff uses the focused continue button's native Enter activation.
  useEffect(() => {
    const currentPassFailed = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
    if (!showHalfwayTransition || currentPassFailed) return;
    const timer = window.setTimeout(() => {
      try {
        halfwayContinueRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Halfway continue focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showHalfwayTransition, activeLanguage, didFailFlowEs, didFailFlowEn]);

  // Final bilingual completion handoff uses the focused citation button's native Enter activation.
  useEffect(() => {
    if (!isAlmostDone || state.memorizeMode !== 'both' || isAnyPartFailed) return;
    const timer = window.setTimeout(() => {
      try {
        challengeCitationRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Challenge citation focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAlmostDone, state.memorizeMode, isAnyPartFailed]);

  useEffect(() => {
    if (isAlmostDone && isOverallSuccess) {
      if (state.memorizeMode === 'both') {
        const halfwayKey = `second_${verse.id}_${activeLanguage}`;
        if (celebratedAlmostDoneRef.current !== halfwayKey) {
          celebratedAlmostDoneRef.current = halfwayKey;
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#E8B34B', '#F0C46E', '#8FA2FF'], // Ember gold + royal soft (earned)
            ticks: 200,
            gravity: 1.2
          });
        }
      } else {
        // Earned burst in the locked palette for single language mode complete
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;
        const colors = ['#E8B34B', '#F0C46E', '#8FA2FF', '#E7ECF2'];

        const frame = () => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) return;

          const particleCount = 10 * (timeLeft / duration);
          
          confetti({
            particleCount,
            startVelocity: 30,
            spread: 360,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: colors,
            shapes: ['circle'],
            gravity: 0.8,
            scalar: 0.7,
            drift: 0,
            ticks: 100
          });

          requestAnimationFrame(frame);
        };
        
        frame();
      }
    }
  }, [isAlmostDone, isOverallSuccess, state.memorizeMode, activeLanguage, verse.id]);

  useEffect(() => {
    const isFailedSession = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
    if (showHalfwayTransition && !isFailedSession) {
      const halfwayKey = `halfway_${verse.id}_${activeLanguage}`;
      if (celebratedHalfwayRef.current !== halfwayKey) {
        celebratedHalfwayRef.current = halfwayKey;
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E8B34B', '#F0C46E', '#8FA2FF'], // Ember gold + royal soft (earned)
          ticks: 200,
          gravity: 1.2
        });
      }
    }
  }, [showHalfwayTransition, activeLanguage, didFailFlowEs, didFailFlowEn, verse.id]);

  if (verse && ((state.memorizeMode === 'es' && isEsLoading) || (state.memorizeMode === 'en' && isEnLoading) || (state.memorizeMode === 'both' && (isEsLoading || isEnLoading)))) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <Loader2 className="animate-spin text-royal-soft" size={36} />
        <p className="font-hanken text-cold-grey text-sm font-medium">
          {state.primaryLanguage === 'es' ? 'Cargando traducción...' : 'Loading translation...'}
        </p>
      </div>
    );
  }

  if (!verse || (!esText && !enText)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[rgba(209,78,92,0.08)] border border-[rgba(209,78,92,0.40)] flex items-center justify-center">
          <AlertCircle size={32} className="text-[#F0A6A0]" />
        </div>
        <h3 className="text-xl font-fraunces font-medium text-cool-white">
          {state.primaryLanguage === 'es' ? 'Versículo no disponible' : 'Verse unavailable'}
        </h3>
        <div className="space-y-2">
          {esError && <p className="font-hanken text-[#F0A6A0] font-semibold text-sm">{esError}</p>}
          {enError && <p className="font-hanken text-[#F0A6A0] font-semibold text-sm">{enError}</p>}
        </div>
        <p className="font-hanken text-cold-grey max-w-xs pt-4">
          {state.primaryLanguage === 'es'
            ? 'Por favor selecciona una traducción diferente en los ajustes.'
            : 'Please select a different translation in settings.'}
        </p>
      </div>
    );
  }

  const nextStage = (forceFailed?: boolean) => {
    // Rotate coach type for variety
    const types: ('encouragement' | 'suggestion' | 'tip')[] = ['encouragement', 'suggestion', 'tip'];
    setCoachType(types[Math.floor(Math.random() * types.length)]);

    if (stage < 5) {
      const newStage = stage + 1;
      setStage(newStage);
      setIsRevealed(false);
      
      if (activeLanguage === 'es') {
        setDidFailFlowEs(false);
        setAttemptsEs(0);
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setIsCorrectEs(false);
        setRevealedIndicesEs([]);
        setCursorIndexEsLive(0);
      } else {
        setDidFailFlowEn(false);
        setAttemptsEn(0);
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setIsCorrectEn(false);
        setRevealedIndicesEn([]);
        setCursorIndexEnLive(0);
      }
      setFeedback(null);
      
      // Initialize slot buffers for Stage 5
      if (newStage === 5) {
        if (esText) setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
        if (enText) setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
      }

      setState(s => ({
        ...s,
        progress: {
          ...s.progress,
          verseStages: {
            ...s.progress.verseStages,
            [verse.id]: newStage
          }
        }
      }));
    } else {
      // Logic for moving past Stage 5
      if (state.memorizeMode === 'both' && currentPassIndex < attemptLanguageOrder.length - 1) {
        updateAttemptCompletion(activeLanguage, { cardsReady: false, passIndex: currentPassIndex });
        // Clear attempts for the language JUST finished
        if (activeLanguage === 'es') {
          if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        } else if (attemptsKeyEn) {
          localStorage.removeItem(attemptsKeyEn);
        }
        setShowHalfwayTransition(true);
      } else {
        // Clear attempts and typing state on level exit
        if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
        if (typingStateKey) localStorage.removeItem(typingStateKey);
        
        // Success Persistence Fix: Save verse when successfully completed
        const effectiveFailed = forceFailed !== undefined ? forceFailed : isAnyPartFailed;
        if (!effectiveFailed) {
          try {
            localStorage.setItem(`memorize_failed_${verse.id}`, "false");
          } catch (e) {
            console.error(e);
          }
          setState(s => {
            const completedLanguages = s.activeAttempt && s.activeAttempt.attemptId === attemptId
              ? {
                  ...(s.activeAttempt.completedLanguages || {}),
                  [activeLanguage]: true,
                }
              : { [activeLanguage]: true };
            const allRequiredComplete = attemptLanguageOrder.every(lang => completedLanguages[lang] === true);
            return {
              ...s,
              activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
                ? {
                    ...s.activeAttempt,
                    completedLanguages,
                    currentPassIndex,
                    cardsReady: allRequiredComplete,
                    textComplete: allRequiredComplete,
                  }
                : s.activeAttempt,
              savedVerses: allRequiredComplete && !s.savedVerses.includes(verse.id) ? [...s.savedVerses, verse.id] : s.savedVerses,
              progress: {
                ...s.progress,
                verseStages: {
                  ...s.progress.verseStages,
                  [verse.id]: allRequiredComplete ? 6 : (s.progress.verseStages[verse.id] || 1)
                }
              }
            };
          });
        } else {
          try {
            localStorage.setItem(`memorize_failed_${verse.id}`, "true");
          } catch (e) {
            console.error(e);
          }
        }
        setIsAlmostDone(true);
      }
    }
  };

  const handleHalfwayContinue = () => {
    const nextIndex = clampPassIndex(currentPassIndex + 1, attemptLanguageOrder);
    setCurrentPassIndex(nextIndex);
    setStage(1);
    setShowHalfwayTransition(false);
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    
    const nextLang = attemptLanguageOrder[nextIndex] || activeLanguage;
    setIsRevealed(false);
    
    // Only reset state for the coming language.
    // The language they just finished was completed successfully, so we must keep its states!
    if (nextLang === 'es') {
      setAttemptsEs(0);
      setUserInputEs([]);
      setSubmittedWrongCharsEs({});
      setClueCountEs(0);
      setIsWrongEs(false);
      setHasSubmittedEs(false);
      setIncorrectIndicesEs([]);
      setIsCorrectEs(false);
      setRevealedIndicesEs([]);
      setCursorIndexEsLive(0);
    } else {
      setAttemptsEn(0);
      setUserInputEn([]);
      setSubmittedWrongCharsEn({});
      setClueCountEn(0);
      setIsWrongEn(false);
      setHasSubmittedEn(false);
      setIncorrectIndicesEn([]);
      setIsCorrectEn(false);
      setRevealedIndicesEn([]);
      setCursorIndexEnLive(0);
    }
    setFeedback(null);
  };

  const prevStage = () => {
    // Anti-cheat: Disable going back on Stage 5
    if (stage > 1 && stage !== 5) {
      const newStage = stage - 1;
      setStage(newStage);
      setIsRevealed(false);
      setIsAlmostDone(false);
      setShowHalfwayTransition(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      // We don't reset attempts when going back/forward within the session
      // but standard transitions might expect it. 
      // Actually, we want persistence, so we only reset on truly new verse/reset()
      
      if (activeLanguage === 'es') {
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setCursorIndexEsLive(0);
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setIsCorrectEs(false);
        setRevealedIndicesEs([]);
      } else {
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setCursorIndexEnLive(0);
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setIsCorrectEn(false);
        setRevealedIndicesEn([]);
      }
      setFeedback(null);
      setState(s => ({
        ...s,
        progress: {
          ...s.progress,
          verseStages: {
            ...s.progress.verseStages,
            [verse.id]: newStage
          }
        }
      }));
    }
  };

  const reset = () => {
    // If we're in both-languages mode, check if we can perform a partial retry
    if (state.memorizeMode === 'both') {
      const enPassed = isCorrectEn && !didFailFlowEn;
      const esPassed = isCorrectEs && !didFailFlowEs;
      
      if (enPassed && !esPassed) {
        // English completed successfully, Spanish failed or incomplete. Only retry Spanish!
        if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setActiveLanguage('es');
        
        setDidFailFlowEs(false);
        setAttemptsEs(0);
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setFeedback(null);
        setRevealedIndicesEs([]);
        setCursorIndexEsLive(0);
        
        setState(s => ({
          ...s,
          activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
            ? {
                ...s.activeAttempt,
                completedLanguages: {
                  ...(s.activeAttempt.completedLanguages || {}),
                  en: true,
                  es: false,
                },
                currentPassIndex: attemptLanguageOrder.indexOf("es") === -1 ? 0 : attemptLanguageOrder.indexOf("es"),
                cardsReady: false,
                textComplete: false,
              }
            : s.activeAttempt,
          progress: {
            ...s.progress,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 1
            }
          }
        }));
        return;
      } else if (esPassed && !enPassed) {
        // Spanish completed successfully, English failed or incomplete. Only retry English!
        if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setActiveLanguage('en');
        
        setDidFailFlowEn(false);
        setAttemptsEn(0);
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setFeedback(null);
        setRevealedIndicesEn([]);
        setCursorIndexEnLive(0);
        
        setState(s => ({
          ...s,
          activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
            ? {
                ...s.activeAttempt,
                completedLanguages: {
                  ...(s.activeAttempt.completedLanguages || {}),
                  es: true,
                  en: false,
                },
                currentPassIndex: attemptLanguageOrder.indexOf("en") === -1 ? 0 : attemptLanguageOrder.indexOf("en"),
                cardsReady: false,
                textComplete: false,
              }
            : s.activeAttempt,
          progress: {
            ...s.progress,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 1
            }
          }
        }));
        return;
      }
    }

    // Clear attempts on intentional reset
    if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
    if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
    if (typingStateKey) localStorage.removeItem(typingStateKey);
    localStorage.removeItem(`memorize_failed_${verse.id}`);
    setSessionFailed(false);
    
    setStage(1);
    setIsRevealed(false);
    setIsAlmostDone(false);
    setShowHalfwayTransition(false);
    setBilingualPass(1);
    
    const initialLang = state.memorizeMode === 'en' ? 'en' : (state.memorizeMode === 'es' ? 'es' : state.primaryLanguage);
    setActiveLanguage(initialLang);
    
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    setAttemptsEs(0);
    setAttemptsEn(0);
    setUserInputEs([]);
    setUserInputEn([]);
    setSubmittedWrongCharsEs({});
    setSubmittedWrongCharsEn({});
    setClueCountEs(0);
    setClueCountEn(0);
    setIsWrongEs(false);
    setIsWrongEn(false);
    setHasSubmittedEs(false);
    setHasSubmittedEn(false);
    setIncorrectIndicesEs([]);
    setIncorrectIndicesEn([]);
    setIsCorrectEs(false);
    setIsCorrectEn(false);
    setFeedback(null);
    setRevealedIndicesEs([]);
    setRevealedIndicesEn([]);
    setState(s => ({
      ...s,
      activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
        ? {
            ...s.activeAttempt,
            currentPassIndex: 0,
            completedLanguages: attemptLanguageOrder.reduce<Partial<Record<MemorizeLanguage, boolean>>>((acc, lang) => {
              acc[lang] = false;
              return acc;
            }, {}),
            cardsReady: false,
            textComplete: false,
          }
        : s.activeAttempt,
      progress: {
        ...s.progress,
        verseStages: {
          ...s.progress.verseStages,
          [verse.id]: 1
        }
      }
    }));
  };

  const handleLanguageSwitch = (lang: 'es' | 'en') => {
    if (state.memorizeMode === 'both' && activeLanguage !== lang) {
      setActiveLanguage(lang);
      
      const targetText = lang === 'es' ? esText : enText;
      const targetCleanSize = getCleanLetters(targetText || "").length;
      const currentUserInput = lang === 'es' ? userInputEs : userInputEn;
      const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;

      // When clicking the container, try to find a sensible spot:
      // Either first empty editable, or just the current index for that language.
      // Actually, since we have cursorIndex per language, we just stick with it.
      // But we must ensure it's valid.
      const currentCursor = lang === 'es' ? cursorIndexEs : cursorIndexEn;
      if (currentCursor >= targetCleanSize) {
        // Find first empty
        let firstEmpty = 0;
        while (firstEmpty < targetCleanSize && (revealed.includes(firstEmpty) || currentUserInput[firstEmpty])) {
          firstEmpty++;
        }
        if (lang === 'es') setCursorIndexEsLive(Math.min(firstEmpty, targetCleanSize));
        else setCursorIndexEnLive(Math.min(firstEmpty, targetCleanSize));
      }
      
      // Immediate focus for mobile
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleClue = (lang: 'es' | 'en') => {
    const processClueForLang = (l: 'es' | 'en') => {
      const text = l === 'es' ? esText : enText;
      if (!text) return;

      const count = l === 'es' ? clueCountEs : clueCountEn;
      const setCount = l === 'es' ? setClueCountEs : setClueCountEn;
      const revealed = l === 'es' ? revealedIndicesEs : revealedIndicesEn;
      const setRevealed = l === 'es' ? setRevealedIndicesEs : setRevealedIndicesEn;

      if (stage === 5) {
        if (count >= 1) return;
        
        const newRevealed: number[] = [];
        let currentLetterIndex = 0;
        const lines = text.split("\n");
        const cleanTargetArr = getCleanLetters(text).split("");
        
        lines.forEach(line => {
          const words = line.split(" ");
          words.forEach(word => {
            const chars = word.split("");
            let wordHasLetter = false;
            chars.forEach(char => {
              const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(char);
              if (isLetter) {
                if (!wordHasLetter) {
                  newRevealed.push(currentLetterIndex);
                  wordHasLetter = true;
                }
                currentLetterIndex++;
              }
            });
          });
        });
        
        setRevealed(newRevealed);
        setCount(1);

        const setter = l === 'es' ? setUserInputEs : setUserInputEn;
        setter(prev => {
          const next = [...prev];
          newRevealed.forEach(idx => {
            next[idx] = cleanTargetArr[idx];
          });
          return next;
        });

        if (l === activeLanguage) {
          const setCursor = l === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
          const oldCursor = l === 'es' ? cursorIndexEs : cursorIndexEn;

          const tempRevealed = [...revealed, ...newRevealed];
          const isEditableWithTemp = (idx: number) => {
            if (idx < 0 || idx >= cleanTargetArr.length) return false;
            return !tempRevealed.includes(idx);
          };

          let finalCursor = oldCursor;
          if (!isEditableWithTemp(finalCursor)) {
            let foundNext = -1;
            for (let i = finalCursor + 1; i < cleanTargetArr.length; i++) {
              if (isEditableWithTemp(i)) {
                foundNext = i;
                break;
              }
            }
            if (foundNext !== -1) {
              finalCursor = foundNext;
            } else {
              let foundPrev = -1;
              for (let i = finalCursor - 1; i >= 0; i--) {
                if (isEditableWithTemp(i)) {
                  foundPrev = i;
                  break;
                }
              }
              if (foundPrev !== -1) {
                finalCursor = foundPrev;
              } else {
                finalCursor = 0;
              }
            }
          }
          setCursor(finalCursor);
        }
      } else {
        if (count >= 2) return;
        const cleanTarget = getCleanLetters(text);
        const unrevealedIndices: number[] = [];
        for (let i = 0; i < cleanTarget.length; i++) {
          if (!revealed.includes(i)) {
            unrevealedIndices.push(i);
          }
        }

        if (unrevealedIndices.length > 0) {
          const randomIdx = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
          setRevealed(prev => [...prev, randomIdx]);
          setCount(prev => prev + 1);
        }
      }
    };

    if (state.memorizeMode === 'both' && !isMobile) {
      processClueForLang('es');
      processClueForLang('en');
    } else {
      processClueForLang(lang);
    }

    if (stage === 5) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const getTypedTextFromInputValue = (value: string) => {
    return value.startsWith(" ") ? value.slice(1) : value;
  };

  const resetStreamInput = (input?: HTMLInputElement | null) => {
    if (input) {
      input.value = " ";
      try {
        input.setSelectionRange(1, 1);
      } catch {}
    }
  };

  const insertTypedText = (textToInsert: string) => {
    if (!textToInsert) return;

    const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
    const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
    const targetCleanLen = activeLanguage === 'es' ? esTextCleanLen : enTextCleanLen;
    const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
    const touchedIndices: number[] = [];
    let nextCursor = cursor;
    // Insertions are recorded by slot index and applied through a functional
    // update below, so rapid successive events compose instead of a later
    // event overwriting an earlier one through a stale array closure.
    const insertions: Record<number, string> = {};

    if (hasSubmitted) {
      if (activeLanguage === 'es') {
        setHasSubmittedEs(false);
        setIsWrongEs(false);
      } else {
        setHasSubmittedEn(false);
        setIsWrongEn(false);
      }
    }

    for (const char of Array.from(textToInsert)) {
      if (char.trim() === "") {
        const nextWordStart = findNextEditableWordStart(nextCursor, activeLanguage);
        if (nextWordStart !== -1) {
          nextCursor = nextWordStart;
        }
        continue;
      }

      if (nextCursor < targetCleanLen && isEditable(nextCursor, activeLanguage)) {
        insertions[nextCursor] = char;
        touchedIndices.push(nextCursor);

        let next = nextCursor + 1;
        while (next < targetCleanLen && !isEditable(next, activeLanguage)) {
          next++;
        }
        nextCursor = Math.min(next, targetCleanLen);
      }
    }

    if (touchedIndices.length > 0) {
      if (activeLanguage === 'es') {
        setSubmittedWrongCharsEs(prev => {
          const next = { ...prev };
          touchedIndices.forEach(idx => {
            delete next[idx];
          });
          return next;
        });
        setIncorrectIndicesEs(prev => prev.filter(idx => !touchedIndices.includes(idx)));
      } else {
        setSubmittedWrongCharsEn(prev => {
          const next = { ...prev };
          touchedIndices.forEach(idx => {
            delete next[idx];
          });
          return next;
        });
        setIncorrectIndicesEn(prev => prev.filter(idx => !touchedIndices.includes(idx)));
      }
      setter(prev => {
        const next = [...prev];
        touchedIndices.forEach(idx => {
          next[idx] = insertions[idx];
        });
        return next;
      });
    }

    setCursor(nextCursor);
  };

  const normalizeText = (text: string | null | undefined) => {
    if (!text) return "";
    return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
  };

  const handleCheck = () => {
    if (isCorrect) return;
    
    if (activeLanguage === 'es') setHasSubmittedEs(true);
    else setHasSubmittedEn(true);

    const targetText = activeLanguage === 'es' ? esText : enText;
    const targetClean = getCleanLetters(targetText || "").toLowerCase();
    const userInput = activeLanguage === 'es' ? userInputEs : userInputEn;
    const revealed = activeLanguage === 'es' ? revealedIndicesEs : revealedIndicesEn;

    if (targetClean.length === 0) return;
    
    const normalizedTarget = removeAccents(targetClean).toLowerCase();
    let isCurrentCorrect = true;
    let firstIncorrectIdx = -1;
    const currentIncorrectIndices: number[] = [];
    const wrongChars: Record<number, string> = {};
    
    for (let i = 0; i < normalizedTarget.length; i++) {
      if (!revealed.includes(i)) {
        const char = userInput[i] || "";
        const isCharEmpty = char.trim() === "";
        
        if (removeAccents(char.toLowerCase()) !== normalizedTarget[i]) {
          isCurrentCorrect = false;
          currentIncorrectIndices.push(i);
          if (firstIncorrectIdx === -1) {
            firstIncorrectIdx = i;
          }
          if (char && !isCharEmpty) {
            wrongChars[i] = char;
          }
        }
      }
    }
    
    if (isCurrentCorrect) {
      if (activeLanguage === 'es') {
        setIsCorrectEs(true);
        setIncorrectIndicesEs([]);
        setSubmittedWrongCharsEs({});
      } else {
        setIsCorrectEn(true);
        setIncorrectIndicesEn([]);
        setSubmittedWrongCharsEn({});
      }

      setFeedback(state.primaryLanguage === 'es' ? "¡Correcto!" : "Correct!");
      setTimeout(() => {
        nextStage();
      }, 1500);
    } else {
      const currentAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
      const nextAttempts = currentAttempts + 1;
      
      if (activeLanguage === 'es') {
        setAttemptsEs(nextAttempts);
        setIsWrongEs(true);
        setIncorrectIndicesEs(currentIncorrectIndices);
        setSubmittedWrongCharsEs(wrongChars);
        if (firstIncorrectIdx !== -1) {
          setCursorIndexEsLive(firstIncorrectIdx);
        }
        setTimeout(() => setIsWrongEs(false), 1500);
      } else {
        setAttemptsEn(nextAttempts);
        setIsWrongEn(true);
        setIncorrectIndicesEn(currentIncorrectIndices);
        setSubmittedWrongCharsEn(wrongChars);
        if (firstIncorrectIdx !== -1) {
          setCursorIndexEnLive(firstIncorrectIdx);
        }
        setTimeout(() => setIsWrongEn(false), 1500);
      }
      
      // Auto-focus input on failure so user can type immediately
      if (inputRef.current) {
        try {
          inputRef.current.focus({ preventScroll: true });
          inputRef.current.setSelectionRange(1, 1);
        } catch (e) {
          console.warn("Sync focus failed", e);
        }
      }
      setTimeout(() => {
        if (inputRef.current) {
          try {
            inputRef.current.focus({ preventScroll: true });
            inputRef.current.setSelectionRange(1, 1);
          } catch (e) {
            console.warn("Async focus failed", e);
          }
        }
      }, 30);

      if (nextAttempts >= 3) {
        if (activeLanguage === 'es') setDidFailFlowEs(true);
        else setDidFailFlowEn(true);
        setSessionFailed(true);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "true");
        } catch (e) {
          console.error(e);
        }

        setFeedback(state.primaryLanguage === 'es' ? "Se acabaron los intentos. Revelando texto..." : "Out of attempts. Revealing text...");
        setTimeout(() => {
          nextStage(true);
        }, 2000);
      } else {
        const remaining = 3 - nextAttempts;
        setFeedback(state.primaryLanguage === 'es' 
          ? `Todavía no. Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'}.` 
          : `Not quite. You have ${remaining} tr${remaining === 1 ? 'y' : 'ies'} left.`);
      }
    }
  };

  const renderVerseContent = (textContent: string | null | undefined, userInput: string[], lang: 'es' | 'en', isCurrentActive: boolean = true) => {
    if (!textContent) return null;
    
    // Committed-HEAD word-flow: all words flow in one wrapping flex container,
    // so each viewport finds its own natural balance. Masked characters keep
    // their footprints (hidden glyphs stay in the layout), so Steps 1-5 share
    // the identical word arrangement at any given width.
    const words = textContent.split(" ");
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const cleanTargetArr = getCleanLetters(textContent).split("");
    const isLangRevealed = isRevealed || (lang === 'es' ? didFailFlowEs : didFailFlowEn);
    let cleanLetterAccumulator = 0;

    return (
      <div className={`w-full font-serif select-none text-[#EFE6D8] text-[21px] min-[390px]:text-[23px] md:text-[27px] xl:text-[30px] leading-[1.45] font-normal [font-optical-sizing:auto] transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex flex-wrap justify-center content-start gap-y-2 md:gap-y-2.5 gap-x-[0.5em] w-full">
          {words.map((word, wordIdx) => {
            const wordStartIdx = cleanLetterAccumulator;
            const cleanWordLen = getCleanLetters(word).length;
            cleanLetterAccumulator += cleanWordLen;
            const chars = word.split("");
            let lettersInWordCount = 0;
            return (
              <div 
                key={wordIdx} 
                className="flex flex-row flex-nowrap gap-x-[1.5px] items-end cursor-text"
                onClick={(e) => {
                  if (stage === 5 && !isLangRevealed) {
                    e.stopPropagation();
                    if (!isCurrentActive) setActiveLanguage(lang);
                    
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const isRightHalf = clickX > rect.width / 2;
                    
                    const targetBaseIdx = isRightHalf ? wordStartIdx + cleanWordLen : wordStartIdx;
                    
                    const targetIdx = getNearestCursorIndex(targetBaseIdx, lang);
                    if (lang === 'es') setCursorIndexEsLive(targetIdx);
                    else setCursorIndexEnLive(targetIdx);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }
                }}
              >
                {chars.map((char, charIdx) => {
                  const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char);
                  const currentLetterIndex = wordStartIdx + lettersInWordCount;
                  if (isLetter) {
                    lettersInWordCount++;
                  }
                  
                  const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.25em]`;
                  
                  if (!isLetter) {
                    return (
                      <span 
                        key={charIdx} 
                        className={`${baseSlotClasses} text-[#EFE6D8]/45 cursor-text`}
                        onClick={(e) => {
                          if (stage === 5 && !isLangRevealed) {
                            e.stopPropagation();
                            if (!isCurrentActive) setActiveLanguage(lang);
                            
                            const targetIdx = getNearestCursorIndex(currentLetterIndex, lang);
                            if (lang === 'es') setCursorIndexEsLive(targetIdx);
                            else setCursorIndexEnLive(targetIdx);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }
                        }}
                      >
                        {char}
                      </span>
                    );
                  }
                  
                  if (stage < 5 && !isLangRevealed) {
                    let isHidden = false;
                    if (stage === 1) isHidden = charIdx >= 2;
                    else if (stage === 2) isHidden = wordIdx % 2 !== 0;
                    else if (stage === 3) isHidden = wordIdx % 2 === 0;
                    else if (stage === 4) isHidden = charIdx > 0;
 
                    return (
                      <span key={charIdx} className={baseSlotClasses}>
                        <span className={isHidden ? 'opacity-0' : 'opacity-100'}>{char}</span>
                        {isHidden && <span className="absolute bottom-1 left-0 right-0 h-[2px] bg-white/10 rounded-full" />}
                      </span>
                    );
                  }
 
                  if (stage === 5 && !isLangRevealed) {
                    const isRevealedByClue = revealed.includes(currentLetterIndex);
                    const userChar = (userInput[currentLetterIndex] || "").trim();
                    const submittedWrongChars = lang === 'es' ? submittedWrongCharsEs : submittedWrongCharsEn;
                    const isWrongChar = submittedWrongChars[currentLetterIndex] !== undefined && userChar === submittedWrongChars[currentLetterIndex];
                    
                    const activeCursorIdx = lang === 'es' ? cursorIndexEs : cursorIndexEn;
                    const isEditableSlot = isEditable(currentLetterIndex, lang);
                    
                    let displayActiveIdx = activeCursorIdx;
                    if (displayActiveIdx < cleanTargetArr.length && !isEditable(displayActiveIdx, lang)) {
                      let nextEd = displayActiveIdx;
                      while (nextEd < cleanTargetArr.length && !isEditable(nextEd, lang)) {
                        nextEd++;
                      }
                      if (nextEd < cleanTargetArr.length) {
                        displayActiveIdx = nextEd;
                      }
                    }
                    const isActiveSlot = isCurrentActive && currentLetterIndex === displayActiveIdx && isEditableSlot;
 
                    return (
                      <span 
                        key={charIdx} 
                        data-lang={isEditableSlot ? lang : undefined}
                        data-index={isEditableSlot ? currentLetterIndex : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrentActive) setActiveLanguage(lang);
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const isRightHalf = clickX > rect.width / 2;
                          const rawCaretPosition = isRightHalf ? currentLetterIndex + 1 : currentLetterIndex;
                          
                          const targetIdx = getNearestCursorIndex(rawCaretPosition, lang);
                          
                          if (lang === 'es') setCursorIndexEsLive(targetIdx);
                          else setCursorIndexEnLive(targetIdx);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className={`${baseSlotClasses} cursor-text ${
                          isRevealedByClue || userChar
                            ? isWrongChar ? 'text-[#F0A6A0]' : isCorrect || isRevealedByClue ? 'text-ember' : 'text-royal'
                            : 'text-transparent'
                        }`}
                      >
                        {isActiveSlot ? (
                          <span
                            className="absolute bottom-1 left-0 right-0 h-[3.5px] rounded-full bg-royal shadow-[0_0_10px_rgba(91,120,255,0.85)] z-20 animate-cursor-blink"
                          />
                        ) : (
                          <span className={`absolute bottom-1 left-0 right-0 h-[2px] rounded-full ${
                            isRevealedByClue || userChar
                              ? isWrongChar ? 'bg-crimson' : isCorrect || isRevealedByClue ? 'bg-ember' : 'bg-royal'
                              : 'bg-white/10'
                          }`} />
                        )}
                        <span className="opacity-0 pointer-events-none select-none">{char}</span>
                        <span 
                          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none ${(userChar || isRevealedByClue) ? 'opacity-100' : 'opacity-0'} overflow-visible`}
                          style={{ width: 'max-content', minWidth: 'max-content', maxWidth: 'none' }}
                        >
                          <span 
                            className="whitespace-nowrap overflow-visible flex-shrink-0"
                            style={{ width: 'max-content', minWidth: 'max-content', maxWidth: 'none' }}
                          >
                            {userChar || (isRevealedByClue ? char : "")}
                          </span>
                        </span>
                      </span>
                    );
                  }
 
                  return (
                    <span key={charIdx} className={`${baseSlotClasses} opacity-100`}>
                      {char}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (state.progress.verseStages[verse.id] === 7) {
    // Renders the fully completed display of Memorize
    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-(--glass-fill) border border-(--rim-gold) shadow-glow-gold flex items-center justify-center">
            <CheckCircle2 size={64} className="text-ember" strokeWidth={1.2} />
          </div>
        </div>

        <div className="space-y-4 px-6">
          <h2 className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight">
            {state.primaryLanguage === 'es' ? '¡Versículo aprendido!' : 'Verse Learned!'}
          </h2>
          <div className="max-w-md mx-auto space-y-4 px-5 py-6 bg-deep-slate rounded-[24px] border border-(--line)">
            <p className="font-fraunces text-lg font-normal leading-[1.32] italic text-[#EFE6D8]">
              "{state.memorizeMode === 'en' ? enText : (state.memorizeMode === 'es' ? esText : `${esText} / ${enText}`)}"
            </p>
            <p className="text-[11px] font-hanken font-semibold uppercase tracking-[0.2em] text-ember">
              {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4 px-6">
          <button 
            onClick={() => {
              // Explicitly reset the memory progress for a clean repeat attempt
              localStorage.removeItem(`memorize_failed_${verse.id}`);
              try {
                if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
                if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
              } catch(e){}
              
              setAttemptsEs(0);
              setAttemptsEn(0);
              setStage(1);
              setIsAlmostDone(false);
              setIsRevealed(false);
              setDidFailFlowEs(false);
              setDidFailFlowEn(false);
              setBilingualPass(1);
              setShowHalfwayTransition(false);
              
              setState(s => {
                const snapshot = buildMemorizeAttemptSnapshot(s, verse);
                return {
                  ...s,
                  activeAttempt: snapshot,
                  progress: {
                    ...s.progress,
                    verseStages: {
                      ...s.progress.verseStages,
                      [verse.id]: 1
                    }
                  }
                };
              });
            }} 
            className="vbtn vbtn--primary w-full"
          >
            <RotateCcw size={18} />
            <span>
              {state.primaryLanguage === 'es' ? 'repetir memorización' : 'repeat memorization'}
            </span>
          </button>

          <button
            onClick={onComplete}
            className="vbtn vbtn--secondary w-full"
          >
            <Bookmark size={18} />
            <span>
              {state.primaryLanguage === 'es' ? 'ver guardados' : 'view saved'}
            </span>
          </button>
        </div>
      </motion.div>
    );
  }

  if (isAlmostDone) {
    const getFailureScreenContent = () => {
      const enPassed = isCorrectEn && !didFailFlowEn;
      const esPassed = isCorrectEs && !didFailFlowEs;

      let title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
      let body = state.primaryLanguage === 'es' 
        ? 'No has logrado memorizar todo el texto del versículo. Por favor, inténtalo de nuevo para desbloquear el reto de la cita bíblica.' 
        : 'You did not successfully memorize the verse text. Please try again to unlock the citation challenge.';
      let buttonLabel = state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again';

      if (state.memorizeMode === 'both') {
        if (enPassed && !esPassed) {
          title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
          body = state.primaryLanguage === 'es'
            ? 'El inglés ya está asegurado. Ahora intenta con el español de nuevo para desbloquear el reto de la cita bíblica.'
            : 'English is locked in. Now try Spanish again to unlock the citation challenge.';
          buttonLabel = state.primaryLanguage === 'es' ? 'intentar español de nuevo' : 'try Spanish again';
        } else if (esPassed && !enPassed) {
          title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
          body = state.primaryLanguage === 'es'
            ? 'El español ya está asegurado. Ahora intenta con el inglés de nuevo para desbloquear el reto de la cita bíblica.'
            : 'Spanish is locked in. Now try English again to unlock the citation challenge.';
          buttonLabel = state.primaryLanguage === 'es' ? 'intentar inglés de nuevo' : 'try English again';
        }
      }

      return { title, body, buttonLabel };
    };

    const failureContent = getFailureScreenContent();

    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        <div className="relative">
          <div className={`w-32 h-32 rounded-full bg-(--glass-fill) border flex items-center justify-center ${isAnyPartFailed ? 'border-(--line)' : 'border-(--rim-gold) shadow-glow-gold'}`}>
            {isAnyPartFailed ? (
              <BookOpen size={64} className="text-cold-grey" fill="none" strokeWidth={1.5} />
            ) : (
              <CheckCircle2 size={64} className="text-ember" fill="none" strokeWidth={1.2} />
            )}
          </div>
        </div>

        <div className="space-y-4 px-6">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight text-center"
          >
            {isAnyPartFailed 
              ? failureContent.title
              : (state.memorizeMode === 'both'
                  ? (activeLanguage === 'es'
                      ? (state.primaryLanguage === 'es' ? '¡Buen trabajo! — Español memorizado' : 'Great job — Spanish locked in!')
                      : (state.primaryLanguage === 'es' ? '¡Excelente! — Inglés memorizado' : 'Nice — English locked in!')
                    )
                  : (state.primaryLanguage === 'es' ? '¡Ya casi!' : "You're almost there!")
                )
            }
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="font-hanken text-lg text-cold-grey max-w-sm mx-auto"
          >
            {isAnyPartFailed 
              ? failureContent.body
              : (state.memorizeMode === 'both'
                  ? (state.primaryLanguage === 'es' 
                      ? 'Ambos idiomas listos. Ya casi. Ahora falta el último paso: la cita bíblica.' 
                      : 'Both languages locked in. Almost there. Now for the final step: the citation.')
                  : (state.primaryLanguage === 'es' 
                      ? 'Texto completo. Ahora falta el último paso: la cita bíblica.' 
                      : 'Text complete. Now for the final step: the citation.')
                )
            }
          </motion.p>
          {!isAnyPartFailed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[11px] font-hanken font-semibold text-ember uppercase tracking-[0.22em] mt-4"
            >
              {state.primaryLanguage === 'es' ? 'Un paso más.' : 'One more step.'}
            </motion.p>
          )}
        </div>

        <div className="w-full max-w-sm space-y-8 px-6">
          <div className="flex flex-col items-center gap-6">
            {!isAnyPartFailed ? (
              <>
                <motion.button 
                  ref={challengeCitationRef}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={() => onGoToFlashcards?.(verse.id)}
                  className="vbtn vbtn--earned w-full"
                >
                  <Layers size={18} />
                  <span>
                    {state.primaryLanguage === 'es' ? 'Reto: Cita bíblica' : 'Challenge: Citation'}
                  </span>
                </motion.button>
                
                <motion.button 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  onClick={() => setShowAbandonConfirm(true)}
                  className="min-h-11 text-[11px] font-hanken font-semibold uppercase tracking-[0.2em] text-[#F0A6A0]/70 hover:text-[#F0A6A0] transition-colors flex items-center gap-2"
                >
                  <span>{state.primaryLanguage === 'es' ? '← abandonar reto' : '← abandon challenge'}</span>
                </motion.button>

                <AnimatePresence>
                  {showAbandonConfirm && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[rgba(8,11,16,0.60)] backdrop-blur-sm"
                        onClick={() => setShowAbandonConfirm(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-sm bg-deep-slate rounded-[24px] shadow-verso-modal border border-(--line) p-7 space-y-6 z-10"
                      >
                        <div className="space-y-3 text-center">
                          <div className="w-16 h-16 rounded-full bg-[rgba(209,78,92,0.08)] border border-[rgba(209,78,92,0.40)] flex items-center justify-center text-[#F0A6A0] mx-auto mb-4">
                            <AlertCircle size={28} />
                          </div>
                          <h3 className="text-2xl font-fraunces font-medium text-cool-white">
                            {state.primaryLanguage === 'es' ? "¿Abandonar reto?" : "Abandon challenge?"}
                          </h3>
                          <p className="font-hanken text-sm text-cold-grey leading-relaxed text-center">
                            {state.primaryLanguage === 'es'
                              ? "Si decides abandonar, se perderá tu progreso actual para este intento. No se otorgará crédito por completarlo."
                              : "If you decide to abandon, your current progress for this attempt will be lost. No completion credit will be awarded."}
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAbandonConfirm(false);
                              onAbandon?.();
                            }}
                            className="vbtn vbtn--destructive w-full"
                          >
                            {state.primaryLanguage === 'es' ? "Sí, abandonar" : "Yes, abandon"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAbandonConfirm(false)}
                            className="vbtn vbtn--secondary w-full"
                          >
                            {state.primaryLanguage === 'es' ? "Cancelar" : "Cancel"}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <motion.button 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={reset}
                className="vbtn vbtn--primary w-full"
              >
                <RotateCcw size={18} />
                <span>
                  {failureContent.buttonLabel}
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (showHalfwayTransition) {
    const isEnNext = activeLanguage === 'es';
    // Small logic fix: use proper failure check for the transition screen
    // If we're halfway, we check if the just-finished language failed
    const currentPassFailed = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;

    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
      >
        <div className="relative">
          <div className={`w-32 h-32 rounded-full bg-(--glass-fill) border flex items-center justify-center ${currentPassFailed ? 'border-(--line)' : 'border-(--rim-gold) shadow-glow-gold'}`}>
            {currentPassFailed ? (
              <BookOpen size={64} className="text-cold-grey" fill="none" strokeWidth={1.5} />
            ) : (
              <Trophy size={64} className="text-ember" fill="none" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div className="space-y-4 px-8">
          <h2 className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight">
            {currentPassFailed 
              ? (state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet')
              : (activeLanguage === 'es'
                  ? (state.primaryLanguage === 'es' ? '¡Buen trabajo! — Español memorizado' : 'Great job — Spanish locked in!')
                  : (state.primaryLanguage === 'es' ? '¡Excelente! — Inglés memorizado' : 'Nice — English locked in!')
                )
            }
          </h2>
          <div className="space-y-2">
            {!currentPassFailed && (
              <p className="font-hanken text-lg font-semibold text-royal-soft">
                {state.primaryLanguage === 'es'
                  ? 'Ya casi. Un idioma completado.'
                  : 'Almost there. One language down.'}
              </p>
            )}
            <p className="font-hanken text-cold-grey max-w-xs mx-auto leading-relaxed">
              {currentPassFailed
                ? (state.primaryLanguage === 'es' 
                    ? 'No se puede avanzar tras un intento fallido. Por favor, intenta memorizar el versículo desde el principio.' 
                    : 'You cannot proceed after a failed attempt. Please try memorizing the verse from the beginning.')
                : (state.primaryLanguage === 'es' 
                    ? `Sigue con la versión en ${isEnNext ? 'inglés' : 'español'}.`
                    : `Keep going with the ${isEnNext ? 'English' : 'Spanish'} version.`
                  )
              }
            </p>
          </div>
        </div>

        <div className="w-full max-w-[280px] px-6 space-y-4">
          {!currentPassFailed ? (
            <button
              ref={halfwayContinueRef}
              onClick={handleHalfwayContinue}
              className="vbtn vbtn--primary w-full"
            >
              {state.primaryLanguage === 'es' ? 'continuar' : 'continue'}
            </button>
          ) : (
            <button
              onClick={reset}
              className="vbtn vbtn--primary w-full"
            >
              {state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div id="memorize-content" className="flex-1 flex flex-col w-full mx-auto pt-2 sm:pt-0 pb-6 md:max-w-[760px] xl:max-w-[900px]">
      {/* Top Section - Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="space-y-2 sm:space-y-3">
          {/* Row 1: eyebrow + language chip (left) and step status (right).
              The step indicator lives here so the reference below always gets
              the full column width and never competes with it. */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <span className="font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] text-faint leading-none">
                {state.primaryLanguage === 'es' ? 'MEMORIZA' : 'MEMORIZE'}
              </span>

              {state.memorizeMode === 'both' && (
                <span className="vchip text-[10px] sm:text-[11px] uppercase tracking-[0.2em] min-h-0 py-1.5 select-none">
                  {activeLanguage === 'es'
                    ? (state.primaryLanguage === 'es' ? 'Español' : 'Spanish')
                    : (state.primaryLanguage === 'es' ? 'Inglés' : 'English')}
                </span>
              )}
            </div>

            {/* Progress Indicator */}
            <div className="flex items-baseline gap-1.5 flex-shrink-0">
              <span className="text-[11.5px] font-hanken font-semibold uppercase tracking-widest text-faint">
                {state.primaryLanguage === 'es' ? 'Paso' : 'Step'}
              </span>
              <span className="text-lg sm:text-xl font-fraunces font-medium text-ember lining-nums leading-none">{Math.min(5, stage)}</span>
              <span className="text-xs text-faint font-hanken font-semibold">/ 5</span>
            </div>
          </div>

          {/* Row 2: the verse reference owns the full row. Long and Spanish
              references wrap naturally; never truncated or ellipsized. */}
          <h2 className="w-full font-fraunces text-[32px] md:text-[42px] font-medium text-cool-white tracking-tight leading-[1.15] break-words">
            {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
          </h2>

          <motion.p
            key={`${stage}-${state.primaryLanguage}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-hanken text-[15px] text-cold-grey antialiased"
          >
            {state.primaryLanguage === 'es' 
              ? (
                stage === 1 ? 'Léelo en voz alta, todavía no tienes que escribir' :
                stage === 2 ? 'Léelo en voz alta una vez más' :
                stage === 3 ? 'Respira profundo. Di las palabras en voz alta' :
                stage === 4 ? 'Una última lectura antes de escribir' :
                'Ahora escribe lo que recuerdas'
              )
              : (
                stage === 1 ? 'Read it out loud, no typing yet' :
                stage === 2 ? 'Read it out loud once more' :
                stage === 3 ? 'Take a breath. Speak the words out loud' :
                stage === 4 ? 'One last read before you type' :
                'Now type what you remember'
              )
            }
          </motion.p>
        </div>
        
        {/* Dotted Progress Indicator - Organic Seed Trail (decorative; the
            visible "Step N / 5" text above is the accessible equivalent).
            Sits in the main composition and leads into the Scripture stage. */}
        <div className="w-full flex justify-center items-center pt-[22px] overflow-hidden" aria-hidden="true">
          <div className="relative flex items-center justify-center gap-2 sm:gap-3 px-4">
            {Array.from({ length: 21 }).map((_, i) => {
              // Every 5th dot is a main node (0, 5, 10, 15, 20)
              const isMainNode = i % 5 === 0;
              const mainNodeIdx = i / 5 + 1;
              const isCompleted = isMainNode ? mainNodeIdx < stage : (i < (stage - 1) * 5);
              const isActive = isMainNode && mainNodeIdx === stage;

              // Organic wave pattern
              const yOffset = Math.sin(i * 0.8) * 8;

              return (
                <div key={i} className="relative flex items-center justify-center">
                  <motion.div
                    initial={false}
                    animate={{
                      y: yOffset,
                      scale: isActive ? 1.25 : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 20
                    }}
                    className={`rounded-full transition-all duration-700 ${
                      isMainNode
                        ? `w-2.5 h-2.5 sm:w-3 sm:h-3 ${
                            isCompleted
                              ? "bg-ember/35 shadow-[0_0_8px_rgba(232,179,75,0.15)]"
                              : isActive
                                ? "bg-ember shadow-[0_0_14px_rgba(232,179,75,0.45)]"
                                : "bg-white/10"
                          }`
                        : `w-1 h-1 ${
                            isCompleted
                              ? "bg-ember/15"
                              : "bg-white/5"
                          }`
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Scripture Stage - an open rounded boundary suggested by four
          corner marks; never a full nested card, never full-width rules */}
      <div className="flex-1 flex flex-col items-center w-full mb-[22px]">
        <div
          id="memorize-verse-card"
          className="w-full relative overflow-visible rounded-[14px] md:rounded-[18px] bg-[rgba(15,20,27,0.28)]"
        >
          {/* Open corner frame: only the two relevant sides of each mark render */}
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-l border-[rgba(91,120,255,0.32)] rounded-tl-[14px] md:rounded-tl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-r border-[rgba(91,120,255,0.32)] rounded-tr-[14px] md:rounded-tr-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-l border-[rgba(91,120,255,0.32)] rounded-bl-[14px] md:rounded-bl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-r border-[rgba(91,120,255,0.32)] rounded-br-[14px] md:rounded-br-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          {/* Stage body - content-sized in-flow column (label, verse, utility
              controls); the Phase 1 shell is the only scroll owner */}
          <div
            className="w-full flex flex-col items-center relative overflow-visible py-7 px-2.5 md:py-9 md:px-6 xl:py-[42px] xl:px-9 gap-6 md:gap-7"
          >
            {/* Input Overlay for Stage 5 */}
            {stage === 5 && !isRevealed && !isCorrect && !didFailFlow && (
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                defaultValue=" "
                onKeyDown={(e) => {
                  const isComposingKey = e.nativeEvent.isComposing || isInputComposingRef.current || e.key === 'Dead' || e.key === 'Process';
                  if (isComposingKey) return;

                  const hasTextInputModifier = e.altKey || e.ctrlKey || e.metaKey || e.getModifierState('AltGraph');
                  if (hasTextInputModifier) return;

                  const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
                  const text = activeLanguage === 'es' ? esText : enText;
                  const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
                  const userInput = activeLanguage === 'es' ? userInputEs : userInputEn;

                  const getNextIdx = (idx: number, dir: number) => {
                    if (!text) return 0;
                    const cleanLen = activeLanguage === 'es' ? esTextCleanLen : enTextCleanLen;
                    let next = idx + dir;
                    while (next >= 0 && next <= cleanLen) {
                      if (isValidCursorIndex(next, activeLanguage)) {
                        return next;
                      }
                      next += dir;
                    }
                    return getNearestCursorIndex(idx + dir, activeLanguage);
                  };

                  if (e.key === 'Backspace') {
                    e.preventDefault();

                    // Reset "submitted" state if user starts correcting
                    if (hasSubmitted) {
                      if (activeLanguage === 'es') {
                        setHasSubmittedEs(false);
                        setIsWrongEs(false);
                      } else {
                        setHasSubmittedEn(false);
                        setIsWrongEn(false);
                      }
                    }

                    const isCurrentEditable = isEditable(cursor, activeLanguage);
                    const hasTypedInCurrent = isCurrentEditable && (userInput[cursor] || "").trim() !== "";

                    if (hasTypedInCurrent) {
                      if (activeLanguage === 'es') {
                        setSubmittedWrongCharsEs(prev => {
                          const next = { ...prev };
                          delete next[cursor];
                          return next;
                        });
                        setIncorrectIndicesEs(prev => prev.filter(idx => idx !== cursor));
                      } else {
                        setSubmittedWrongCharsEn(prev => {
                          const next = { ...prev };
                          delete next[cursor];
                          return next;
                        });
                        setIncorrectIndicesEn(prev => prev.filter(idx => idx !== cursor));
                      }
                      setter(prevArr => {
                        const next = [...prevArr];
                        next[cursor] = ""; // Clear active slot
                        return next;
                      });
                    } else {
                      const prevEditable = findPreviousEditableIndex(cursor, activeLanguage);
                      if (prevEditable !== -1) {
                        if (activeLanguage === 'es') {
                          setSubmittedWrongCharsEs(prev => {
                            const next = { ...prev };
                            delete next[prevEditable];
                            return next;
                          });
                          setIncorrectIndicesEs(prev => prev.filter(idx => idx !== prevEditable));
                        } else {
                          setSubmittedWrongCharsEn(prev => {
                            const next = { ...prev };
                            delete next[prevEditable];
                            return next;
                          });
                          setIncorrectIndicesEn(prev => prev.filter(idx => idx !== prevEditable));
                        }
                        setter(prevArr => {
                          const next = [...prevArr];
                          next[prevEditable] = ""; // Clear character before cursor
                          return next;
                        });
                        setCursor(prevEditable);
                      }
                    }
                  } else if (e.key === 'Delete') {
                    e.preventDefault();
                    
                    if (hasSubmitted) {
                      if (activeLanguage === 'es') {
                        setHasSubmittedEs(false);
                        setIsWrongEs(false);
                      } else {
                        setHasSubmittedEn(false);
                        setIsWrongEn(false);
                      }
                    }

                    const nextEditable = findNextEditableIndex(cursor, activeLanguage);
                    if (nextEditable !== -1) {
                      if (activeLanguage === 'es') {
                        setSubmittedWrongCharsEs(prev => {
                          const next = { ...prev };
                          delete next[nextEditable];
                          return next;
                        });
                        setIncorrectIndicesEs(prev => prev.filter(idx => idx !== nextEditable));
                      } else {
                        setSubmittedWrongCharsEn(prev => {
                          const next = { ...prev };
                          delete next[nextEditable];
                          return next;
                        });
                        setIncorrectIndicesEn(prev => prev.filter(idx => idx !== nextEditable));
                      }
                      setter(prevArr => {
                        const nextArr = [...prevArr];
                        nextArr[nextEditable] = ""; // Clear character after caret
                        return nextArr;
                      });
                    }
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      const prevWordStart = findPreviousEditableWordStart(cursor, activeLanguage);
                      if (prevWordStart !== -1) {
                        setCursor(prevWordStart);
                      }
                    } else {
                      const nextWordStart = findNextEditableWordStart(cursor, activeLanguage);
                      if (nextWordStart !== -1) {
                        setCursor(nextWordStart);
                      }
                    }
                  } else if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    const nextWordStart = findNextEditableWordStart(cursor, activeLanguage);
                    if (nextWordStart !== -1) {
                      setCursor(nextWordStart);
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setCursor(getNextIdx(cursor, -1));
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setCursor(getNextIdx(cursor, 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const currentSpan = document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor}"]`) 
                      || document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor - 1}"]`);
                    if (currentSpan) {
                      const refRect = currentSpan.getBoundingClientRect();
                      const refX = refRect.left + refRect.width / 2;
                      const allSpans = Array.from(document.querySelectorAll(`[data-lang="${activeLanguage}"]`));
                      
                      const candidateSpans = allSpans.filter(span => {
                        const rect = span.getBoundingClientRect();
                        return (rect.top + rect.height / 2) < refRect.top;
                      });
                      
                      if (candidateSpans.length > 0) {
                        const maxY = Math.max(...candidateSpans.map(s => s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2));
                        const lineCandidates = candidateSpans.filter(s => {
                          const rect = s.getBoundingClientRect();
                          const centerY = rect.top + rect.height / 2;
                          return Math.abs(centerY - maxY) < 15;
                        });
                        
                        let bestSpan = lineCandidates[0];
                        let minDiff = Infinity;
                        lineCandidates.forEach(s => {
                          const rect = s.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const diff = Math.abs(centerX - refX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            bestSpan = s;
                          }
                        });
                        
                        if (bestSpan) {
                          const targetIdx = parseInt(bestSpan.getAttribute('data-index') || "0", 10);
                          setCursor(getNearestCursorIndex(targetIdx, activeLanguage));
                        }
                      }
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const currentSpan = document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor}"]`) 
                      || document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor - 1}"]`);
                    if (currentSpan) {
                      const refRect = currentSpan.getBoundingClientRect();
                      const refX = refRect.left + refRect.width / 2;
                      const allSpans = Array.from(document.querySelectorAll(`[data-lang="${activeLanguage}"]`));
                      
                      const candidateSpans = allSpans.filter(span => {
                        const rect = span.getBoundingClientRect();
                        return (rect.top + rect.height / 2) > (refRect.top + refRect.height);
                      });
                      
                      if (candidateSpans.length > 0) {
                        const minY = Math.min(...candidateSpans.map(s => s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2));
                        const lineCandidates = candidateSpans.filter(s => {
                          const rect = s.getBoundingClientRect();
                          const centerY = rect.top + rect.height / 2;
                          return Math.abs(centerY - minY) < 15;
                        });
                        
                        let bestSpan = lineCandidates[0];
                        let minDiff = Infinity;
                        lineCandidates.forEach(s => {
                          const rect = s.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const diff = Math.abs(centerX - refX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            bestSpan = s;
                          }
                        });
                        
                        if (bestSpan) {
                          const targetIdx = parseInt(bestSpan.getAttribute('data-index') || "0", 10);
                          setCursor(getNearestCursorIndex(targetIdx, activeLanguage));
                        }
                      }
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                onCompositionStart={() => {
                  isInputComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isInputComposingRef.current = false;
                  const input = e.currentTarget;
                  window.setTimeout(() => {
                    const composedText = getTypedTextFromInputValue(input.value);
                    if (composedText) {
                      insertTypedText(composedText);
                    }
                    resetStreamInput(input);
                  }, 0);
                }}
                onInput={(e) => {
                  const val = e.currentTarget.value;
                  const nativeInputEvent = e.nativeEvent as InputEvent;
                  if (isInputComposingRef.current || nativeInputEvent.isComposing) return;

                  const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
                  const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
                  const userInput = activeLanguage === 'es' ? userInputEs : userInputEn;

                  // Detect addition
                  if (val.length > 0) {
                    const typedText = getTypedTextFromInputValue(val);
                    if (typedText) {
                      insertTypedText(typedText);
                    }
                  } else if (val.length === 0) {
                    // Mobile Backspace detection fallback
                    const isCurrentEditable = isEditable(cursor, activeLanguage);
                    const hasTypedInCurrent = isCurrentEditable && (userInput[cursor] || "").trim() !== "";

                    if (hasTypedInCurrent) {
                      if (activeLanguage === 'es') {
                        setSubmittedWrongCharsEs(prev => {
                          const next = { ...prev };
                          delete next[cursor];
                          return next;
                        });
                        setIncorrectIndicesEs(prev => prev.filter(idx => idx !== cursor));
                      } else {
                        setSubmittedWrongCharsEn(prev => {
                          const next = { ...prev };
                          delete next[cursor];
                          return next;
                        });
                        setIncorrectIndicesEn(prev => prev.filter(idx => idx !== cursor));
                      }
                      setter(prevArr => {
                        const nextArr = [...prevArr];
                        nextArr[cursor] = ""; // Clear character at active slot
                        return nextArr;
                      });
                    } else {
                      const prevEditable = findPreviousEditableIndex(cursor, activeLanguage);
                      if (prevEditable !== -1) {
                        if (activeLanguage === 'es') {
                          setSubmittedWrongCharsEs(prev => {
                            const next = { ...prev };
                            delete next[prevEditable];
                            return next;
                          });
                          setIncorrectIndicesEs(prev => prev.filter(idx => idx !== prevEditable));
                        } else {
                          setSubmittedWrongCharsEn(prev => {
                            const next = { ...prev };
                            delete next[prevEditable];
                            return next;
                          });
                          setIncorrectIndicesEn(prev => prev.filter(idx => idx !== prevEditable));
                        }
                        setter(prevArr => {
                          const nextArr = [...prevArr];
                          nextArr[prevEditable] = ""; // Clear character at the previous editable index
                          return nextArr;
                        });
                        setCursor(prevEditable);
                      }
                    }
                  }

                  // Always reset input value to " " to be ready for next char/deletion
                  resetStreamInput(e.currentTarget);
                }}
                className="absolute opacity-0 inset-0 w-full h-full cursor-default caret-transparent text-transparent outline-none border-none select-none bg-transparent shadow-none"
                autoFocus
              />
            )}

            {/* Translation Label - in-flow, centered inside the implied frame */}
            <div className="relative z-10 flex justify-center">
              <motion.div 
                key={`${activeLanguage}-${state.selectedTranslations.es}-${state.selectedTranslations.en}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <div className="h-px w-6 bg-(--line)" />
                <span className="text-[10px] font-hanken font-semibold uppercase tracking-[0.4em] text-faint">
                  {activeLanguage === 'es' ? (activePair?.es || 'RVR1960') : (activePair?.en || 'KJV')}
                </span>
                <div className="h-px w-6 bg-(--line)" />
              </motion.div>
            </div>

            {/* Verse Content */}
            <div className="w-full flex flex-col items-center overflow-visible relative z-10">
              <div className="w-full relative">
                {activeLanguage === 'es' 
                  ? renderVerseContent(esText, userInputEs, 'es', true)
                  : renderVerseContent(enText, userInputEn, 'en', true)
                }
              </div>
            </div>

            {/* Compact utility control group (clue + peek). Fit-content dark
                glass; clue keeps its stable slot via visibility so the group
                never jumps when clue availability changes. */}
            <div className="relative z-10 inline-flex w-fit items-center min-h-[52px] p-1 gap-1.5 rounded-[18px] bg-[rgba(15,20,27,0.86)] border border-[rgba(150,180,210,0.12)] backdrop-blur-[14px]">
              <div className={canShowClue ? 'opacity-100' : 'opacity-0 pointer-events-none'}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); handleClue(activeLanguage); }}
                  disabled={!canUseClue}
                  className="inline-flex items-center gap-2 min-h-11 px-3.5 rounded-[14px] bg-transparent border border-dotted border-(--rim-gold) text-[10px] font-hanken font-semibold uppercase tracking-widest text-ember active:translate-y-px disabled:opacity-40 disabled:border-solid disabled:border-(--line) disabled:text-faint disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span className="whitespace-nowrap">{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}</span>
                </button>
              </div>
              <button
                    disabled={stage === 5}
                    tabIndex={stage === 5 ? -1 : 0}
                    aria-disabled={stage === 5}
                    onPointerDown={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType === "touch" || e.pointerType === "pen") {
                        setIsRevealed(v => !v);
                      } else {
                        setIsRevealed(true);
                      }
                    }}
                    onPointerUp={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType !== "touch" && e.pointerType !== "pen") {
                        setIsRevealed(false);
                      }
                    }}
                    onPointerLeave={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType !== "touch" && e.pointerType !== "pen") {
                        setIsRevealed(false);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      userSelect: "none",
                      touchAction: "manipulation",
                    } as React.CSSProperties}
                    aria-label={state.primaryLanguage === 'es' ? 'Ver el versículo' : 'Peek at the verse'}
                    className={`w-11 h-11 rounded-[14px] border flex items-center justify-center active:scale-95 select-none ${
                      stage === 5
                        ? 'bg-transparent border-(--line) text-(--control-text-disabled) cursor-not-allowed pointer-events-none opacity-40'
                        : isRevealed
                          ? 'bg-[rgba(91,120,255,0.10)] border-(--rim-royal) text-royal shadow-glow-royal'
                          : 'bg-transparent border-transparent text-cold-grey hover:border-(--rim-royal) hover:text-royal'
                    }`}
                  >
                    {isRevealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM FLOW: controls, then feedback, then step bars */}
      <div
        className="w-full flex-shrink-0 pb-2 relative z-10"
      >
        {/* Action Controls - Balanced & Outlined Circular Buttons */}
        {/* Stable three-column row: reserved Back column | centered primary action | matching spacer */}
        <div className="w-full max-w-2xl mx-auto flex items-center justify-center gap-6 sm:gap-10">
            {/* Back Column (always reserved; Back hidden at stage 1) */}
            <div className="w-14 sm:w-16 flex-shrink-0 flex items-center justify-center">
              <button
                onClick={stage === 5 ? undefined : prevStage}
                disabled={stage === 1 || stage === 5}
                aria-hidden={stage === 1 || undefined}
                tabIndex={stage === 1 ? -1 : undefined}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border backdrop-blur-[10px] transition-all group relative ${
                  stage === 1
                    ? 'opacity-0 pointer-events-none bg-(--glass-fill) border-(--line) text-cool-white'
                    : stage === 5
                      ? 'bg-(--control-fill-disabled) border-(--line) text-(--control-text-disabled) cursor-not-allowed'
                      : 'bg-(--glass-fill) border-(--line) text-cool-white hover:border-(--rim-royal) hover:text-royal active:translate-y-px'
                }`}
                aria-label="Back"
              >
                <ArrowLeft size={24} strokeWidth={2} className={stage === 5 ? '' : "group-hover:-translate-x-0.5 transition-transform"} />
              </button>
            </div>

            {/* Main Action (Next/Check) */}
            <button
              ref={mainActionRef}
              key="main-action"
              onClick={() => {
                const currentAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
                const currentIsWrong = activeLanguage === 'es' ? isWrongEs : isWrongEn;
                const currentHasSubmitted = activeLanguage === 'es' ? hasSubmittedEs : hasSubmittedEn;

                if (stage === 5) {
                  if (isStepComplete || isRevealed || (currentIsWrong && currentAttempts >= 3)) {
                    nextStage();
                  } else if (currentHasSubmitted && currentIsWrong) {
                    if (activeLanguage === 'es') {
                      setHasSubmittedEs(false);
                      setIsWrongEs(false);
                    } else {
                      setHasSubmittedEn(false);
                      setIsWrongEn(false);
                    }
                    if (inputRef.current) {
                      try {
                        inputRef.current.focus({ preventScroll: true });
                        inputRef.current.setSelectionRange(1, 1);
                      } catch (e) {
                        console.warn("Click refocus failed", e);
                      }
                    }
                    setTimeout(() => {
                      if (inputRef.current) {
                        try {
                          inputRef.current.focus({ preventScroll: true });
                          inputRef.current.setSelectionRange(1, 1);
                        } catch (e) {
                          console.warn("Async click refocus failed", e);
                        }
                      }
                    }, 30);
                  } else {
                    handleCheck();
                  }
                } else {
                  nextStage();
                }
              }}
              aria-label={state.primaryLanguage === 'es' ? 'Continuar' : 'Continue'}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center group border bg-(--glass-fill) backdrop-blur-[10px] transition-all active:translate-y-px relative ${
                stage === 5
                  ? (isStepComplete
                      ? 'border-(--rim-gold) text-ember shadow-glow-gold'
                      : (hasSubmitted && isWrong && attempts < 3
                          ? 'border-[rgba(209,78,92,0.55)] text-[#F0A6A0]'
                          : 'border-(--rim-royal) text-royal shadow-glow-royal'))
                  : 'border-(--rim-royal) text-royal shadow-glow-royal'
              }`}
            >
              <ArrowRight size={28} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Right balancing column: matches the Back column width to keep the primary action centered */}
            <div className="w-14 sm:w-16 flex-shrink-0" aria-hidden="true" />
        </div>

        {/* Feedback Area - natural height so localized copy never clips */}
        <div className={`w-full flex items-center justify-center px-2 ${stage === 5 && feedback ? 'mt-[18px]' : ''}`}>
          <AnimatePresence mode="wait">
            {stage === 5 && feedback ? (
              <motion.div
                key={feedback}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-2.5 max-w-full bg-deep-slate px-4 sm:px-5 py-2.5 rounded-2xl border shadow-verso-card ${isCorrect ? 'border-(--rim-gold)' : 'border-[rgba(209,78,92,0.40)]'}`}
              >
                {isCorrect ? (
                  <CheckCircle2 size={16} className="text-ember flex-shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle size={16} className="text-[#F0A6A0] flex-shrink-0" aria-hidden="true" />
                )}
                <span className={`min-w-0 text-[11px] sm:text-sm font-hanken font-semibold uppercase tracking-widest ${isCorrect ? 'text-ember' : 'text-[#F0A6A0]'}`}>
                  {feedback}
                </span>
                {!isCorrect && (
                  <span className="text-[10px] font-hanken font-semibold text-faint flex-shrink-0">
                    ({attempts}/3)
                  </span>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Pagination Dots (Reserved; decorative — "Step N / 5" above is the
            accessible equivalent) */}
        <div className="h-8 flex justify-center items-center gap-4 mt-[22px]" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-700 ${
                s === stage
                  ? 'w-10 bg-royal shadow-[0_0_15px_rgba(91,120,255,0.4)]'
                  : s < stage
                    ? 'w-2 bg-ember shadow-[0_0_10px_rgba(232,179,75,0.3)]'
                    : 'w-2 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
