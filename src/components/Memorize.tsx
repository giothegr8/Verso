import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS, Verse } from "../types";
import { loadVerseAndMerge } from "../services/bibleService";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers, MessageCircle, BookOpen, Sprout, Loader2 } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, getVerseLines, removeAccents, VERSE_LAYOUT } from "../utils/verseUtils";

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
    if (state.activeAttempt?.verse) {
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
  const [stage, setStage] = useState(() => Math.min(5, globalVerseStage));
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(() => globalVerseStage === 6);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [coachType, setCoachType] = useState<'encouragement' | 'suggestion' | 'tip'>('encouragement');
  const activePair = getCurrentTranslationPair(state);

  const attemptsKeyEs = `memorize_attempts_${verse.id}_es_${activePair?.es || 'RVR1960'}`;
  const attemptsKeyEn = `memorize_attempts_${verse.id}_en_${activePair?.en || 'KJV'}`;

  const [attemptsEs, setAttemptsEs] = useState(() => {
    const stored = localStorage.getItem(attemptsKeyEs);
    return stored ? parseInt(stored) : 0;
  });
  const [attemptsEn, setAttemptsEn] = useState(() => {
    const stored = localStorage.getItem(attemptsKeyEn);
    return stored ? parseInt(stored) : 0;
  });

  // Persist attempts to localStorage
  useEffect(() => {
    localStorage.setItem(attemptsKeyEs, attemptsEs.toString());
  }, [attemptsEs, attemptsKeyEs]);

  useEffect(() => {
    localStorage.setItem(attemptsKeyEn, attemptsEn.toString());
  }, [attemptsEn, attemptsKeyEn]);

  const typingStateKey = `memorize_typing_state_${verse.id}_${state.memorizeMode}_${activePair?.es || 'RVR1960'}_${activePair?.en || 'KJV'}`;

  const savedTypingState = useMemo(() => {
    try {
      const stored = localStorage.getItem(typingStateKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [typingStateKey]);

  const [userInputEs, setUserInputEs] = useState<string[]>(() => savedTypingState?.userInputEs || []);
  const [userInputEn, setUserInputEn] = useState<string[]>(() => savedTypingState?.userInputEn || []);
  const [cursorIndexEs, setCursorIndexEs] = useState(() => savedTypingState?.cursorIndexEs || 0);
  const [cursorIndexEn, setCursorIndexEn] = useState(() => savedTypingState?.cursorIndexEn || 0);
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
  const [feedback, setFeedback] = useState<string | null>(null);

  const [activeLanguage, setActiveLanguage] = useState<'es' | 'en'>(() => {
    if (savedTypingState?.activeLanguage) return savedTypingState.activeLanguage;
    if (state.memorizeMode === 'en') return 'en';
    if (state.memorizeMode === 'es') return 'es';
    return state.primaryLanguage === 'en' ? 'en' : 'es';
  });

  const [bilingualPass, setBilingualPass] = useState(() => savedTypingState?.bilingualPass || 1);

  const celebratedHalfwayRef = useRef<string>("");
  const celebratedAlmostDoneRef = useRef<string>("");

  // Refs and helper to always hold the latest state values for non-reactive access in debounced save
  const stateRef = useRef({
    bilingualPass,
    activeLanguage,
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
    bilingualPass,
    activeLanguage,
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
    activeLanguage,
    typingStateKey,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
    hasSubmittedEs,
    hasSubmittedEn,
    bilingualPass,
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
  
  const [inputValue, setInputValue] = useState(" ");
  
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure card height on mount, stage change, or verse change to ensure stability
  useEffect(() => {
    setCardHeight(null);
    if (cardRef.current && (stage === 1 || stage === 4)) {
      // Small timeout to allow content to settle and fonts to render
      const timer = setTimeout(() => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect && rect.height > 0) {
          // We take the max of what we've seen to ensure it never jumps down, only accommodates
          setCardHeight(prev => Math.max(prev || 0, rect.height));
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [verse.id, state.memorizeMode, stage, activeLanguage, state.selectedTranslations.es, state.selectedTranslations.en]);

  useEffect(() => {
    // Reset height if verse changes
    setCardHeight(null);
  }, [verse.id, state.memorizeMode]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [showHalfwayTransition, setShowHalfwayTransition] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  
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
    verseId: verse.id
  });

  // Reset stage when verse, translations, or display mode changes
  useEffect(() => {
    const configChanged = 
      lastConfigRef.current.selectedTranslationsEs !== state.selectedTranslations.es ||
      lastConfigRef.current.selectedTranslationsEn !== state.selectedTranslations.en ||
      lastConfigRef.current.memorizeMode !== state.memorizeMode ||
      lastConfigRef.current.verseId !== verse.id;

    if (configChanged) {
      const dbStage = state.progress.verseStages[verse.id] || 1;
      setStage(Math.min(5, dbStage));
      setIsRevealed(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      setBilingualPass(1);
      setShowHalfwayTransition(false);
      setIsAlmostDone(dbStage === 6);
      
      // Preserve attempts if it's the same verse and translations
      if (lastConfigRef.current.verseId !== verse.id || 
          lastConfigRef.current.selectedTranslationsEs !== state.selectedTranslations.es ||
          lastConfigRef.current.selectedTranslationsEn !== state.selectedTranslations.en) {
        setAttemptsEs(0);
        setAttemptsEn(0);
      }
      
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
      setCursorIndexEs(0);
      setCursorIndexEn(0);
      
      // Determine initial language for the session
      const initialLang = state.memorizeMode === 'en' ? 'en' : (state.memorizeMode === 'es' ? 'es' : state.primaryLanguage);
      setActiveLanguage(initialLang);
      
      lastConfigRef.current = {
        selectedTranslationsEs: state.selectedTranslations.es,
        selectedTranslationsEn: state.selectedTranslations.en,
        memorizeMode: state.memorizeMode,
        verseId: verse.id
      };

      // Update global state to ensure consistency, preserving existing completed states
      setState(s => {
        const currentStage = s.progress.verseStages[verse.id] || 1;
        if (currentStage === 6 || currentStage === 7) {
          return s;
        }
        return {
          ...s,
          progress: {
            ...s.progress,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 1
            }
          }
        };
      });
    }
  }, [verse.id, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode, setState]);
  
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
    if (stage === 5 && !isRevealed && !isAlmostDone && inputRef.current) {
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
        if (inputRef.current) {
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
            colors: ['#0d9488', '#2dd4bf', '#a7f3d0'], // Teal/mint palette
            ticks: 200,
            gravity: 1.2
          });
        }
      } else {
        // Water-based burst using blue/teal shades for single language mode complete
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;
        const colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#e0f2fe'];

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
          colors: ['#0d9488', '#2dd4bf', '#a7f3d0'], // Teal/mint palette
          ticks: 200,
          gravity: 1.2
        });
      }
    }
  }, [showHalfwayTransition, activeLanguage, didFailFlowEs, didFailFlowEn, verse.id]);

  if (verse && ((state.memorizeMode === 'es' && isEsLoading) || (state.memorizeMode === 'en' && isEnLoading) || (state.memorizeMode === 'both' && (isEsLoading || isEnLoading)))) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <Loader2 className="animate-spin text-teal-600 dark:text-teal-400" size={36} />
        <p className="text-earth-light dark:text-lavender-muted text-sm font-medium">
          {state.primaryLanguage === 'es' ? 'Cargando traducción...' : 'Loading translation...'}
        </p>
      </div>
    );
  }

  if (!verse || (!esText && !enText)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-16 h-16 bg-coral/10 rounded-full flex items-center justify-center">
          <AlertCircle size={32} className="text-coral" />
        </div>
        <h3 className="text-xl font-serif font-bold text-earth dark:text-ivory">
          {state.primaryLanguage === 'es' ? 'Versículo no disponible' : 'Verse unavailable'}
        </h3>
        <div className="space-y-2">
          {esError && <p className="text-coral font-bold text-sm">{esError}</p>}
          {enError && <p className="text-coral font-bold text-sm">{enError}</p>}
        </div>
        <p className="text-earth-light dark:text-lavender-muted max-w-xs pt-4">
          {state.primaryLanguage === 'es' 
            ? 'Por favor selecciona una traducción diferente en los ajustes.' 
            : 'Please select a different translation in settings.'}
        </p>
      </div>
    );
  }

  const nextStage = () => {
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
        setCursorIndexEs(0);
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
        setCursorIndexEn(0);
      }
      setFeedback(null);
      
      // Initialize slot buffers for Stage 5
      if (newStage === 5) {
        if (esText) setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
        if (enText) setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
        setInputValue(" ");
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
      if (state.memorizeMode === 'both' && bilingualPass === 1) {
        // Clear attempts for the language JUST finished
        if (activeLanguage === 'es') localStorage.removeItem(attemptsKeyEs);
        else localStorage.removeItem(attemptsKeyEn);
        setShowHalfwayTransition(true);
      } else {
        // Clear attempts and typing state on level exit
        localStorage.removeItem(attemptsKeyEs);
        localStorage.removeItem(attemptsKeyEn);
        localStorage.removeItem(typingStateKey);
        
        // Success Persistence Fix: Save verse when successfully completed
        if (!isAnyPartFailed) {
          try {
            localStorage.setItem(`memorize_failed_${verse.id}`, "false");
          } catch (e) {
            console.error(e);
          }
          setState(s => ({
            ...s,
            savedVerses: s.savedVerses.includes(verse.id) ? s.savedVerses : [...s.savedVerses, verse.id],
            progress: {
              ...s.progress,
              verseStages: {
                ...s.progress.verseStages,
                [verse.id]: 6
              }
            }
          }));
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
    setBilingualPass(2);
    setStage(1);
    setShowHalfwayTransition(false);
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    
    // Switch to the OTHER language
    const nextLang = activeLanguage === 'es' ? 'en' : 'es';
    setActiveLanguage(nextLang);
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
      setCursorIndexEs(0);
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
      setCursorIndexEn(0);
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
        setCursorIndexEs(0);
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setIsCorrectEs(false);
        setRevealedIndicesEs([]);
      } else {
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setCursorIndexEn(0);
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
        localStorage.removeItem(attemptsKeyEs);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setBilingualPass(2);
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
        setCursorIndexEs(0);
        
        setState(s => ({
          ...s,
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
        localStorage.removeItem(attemptsKeyEn);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setBilingualPass(2);
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
        setCursorIndexEn(0);
        
        setState(s => ({
          ...s,
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
    localStorage.removeItem(attemptsKeyEs);
    localStorage.removeItem(attemptsKeyEn);
    localStorage.removeItem(typingStateKey);
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
        if (lang === 'es') setCursorIndexEs(Math.min(firstEmpty, targetCleanSize));
        else setCursorIndexEn(Math.min(firstEmpty, targetCleanSize));
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
          const setCursor = l === 'es' ? setCursorIndexEs : setCursorIndexEn;
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
          setCursorIndexEs(firstIncorrectIdx);
        }
        setTimeout(() => setIsWrongEs(false), 1500);
      } else {
        setAttemptsEn(nextAttempts);
        setIsWrongEn(true);
        setIncorrectIndicesEn(currentIncorrectIndices);
        setSubmittedWrongCharsEn(wrongChars);
        if (firstIncorrectIdx !== -1) {
          setCursorIndexEn(firstIncorrectIdx);
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
          nextStage();
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
    
    const words = textContent.split(" ");
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const cleanTargetArr = getCleanLetters(textContent).split("");
    const isLangRevealed = isRevealed || (lang === 'es' ? didFailFlowEs : didFailFlowEn);
    let cleanLetterAccumulator = 0;
 
    return (
      <div className={`w-full font-serif select-none ${VERSE_LAYOUT.FONT_SIZE_CLASSES} ${VERSE_LAYOUT.FONT_WEIGHT} transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex flex-wrap justify-center content-start gap-y-4 sm:gap-y-6 gap-x-[0.5em] w-full max-w-4xl mx-auto px-4 sm:px-12">
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
                    if (lang === 'es') setCursorIndexEs(targetIdx);
                    else setCursorIndexEn(targetIdx);
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
                  
                  const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.25em] ${VERSE_LAYOUT.CHAR_HEIGHT} transition-all duration-300`;
                  
                  if (!isLetter) {
                    return (
                      <span 
                        key={charIdx} 
                        className={`${baseSlotClasses} text-earth/40 dark:text-ivory/40 cursor-text`}
                        onClick={(e) => {
                          if (stage === 5 && !isLangRevealed) {
                            e.stopPropagation();
                            if (!isCurrentActive) setActiveLanguage(lang);
                            
                            const targetIdx = getNearestCursorIndex(currentLetterIndex, lang);
                            if (lang === 'es') setCursorIndexEs(targetIdx);
                            else setCursorIndexEn(targetIdx);
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
                        <span className={`transition-all duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>{char}</span>
                        {isHidden && <span className="absolute bottom-1 left-0 right-0 h-[2px] bg-earth/10 dark:bg-white/10 rounded-full" />}
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
                          
                          if (lang === 'es') setCursorIndexEs(targetIdx);
                          else setCursorIndexEn(targetIdx);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className={`${baseSlotClasses} cursor-text transition-colors duration-200 ${
                          isRevealedByClue || userChar
                            ? isWrongChar ? 'text-coral' : isCorrect || isRevealedByClue ? 'text-teal' : 'text-playful-purple'
                            : 'text-transparent'
                        }`}
                      >
                        {isActiveSlot ? (
                          <motion.span 
                            animate={{ opacity: [0.45, 1, 0.45], scaleX: [0.92, 1.04, 0.92] }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-1 left-0 right-0 h-[3.5px] rounded-full bg-playful-purple shadow-[0_0_10px_rgba(151,71,255,0.85)] z-20"
                          />
                        ) : (
                          <span className={`absolute bottom-1 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                            isRevealedByClue || userChar
                              ? isWrongChar ? 'bg-coral' : isCorrect || isRevealedByClue ? 'bg-teal' : 'bg-playful-purple'
                              : 'bg-earth/10 dark:bg-white/10'
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
          <div className="w-40 h-40 bg-teal/10 dark:bg-teal/5 border border-teal/20 rounded-[48px] flex items-center justify-center shadow-2xl shadow-teal/5">
            <CheckCircle2 size={80} className="text-teal" strokeWidth={1.2} />
          </div>
        </div>

        <div className="space-y-4 px-6">
          <h2 className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory leading-tight">
            {state.primaryLanguage === 'es' ? '¡Versículo aprendido!' : 'Verse Learned!'}
          </h2>
          <div className="text-lg text-earth-light dark:text-lavender-muted font-medium max-w-md mx-auto space-y-4 px-4 py-6 bg-earth/[0.02] dark:bg-white/[0.02] rounded-3xl border border-earth/5 dark:border-white/5">
            <p className="font-serif leading-relaxed italic text-earth dark:text-ivory">
              "{state.memorizeMode === 'en' ? enText : (state.memorizeMode === 'es' ? esText : `${esText} / ${enText}`)}"
            </p>
            <p className="text-sm font-black uppercase tracking-widest text-teal dark:text-teal-400">
              {getLocalizedBookName(verse.book, state.primaryLanguage === 'es' ? 'es' : 'en')} {verse.chapter}:{verse.verse}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4 px-6">
          <button 
            onClick={() => {
              // Explicitly reset the memory progress for a clean repeat attempt
              localStorage.removeItem(`memorize_failed_${verse.id}`);
              try {
                localStorage.removeItem(attemptsKeyEs);
                localStorage.removeItem(attemptsKeyEn);
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
                const reference = `${verse.book} ${verse.chapter}:${verse.verse}`;
                const snapshot = {
                  verseId: verse.id,
                  reference,
                  translations: { ...s.selectedTranslations },
                  memorizeMode: s.memorizeMode,
                  verse: verse,
                  source: s.activeSource || "saved",
                  pathId: s.pathProgress.selectedPathId || s.customPathProgress.selectedPathId,
                  pathDay: s.activeSource === "path" ? (s.pathProgress.selectedPathId ? s.pathProgress.currentDay : s.customPathProgress.currentDay) : null,
                };
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
            className="btn-primary w-full flex items-center justify-center gap-3 py-5 shadow-teal/10"
          >
            <RotateCcw size={20} />
            <span className="text-lg font-bold tracking-tight lowercase">
              {state.primaryLanguage === 'es' ? 'repetir memorización' : 'repeat memorization'}
            </span>
          </button>
          
          <button 
            onClick={onComplete}
            className="w-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm rounded-full flex items-center justify-center gap-3 py-4 px-8 transition-all hover:scale-[1.01] active:scale-95 group"
          >
            <Sprout size={18} className="text-teal dark:text-teal-400" />
            <span className="font-bold tracking-tight lowercase">
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
          <motion.div 
            className={`w-40 h-40 ${isAnyPartFailed ? 'bg-sky-blue/10 dark:bg-sky-blue/5' : 'bg-playful-purple/10 dark:bg-plum/10'} rounded-[48px] flex items-center justify-center shadow-2xl ${isAnyPartFailed ? 'shadow-sky-blue/10' : 'shadow-playful-purple/10'}`}
            animate={{ 
              scale: [1, 1.05, 1],
              y: [0, -5, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {isAnyPartFailed ? (
              <BookOpen size={80} className="text-sky-blue" fill="none" strokeWidth={1.5} />
            ) : (
              <Sprout size={80} className="text-teal-600 dark:text-teal-400" fill="none" strokeWidth={1.5} />
            )}
          </motion.div>
          
          {/* Animated Stars - Only for success */}
          {!isAnyPartFailed && [...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                x: Math.cos(i * 72 * Math.PI / 180) * 100,
                y: Math.sin(i * 72 * Math.PI / 180) * 100,
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.2 }}
            >
              <Star size={20} className="text-playful-purple/40 dark:text-plum/40" fill="currentColor" />
            </motion.div>
          ))}
        </div>

        <div className="space-y-4 px-6">
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory leading-tight text-center"
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
            className="text-lg text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto"
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
              className="text-sm font-black text-teal dark:text-teal-400 uppercase tracking-widest mt-4"
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
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={() => onGoToFlashcards?.(verse.id)} 
                  className="w-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm rounded-full flex items-center justify-center gap-3 py-4 px-8 hover:scale-[1.01] active:scale-95 transition-all group"
                >
                  <Layers size={20} className="text-teal dark:text-teal-400" />
                  <span className="text-sm sm:text-base font-bold tracking-tight lowercase">
                    {state.primaryLanguage === 'es' ? 'Reto: Cita bíblica' : 'Challenge: Citation'}
                  </span>
                </motion.button>
                
                <motion.button 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  onClick={() => setShowAbandonConfirm(true)}
                  className="text-xs font-black uppercase tracking-[0.2em] text-coral/60 hover:text-coral transition-colors py-2 flex items-center gap-2 group"
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
                        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-md"
                        onClick={() => setShowAbandonConfirm(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-sm bg-white dark:bg-charcoal rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 p-8 space-y-6 z-10"
                      >
                        <div className="space-y-3 text-center">
                          <div className="w-16 h-16 bg-coral/10 rounded-2xl flex items-center justify-center text-coral mx-auto mb-4">
                            <AlertCircle size={28} />
                          </div>
                          <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                            {state.primaryLanguage === 'es' ? "¿Abandonar reto?" : "Abandon challenge?"}
                          </h3>
                          <p className="text-xs font-semibold text-earth-light dark:text-lavender-muted leading-relaxed text-center">
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
                            className="w-full h-14 bg-coral text-white hover:bg-coral/90 rounded-3xl font-black uppercase tracking-widest text-xs transition-colors shadow-md shadow-coral/10 animate-none"
                          >
                            {state.primaryLanguage === 'es' ? "Sí, abandonar" : "Yes, abandon"}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShowAbandonConfirm(false)}
                            className="w-full h-14 bg-earth/5 dark:bg-white/5 hover:bg-earth/10 dark:hover:bg-white/10 text-earth-light dark:text-ivory rounded-3xl font-black uppercase tracking-widest text-xs transition-colors animate-none"
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
                className="w-full bg-teal text-white hover:bg-teal-600 rounded-full flex items-center justify-center gap-3 py-4 px-8 shadow-lg shadow-teal/20 hover:scale-[1.01] active:scale-95 transition-all group"
              >
                <RotateCcw size={18} />
                <span className="text-sm sm:text-base font-bold tracking-tight lowercase">
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
          <motion.div 
            className={`w-40 h-40 ${currentPassFailed ? 'bg-sky-blue/10 dark:bg-sky-blue/5' : 'bg-teal/10'} rounded-[48px] flex items-center justify-center shadow-2xl ${currentPassFailed ? 'shadow-sky-blue/5' : 'shadow-teal/5'}`}
            animate={{ 
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {currentPassFailed ? (
              <BookOpen size={80} className="text-sky-blue" fill="none" strokeWidth={1.5} />
            ) : (
              <Trophy size={80} className="text-teal" fill="currentColor" />
            )}
          </motion.div>
        </div>

        <div className="space-y-4 px-8">
          <h2 className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory leading-tight">
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
              <p className="text-xl font-bold text-playful-purple dark:text-plum">
                {state.primaryLanguage === 'es' 
                  ? 'Ya casi. Un idioma completado.' 
                  : 'Almost there. One language down.'}
              </p>
            )}
            <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto leading-relaxed animate-pulse">
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
              onClick={handleHalfwayContinue}
              className="w-full bg-playful-purple text-white rounded-[24px] py-5 font-bold shadow-xl shadow-playful-purple/20 hover:scale-[1.02] active:scale-95 transition-all lowercase"
            >
              {state.primaryLanguage === 'es' ? 'continuar' : 'continue'}
            </button>
          ) : (
            <button 
              onClick={reset}
              className="w-full bg-teal text-white rounded-[24px] py-5 font-bold shadow-xl shadow-teal/20 hover:scale-[1.02] active:scale-95 transition-all lowercase"
            >
              {state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div id="memorize-content" className="flex-1 flex flex-col pt-4 pb-6 sm:pb-12">
      {/* Top Section - Premium Header (Refined Size) */}
      <div className="px-6 sm:px-12 mb-4 sm:mb-10 flex-shrink-0">
        <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-gold animate-pulse" />
              <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-amber-600 dark:text-gold leading-none">
                {state.primaryLanguage === 'es' ? 'MEMORIZA' : 'MEMORIZE'}
              </span>
            </div>
            
            {state.memorizeMode === 'both' && (
              <span className="inline-flex items-center justify-center bg-teal/10 dark:bg-teal/20 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full text-teal dark:text-teal-400 border border-teal/20">
                {activeLanguage === 'es' 
                  ? (state.primaryLanguage === 'es' ? 'Español' : 'Spanish')
                  : (state.primaryLanguage === 'es' ? 'Inglés' : 'English')}
              </span>
            )}
          </div>
          
          <div className="flex flex-row items-center justify-between gap-4 w-full">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight whitespace-nowrap">
              {getLocalizedBookName(verse.book, state.primaryLanguage === 'es' ? 'es' : 'en')} {verse.chapter}:{verse.verse}
            </h2>
            
            {/* Progress Indicator */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/30">
                {state.primaryLanguage === 'es' ? 'Paso' : 'Step'}
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl sm:text-2xl font-serif font-black text-amber-600 dark:text-amber-200/90 lining-nums">{Math.min(5, stage)}</span>
                <span className="text-xs text-earth-light/40 dark:text-ivory/20 font-black">/ 5</span>
              </div>
            </div>
          </div>
          
          <motion.p 
            key={`${stage}-${state.primaryLanguage}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm sm:text-base text-earth-light/70 dark:text-lavender-muted/70 font-medium tracking-tight antialiased"
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
        
        {/* Dotted Progress Indicator - Organic Seed Trail */}
        <div className="w-full flex justify-center items-center pt-4 pb-3 sm:pt-10 sm:pb-8 overflow-hidden">
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
                              ? "bg-amber-500/30 dark:bg-amber-200/10 shadow-[0_0_8px_rgba(251,191,36,0.1)]" 
                              : isActive 
                                ? "bg-amber-600 dark:bg-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.4)]" 
                                : "bg-earth-light/20 dark:bg-white/10"
                          }`
                        : `w-1 h-1 ${
                            isCompleted 
                              ? "bg-amber-500/10 dark:bg-amber-100/5" 
                              : "bg-earth-light/20 dark:bg-white/5"
                          }`
                    }`}
                  />
                  
                  {/* Subtle active pulse for current main node */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-amber-500/20 dark:bg-amber-200/40"
                      initial={{ opacity: 0, scale: 1 }}
                      animate={{ opacity: [0, 0.4, 0], scale: [1, 2.5, 3] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}

                  {/* Seed glow for completed trail */}
                  {isCompleted && !isMainNode && i % 2 === 0 && (
                    <motion.div 
                      className="absolute inset-0 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-[2px]"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.1 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Verse Card Wrapper */}
      <div className="flex-1 flex flex-col items-center px-4 sm:px-12 w-full max-w-5xl mx-auto mb-4">
        <div 
          id="memorize-verse-card"
          className="shimmer-border w-full rounded-[40px] bg-white dark:bg-charcoal shadow-2xl relative overflow-visible"
        >
          {/* Card Body - DYNAMIC BUT STABLE HEIGHT */}
          <div 
            ref={cardRef}
            style={cardHeight ? { height: `${cardHeight}px`, minHeight: isMobile ? '320px' : '520px' } : { height: 'auto', minHeight: isMobile ? '320px' : '520px' }}
            className="w-full flex flex-col items-center relative bg-white dark:bg-charcoal border-none rounded-[40px] overflow-visible transition-[height] duration-500 ease-in-out"
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
                value={inputValue}
                onKeyDown={(e) => {
                  const cursor = activeLanguage === 'es' ? cursorIndexEs : cursorIndexEn;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEs : setCursorIndexEn;
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
                onChange={(e) => {
                  const val = e.target.value;
                  const cursor = activeLanguage === 'es' ? cursorIndexEs : cursorIndexEn;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEs : setCursorIndexEn;
                  const text = activeLanguage === 'es' ? esText : enText;
                  const targetCleanLen = activeLanguage === 'es' ? esTextCleanLen : enTextCleanLen;
                  const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
                  const userInput = activeLanguage === 'es' ? userInputEs : userInputEn;
                  
                  // Reset "submitted" state if user starts interaction
                  if (hasSubmitted) {
                    if (activeLanguage === 'es') {
                      setHasSubmittedEs(false);
                      setIsWrongEs(false);
                    } else {
                      setHasSubmittedEn(false);
                      setIsWrongEn(false);
                    }
                  }

                  // Detect addition
                  if (val.length > 1) {
                    const char = val.charAt(val.length - 1);
                    
                    if (char.trim() === "") {
                      const nextWordStart = findNextEditableWordStart(cursor, activeLanguage);
                      if (nextWordStart !== -1) {
                        setCursor(nextWordStart);
                      }
                      setInputValue(" ");
                      return;
                    }
                    
                    const cleanLen = targetCleanLen;
                    if (cursor < cleanLen && isEditable(cursor, activeLanguage)) {
                      // Update state
                      setter(prev => {
                        const nextArr = [...prev];
                        nextArr[cursor] = char;
                        return nextArr;
                      });

                      // Reset error state for ONLY this slot
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

                      // Advance cursor to next editable
                      let next = cursor + 1;
                      while (next < cleanLen && !isEditable(next, activeLanguage)) {
                        next++;
                      }
                      setCursor(Math.min(next, cleanLen));
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
                  setInputValue(" ");
                }}
                className="absolute opacity-0 inset-0 w-full h-full cursor-default caret-transparent text-transparent outline-none border-none select-none bg-transparent shadow-none"
                autoFocus
              />
            )}

            {/* Header Area - Translation Label (Absolute Anchored) */}
            <div className="absolute top-8 sm:top-12 left-0 right-0 flex justify-center z-30">
              <motion.div 
                key={`${activeLanguage}-${state.selectedTranslations.es}-${state.selectedTranslations.en}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 opacity-40 dark:opacity-30"
              >
                <div className="h-px w-6 bg-earth-light/30 dark:bg-white/20" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-earth dark:text-lavender-muted">
                  {activeLanguage === 'es' ? (activePair?.es || 'RVR1960') : (activePair?.en || 'KJV')}
                </span>
                <div className="h-px w-6 bg-earth-light/30 dark:bg-white/20" />
              </motion.div>
            </div>

            {/* Body Area - Verse Content (Centered with Padding for Fixed HUD) */}
            <div className="w-full flex-1 flex flex-col items-center justify-center pt-16 pb-32 sm:pt-24 sm:pb-44 px-6 sm:px-12 overflow-visible relative">
              <div className="w-full max-w-4xl relative">
                {activeLanguage === 'es' 
                  ? renderVerseContent(esText, userInputEs, 'es', true)
                  : renderVerseContent(enText, userInputEn, 'en', true)
                }
              </div>
            </div>

            {/* Footer Area - Utility Controls (Absolute Anchored Inside Card) */}
            <div className="absolute bottom-8 sm:bottom-12 left-0 right-0 flex justify-center z-30 pointer-events-none">
              <div className="flex items-center justify-center gap-6 sm:gap-10 bg-earth/[0.04] dark:bg-white/[0.04] px-7 sm:px-12 py-3 sm:py-4 rounded-full border border-earth/5 dark:border-white/5 backdrop-blur-xl pointer-events-auto">
                
                {/* Pista/Clue Slot - Stable width for symmetry */}
                <div className="min-w-[85px] sm:min-w-[115px] flex justify-end">
                  <div className={`transition-all duration-500 transform ${
                    canShowClue 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 translate-y-1 scale-95 pointer-events-none'
                  }`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleClue(activeLanguage); }}
                      disabled={!canUseClue}
                      className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-teal/10 dark:bg-teal-400/10 border border-teal/20 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-teal dark:text-teal-400 shadow-sm hover:bg-teal/20 transition-all active:scale-95 disabled:opacity-20 disabled:grayscale"
                    >
                      <Sparkles size={14} className={activeClueCount >= 1 ? '' : 'text-amber-500/80 animate-pulse'} />
                      <span className="whitespace-nowrap">{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}</span>
                    </button>
                  </div>
                </div>

                {/* Stable Vertical Divider */}
                <div className="w-px h-6 bg-earth/10 dark:bg-white/10" />

                {/* Eye/Reveal Slot - Stable width for symmetry */}
                <div className="min-w-[85px] sm:min-w-[115px] flex justify-start">
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
                    className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center shadow-md active:scale-90 select-none ${
                      stage === 5
                        ? 'bg-transparent border-earth/5 dark:border-white/5 text-earth/10 dark:text-ivory/10 cursor-not-allowed pointer-events-none opacity-40'
                        : isRevealed 
                          ? 'bg-playful-purple text-white border-playful-purple scale-110 shadow-lg shadow-playful-purple/20' 
                          : 'bg-white dark:bg-charcoal text-earth/40 dark:text-ivory/40 border-earth/10 dark:border-white/10 hover:text-playful-purple hover:border-playful-purple/30'
                    }`}
                  >
                    {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM NAVIGATION AREA - CLEAN & INTEGRATED */}
      <div 
        className="w-full flex-shrink-0 px-6 sm:px-12 pb-6 sm:pb-8 pt-4 relative z-10"
      >
        {/* Feedback Area (Reserved: 16/20) */}
        <div className={`w-full flex items-center justify-center mb-1 overflow-hidden transition-[height] duration-300 ${stage === 5 && feedback ? 'h-12' : 'h-0'}`}>
          <AnimatePresence mode="wait">
            {stage === 5 && feedback ? (
              <motion.div 
                key={feedback}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-3 bg-white dark:bg-charcoal px-6 py-2 rounded-full border border-playful-purple/20 dark:border-plum/20 shadow-xl"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${isCorrect ? 'bg-teal animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-coral shadow-[0_0_8px_rgba(255,111,97,0.5)]'}`} />
                <span className={`text-[11px] sm:text-sm font-black uppercase tracking-widest ${isCorrect ? 'text-teal' : 'text-coral'}`}>
                  {feedback}
                </span>
                {!isCorrect && (
                  <span className="text-[10px] font-black text-earth/30 dark:text-white/20 lowercase">
                    ({attempts}/3)
                  </span>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Action Controls - Balanced & Outlined Circular Buttons */}
        <div className="w-full max-w-2xl mx-auto flex items-center justify-center gap-6 sm:gap-10">
          <AnimatePresence mode="popLayout" initial={false}>
            {/* Back Button */}
            {stage > 1 && (
              <motion.button 
                key="back-nav"
                onClick={stage === 5 ? undefined : prevStage}
                disabled={stage === 5}
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                whileHover={stage === 5 ? {} : { scale: 1.05 }}
                whileTap={stage === 5 ? {} : { scale: 0.95 }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shadow-sm group relative ${
                  stage === 5 
                    ? 'bg-earth/5 dark:bg-white/5 border-earth/10 dark:border-white/10 text-earth-light/20 dark:text-ivory/20 cursor-not-allowed'
                    : 'bg-white dark:bg-charcoal text-playful-purple dark:text-plum border-2 border-playful-purple/30 dark:border-plum/30 hover:bg-playful-purple/5 hover:border-playful-purple'
                }`}
                aria-label="Back"
              >
                <ArrowLeft size={24} strokeWidth={2.5} className={stage === 5 ? '' : "group-hover:-translate-x-0.5 transition-transform"} />
                {/* Subtle back ring */}
                {stage !== 5 && (
                  <motion.div 
                    className="absolute inset-0 rounded-full border border-playful-purple/10"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                )}
              </motion.button>
            )}

            {/* Main Action (Next/Check) */}
            <motion.button 
              key="main-action"
              layout
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
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center group shadow-xl transition-all relative ${
                stage === 5 
                  ? (isStepComplete ? 'border-2 border-teal text-teal bg-teal/5' : (hasSubmitted && isWrong && attempts < 3 ? 'border-2 border-coral text-coral bg-coral/5' : 'border-2 border-playful-purple text-playful-purple bg-transparent'))
                  : 'border-2 border-playful-purple text-playful-purple bg-transparent'
              }`}
            >
              <ArrowRight size={28} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
              
              {/* Pulsing Ring Animation */}
              <motion.div 
                className={`absolute -inset-1.5 rounded-full border-2 opacity-20 pointer-events-none ${
                  stage === 5 && isStepComplete ? 'border-teal' : 'border-playful-purple'
                }`}
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.1, 0.3, 0.1]
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.button>
          </AnimatePresence>
        </div>

        {/* Pagination Dots (Reserved) */}
        <div className="h-8 flex justify-center items-center gap-4 mt-4">
          {[1, 2, 3, 4, 5].map(s => (
            <div 
              key={s} 
              className={`h-1.5 rounded-full transition-all duration-700 ${
                s === stage 
                  ? 'w-10 bg-playful-purple dark:bg-plum shadow-[0_0_15px_rgba(151,71,255,0.4)]' 
                  : s < stage 
                    ? 'w-2 bg-teal shadow-[0_0_10px_rgba(20,184,166,0.3)]' 
                    : 'w-2 bg-earth/20 dark:bg-white/10'
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
