import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Verse, Translation } from "../types";
import { loadVerseAndMerge } from "../services/bibleService";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, BookOpen, Brain, HelpCircle, Trophy, Star, Bookmark, CheckCircle2, ArrowRight, Flower2, Sprout, Compass, Layers, Grape, Lock } from "lucide-react";
import { getValidatedVerse, getCurrentTranslationPair, getLocalizedBookName, getLocalDateString, getVerseLines, removeAccents, VERSE_LAYOUT } from "../utils/verseUtils";
import confetti from "canvas-confetti";

interface FlashcardsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onMemorize: (verseId: string) => void;
  onRestartMemorization?: (verseId: string) => void;
  onGoToSaved?: () => void;
  onComplete?: () => void;
}

export default function Flashcards({ state, setState, onMemorize, onRestartMemorization, onGoToSaved, onComplete }: FlashcardsProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [clueCount, setClueCount] = useState<{ es: number, en: number }>({ es: 0, en: 0 });
  const [revealedIndices, setRevealedIndices] = useState<{ es: number[], en: number[] }>({ es: [], en: [] });
  const [activeLanguage, setActiveLanguage] = useState<'es' | 'en' | null>(null);
  const [cursorPositionEs, setCursorPositionEs] = useState<number>(0);
  const [cursorPositionEn, setCursorPositionEn] = useState<number>(0);
  const [isCorrect, setIsCorrect] = useState(() => {
    return !!state.activeAttempt?.citationCorrect;
  });
  const [showError, setShowError] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(() => {
    return !!state.activeAttempt?.citationCorrect;
  });
  const [hasReviewed, setHasReviewed] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  // Inline, supportive feedback describing the most recent clue action. Cleared
  // on the next user edit/submit/reset/verse change. Not a toast.
  const [clueFeedback, setClueFeedback] = useState<'revealed' | 'check-first' | 'corrected' | null>(null);

  const inputRefEs = React.useRef<HTMLInputElement>(null);
  const inputRefEn = React.useRef<HTMLInputElement>(null);

  const cursorPositionEsRef = React.useRef(0);
  const cursorPositionEnRef = React.useRef(0);

  useEffect(() => {
    cursorPositionEsRef.current = cursorPositionEs;
  }, [cursorPositionEs]);

  useEffect(() => {
    cursorPositionEnRef.current = cursorPositionEn;
  }, [cursorPositionEn]);

  // Clear errors on any input change
  useEffect(() => {
    if (hasSubmitted || showError) {
      const handleGlobalClick = () => {
        setHasSubmitted(false);
        setShowError(false);
      };
      window.addEventListener('keydown', handleGlobalClick);
      return () => window.removeEventListener('keydown', handleGlobalClick);
    }
  }, [hasSubmitted, showError]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const today = getLocalDateString();
  const votd = getVerseByDate(today);

  // Unified Active Verse Logic
  let verse: Verse;
  if (state.activeAttempt?.verse) {
    verse = state.activeAttempt.verse;
  } else if (state.activeSource === "custom" && state.selectedCustomVerse) {
    verse = state.selectedCustomVerse;
  } else if (state.selectedVerseId) {
    const fromMock = MOCK_VERSES.find(v => v.id === state.selectedVerseId);
    const fromCustomList = state.customVerses.find(v => v.id === state.selectedVerseId);
    
    if (fromMock) {
      verse = fromMock;
    } else if (fromCustomList) {
      verse = fromCustomList;
    } else {
      // Check custom paths
      let foundInPath: Verse | null = null;
      for (const path of state.customPaths) {
        const vData = path.verses.find(v => v.id === state.selectedVerseId);
        if (vData) {
          foundInPath = {
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
      verse = foundInPath || votd;
    }
  } else {
    verse = votd;
  }

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

  // Restore the active-attempt snapshot if it was lost (e.g. after a language
  // switch) while a genuinely in-progress challenge remains. The App
  // navigation/settings guard relies solely on activeAttempt, so a missing
  // snapshot would let the user bypass the "challenge in progress" warning while
  // sitting on the citation step. We only restore for verses that have advanced
  // past step 1 (stage >= 2) and are not completed (stage 7), mirroring the
  // snapshot shape used when a challenge is first started. This only adds
  // activeAttempt; it never downgrades stage or touches citation state.
  useEffect(() => {
    if (state.activeAttempt) return;
    const dbStage = state.progress.verseStages?.[verse.id];
    if (dbStage === undefined || dbStage < 2 || dbStage > 6) return;
    setState(s => {
      if (s.activeAttempt) return s;
      const liveStage = s.progress.verseStages?.[verse.id];
      if (liveStage === undefined || liveStage < 2 || liveStage > 6) return s;
      const reference = `${verse.book} ${verse.chapter}:${verse.verse}`;
      return {
        ...s,
        activeAttempt: {
          verseId: verse.id,
          reference,
          translations: { ...s.selectedTranslations },
          memorizeMode: s.memorizeMode,
          verse,
          source: s.activeSource || "saved",
          pathId: s.pathProgress.selectedPathId || s.customPathProgress.selectedPathId,
          pathDay: s.activeSource === "path" ? (s.pathProgress.selectedPathId ? s.pathProgress.currentDay : s.customPathProgress.currentDay) : null,
        },
      };
    });
  }, [verse.id, state.activeAttempt, state.progress.verseStages, state.memorizeMode, setState]);

  const { esText, enText, activePair } = useMemo(() =>
    getValidatedVerse(verse, state),
    [verse, state, state.selectedTranslations.es, state.selectedTranslations.en]
  );

  const isEligible = useMemo(() => {
    return state.progress.verseStages?.[verse.id] === 6;
  }, [state.progress.verseStages, verse.id]);

  // Reset state when verse or configuration changes
  useEffect(() => {
    setIsFlipped(false);
    setIsCompleted(false);
    setClueCount({ es: 0, en: 0 });
    setRevealedIndices({ es: [], en: [] });
    setActiveLanguage(null);
    setCursorPositionEs(0);
    setCursorPositionEn(0);
    setIsCorrect(!!state.activeAttempt?.citationCorrect);
    setShowError(false);
    setHasSubmitted(!!state.activeAttempt?.citationCorrect);
    setHasReviewed(false);
    setAttemptsLeft(localStorage.getItem(`citation_failed_${verse.id}`) === 'true' ? 0 : 2);
    setClueFeedback(null);
  }, [verse.id, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode, state.activeAttempt?.citationCorrect]);

  // Autofocus the appropriate hidden input for citation challenges when eligible and ready
  useEffect(() => {
    if (isEligible && !isCorrect && !isCompleted && !isFlipped && attemptsLeft > 0) {
      const isEnOnly = state.memorizeMode === 'en';
      const refToFocus = isEnOnly ? inputRefEn : inputRefEs;
      const targetLang = isEnOnly ? 'en' : 'es';
      
      const timer = setTimeout(() => {
        if (refToFocus.current) {
          refToFocus.current.focus();
          setActiveLanguage(targetLang);
          const currentCursor = targetLang === 'es' ? cursorPositionEsRef.current : cursorPositionEnRef.current;
          refToFocus.current.setSelectionRange(currentCursor, currentCursor + 1);
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [verse.id, isEligible, isCorrect, isCompleted, isFlipped, attemptsLeft, state.memorizeMode]);

  useEffect(() => {
    const isFailedSession = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    if (isCompleted && !isFailedSession) {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      // Richer blue/teal palette for "full bloom" water
      const colors = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#0d9488'];

      const frame = () => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) return;

        // More intense particle count for final bloom
        const particleCount = 25 * (timeLeft / duration);
        
        confetti({
          particleCount,
          startVelocity: 35,
          spread: 360,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: colors,
          shapes: ['circle'],
          gravity: 0.7,
          scalar: Math.random() * 0.5 + 0.5,
          drift: 0,
          ticks: 150
        });

        requestAnimationFrame(frame);
      };
      
      frame();
    }
  }, [isCompleted, verse.id]);

  const onFlip = () => {
    if (isFlipped && (isCorrect || attemptsLeft === 0)) {
      setHasReviewed(true);
    }
    setIsFlipped(!isFlipped);
  };

  const handleComplete = () => {
    // Is Completed/Celebration guard - prevent duplicate execution or counting
    if (isCompleted) return;

    const globalStage = state.progress.verseStages?.[verse.id];
    if (globalStage === 7) {
      setIsCompleted(true);
      return;
    }

    setIsCompleted(true);
    
    const isFailedSession = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    
    if (!isFailedSession) {
      const today = getLocalDateString();
      
      // Mark as completed in global state
      setState(s => {
        // Double defense: if global state has already finalized, return s
        if (s.progress.verseStages?.[verse.id] === 7) {
          return s;
        }

        const isAlreadyCompleted = s.progress.completedVerses.includes(verse.id);
        const today = getLocalDateString();
        let newLastCompletedDailyVerseDate = s.progress.lastCompletedDailyVerseDate;

        // Track if this was the daily verse
        if (verse.id === votd.id) {
          newLastCompletedDailyVerseDate = today;
        }

        // Handle completion counts (combined lifetime total; drives growth/fruit)
        const currentCounts = s.progress.completionCounts || {};
        const oldVal = currentCounts[verse.id] !== undefined ? currentCounts[verse.id] : (isAlreadyCompleted ? 1 : 0);
        const newCounts = {
          ...currentCounts,
          [verse.id]: oldVal + 1
        };

        // Determine the language(s) genuinely completed in this session. The
        // memorize/citation flow requires every selected language to be
        // completed to reach this point, so memorizeMode is a faithful record:
        // 'both' proves one English AND one Spanish completion.
        const mode = s.memorizeMode; // 'es' | 'en' | 'both'
        const completedLangs: ('en' | 'es')[] =
          mode === 'both' ? ['en', 'es'] : [mode];
        const pair = s.selectedTranslations; // { es, en }

        // Per-language counts: increment only the completed language(s).
        const prevLang = s.progress.completionsByLanguage?.[verse.id] || { en: 0, es: 0 };
        const newLang = {
          en: prevLang.en + (completedLangs.includes('en') ? 1 : 0),
          es: prevLang.es + (completedLangs.includes('es') ? 1 : 0),
        };

        // Per-translation counts: increment the translation actually used for
        // each completed language.
        const newTrans: Partial<Record<Translation, number>> = {
          ...(s.progress.completionsByTranslation?.[verse.id] || {}),
        };
        // Last completed translation per completed language.
        const newLastTrans: { es?: Translation; en?: Translation } = {
          ...(s.progress.lastCompletedTranslation?.[verse.id] || {}),
        };
        for (const lang of completedLangs) {
          const t = pair[lang];
          newTrans[t] = (newTrans[t] || 0) + 1;
          newLastTrans[lang] = t;
        }

        return {
          ...s,
          activeAttempt: null,
          progress: {
            ...s.progress,
            totalMemorized: isAlreadyCompleted ? s.progress.totalMemorized : s.progress.totalMemorized + 1,
            completedVerses: isAlreadyCompleted ? s.progress.completedVerses : [...s.progress.completedVerses, verse.id],
            completionCounts: newCounts,
            completionsByLanguage: {
              ...(s.progress.completionsByLanguage || {}),
              [verse.id]: newLang
            },
            completionsByTranslation: {
              ...(s.progress.completionsByTranslation || {}),
              [verse.id]: newTrans
            },
            lastCompletedLanguage: {
              ...(s.progress.lastCompletedLanguage || {}),
              [verse.id]: mode
            },
            lastCompletedTranslation: {
              ...(s.progress.lastCompletedTranslation || {}),
              [verse.id]: newLastTrans
            },
            lastCompletedDailyVerseDate: newLastCompletedDailyVerseDate,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 7
            }
          }
        };
      });

      // Clear the failures so we don't carry stale state over
      localStorage.removeItem(`memorize_failed_${verse.id}`);

      // Notify parent if completion handler exists
      if (onComplete) onComplete();
    }
  };

  const showBilingual = state.memorizeMode === 'both';

  // Resolve book names for the challenge language, handling both bilingual ("Juan / John") and single-language ("Filipenses") formats
  const [esBook, enBook] = useMemo(() => {
    return [
      getLocalizedBookName(verse.book, 'es'),
      getLocalizedBookName(verse.book, 'en'),
    ];
  }, [verse.book]);

  const esRef = `${esBook} ${verse.chapter}:${verse.verse}`;
  const enRef = `${enBook} ${verse.chapter}:${verse.verse}`;

  const [userInputEs, setUserInputEs] = useState("");
  const [userInputEn, setUserInputEn] = useState("");
  
  // Initialize user inputs with spaces when verse or mode changes
  useEffect(() => {
    const esTarget = isCorrect || state.activeAttempt?.citationCorrect
      ? getTargetChars(esRef, [])
      : getTargetChars(esRef, revealedIndices.es);
    const enTarget = isCorrect || state.activeAttempt?.citationCorrect
      ? getTargetChars(enRef, [])
      : getTargetChars(enRef, revealedIndices.en);
    
    if (isCorrect || state.activeAttempt?.citationCorrect) {
      setUserInputEs(esTarget);
      setUserInputEn(enTarget);
    } else {
      setUserInputEs(" ".repeat(esTarget.length));
      setUserInputEn(" ".repeat(enTarget.length));
    }
  }, [verse.id, state.memorizeMode, isCorrect, state.activeAttempt?.citationCorrect]);

  const handleReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped(false);
    setClueCount({ es: 0, en: 0 });
    setRevealedIndices({ es: [], en: [] });
    setActiveLanguage(null);
    setCursorPositionEs(0);
    setCursorPositionEn(0);
    setUserInputEs("");
    setUserInputEn("");
    setIsCorrect(false);
    setShowError(false);
    setHasSubmitted(false);
    setHasReviewed(false);
    setAttemptsLeft(2);
    setClueFeedback(null);
  };

  const normalize = (str: string) => {
    return removeAccents(str)
      .toLowerCase()
      .trim();
  };

  // The clue is available while a clue remains and the challenge is active. The
  // button stays usable even when every slot is filled so it can guide the user
  // (reveal an empty slot, ask them to Check, or correct one wrong slot after a
  // failed submission). The specific action is decided inside handleClue.
  const hasClueEsAvailable = useMemo(() => {
    return clueCount.es < 1 && !isCorrect && !isCompleted && attemptsLeft > 0;
  }, [clueCount.es, isCorrect, isCompleted, attemptsLeft]);

  const hasClueEnAvailable = useMemo(() => {
    return clueCount.en < 1 && !isCorrect && !isCompleted && attemptsLeft > 0;
  }, [clueCount.en, isCorrect, isCompleted, attemptsLeft]);

  // Citation clue logic (Cards only): exactly 1 useful clue per language.
  // CASE 1 — at least one empty slot: reveal/lock one correct empty character.
  // CASE 2 — every slot filled but not yet submitted: do nothing and ask the
  //          user to Check first (no clue consumed).
  // CASE 4 — every slot filled and previously submitted wrong: correct exactly
  //          one identified incorrect slot, keeping other wrong marks; require a
  //          fresh Check. Never auto-submits or completes the card.
  const handleClue = (e: React.MouseEvent, lang: 'es' | 'en') => {
    e.stopPropagation();
    const inputRef = lang === 'es' ? inputRefEs : inputRefEn;
    if (clueCount[lang] >= 1 || isCorrect || isCompleted || attemptsLeft === 0) {
      inputRef.current?.focus();
      return;
    }

    const ref = lang === 'es' ? esRef : enRef;
    const fillableIndices = getFillableIndices(ref, revealedIndices[lang]);
    const n = fillableIndices.length;
    const arr = padToSlots((lang === 'es' ? userInputEsRef : userInputEnRef).current, n);

    // Classify each editable slot against its canonical character.
    const emptyGlobal: number[] = [];
    const wrongGlobal: number[] = [];
    fillableIndices.forEach((globalIdx, fillIdx) => {
      const uc = arr[fillIdx];
      if (!uc || uc === ' ') emptyGlobal.push(globalIdx);
      else if (normalize(uc) !== normalize(ref[globalIdx])) wrongGlobal.push(globalIdx);
    });

    // Prioritize book letters over chapter/verse digits when picking a slot.
    const parts = ref.split(' ');
    const numbersPart = parts[parts.length - 1];
    const numberStartIdx = ref.lastIndexOf(numbersPart);
    const pick = (pool: number[]): number => {
      const letters = pool.filter(idx => idx < numberStartIdx && /[\p{L}]/u.test(ref[idx]));
      const digits = pool.filter(idx => idx >= numberStartIdx && /[\p{N}]/u.test(ref[idx]));
      const chosenPool = letters.length > 0 ? letters : (digits.length > 0 ? digits : pool);
      return chosenPool[Math.floor(Math.random() * chosenPool.length)];
    };

    // CASE 1: reveal/lock one correct empty character.
    if (emptyGlobal.length > 0) {
      const chosenGlobal = pick(emptyGlobal);
      const removedFillIdx = fillableIndices.indexOf(chosenGlobal);

      const newArr = arr.slice();
      if (removedFillIdx !== -1) newArr.splice(removedFillIdx, 1);
      writeUserInput(lang, newArr.join(''));

      const newRevealed = { ...revealedIndices };
      newRevealed[lang] = [...newRevealed[lang], chosenGlobal].sort((a, b) => a - b);
      setRevealedIndices(newRevealed);

      const newN = Math.max(0, n - 1);
      const cur = (lang === 'es' ? cursorPositionEsRef : cursorPositionEnRef).current;
      const shifted = cur > removedFillIdx ? cur - 1 : cur;
      writeCursor(lang, Math.min(Math.max(0, shifted), Math.max(0, newN - 1)));

      setClueCount(prev => ({ ...prev, [lang]: prev[lang] + 1 }));
      setClueFeedback('revealed');
      inputRef.current?.focus();
      return;
    }

    // CASE 2: every slot is filled but the current answer has not been submitted.
    // Do not change anything and do not consume the clue — guide them to Check
    // so the existing validation can identify the incorrect slots.
    if (!hasSubmitted) {
      setClueFeedback('check-first');
      inputRef.current?.focus();
      return;
    }

    // CASE 4: filled and previously submitted wrong. Replace exactly one
    // identified incorrect slot with its correct character; other incorrect
    // marks are preserved. The user must Check again. No auto-submit/complete.
    if (wrongGlobal.length > 0) {
      const chosenGlobal = pick(wrongGlobal);
      const fillIdx = fillableIndices.indexOf(chosenGlobal);
      const corrected = arr.slice();
      if (fillIdx !== -1) corrected[fillIdx] = ref[chosenGlobal];
      writeUserInput(lang, corrected.join(''));
      setClueCount(prev => ({ ...prev, [lang]: prev[lang] + 1 }));
      setClueFeedback('corrected');
      inputRef.current?.focus();
      return;
    }

    // Fallback (filled + submitted but no incorrect slot found): nudge to Check.
    setClueFeedback('check-first');
    inputRef.current?.focus();
  };

  function getFillableIndices(ref: string, revealed: number[]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < ref.length; i++) {
      const char = ref[i];
      // Check if it's a letter or number
      if (/[\p{L}\p{N}]/u.test(char) && !revealed.includes(i)) {
        indices.push(i);
      }
    }
    return indices;
  }

  const handleCharClick = (lang: 'es' | 'en', fillIdx: number) => {
    if (isCorrect || attemptsLeft === 0 || isFlipped) return;

    const n = slotCountFor(lang);
    writeCursor(lang, Math.min(Math.max(0, fillIdx), Math.max(0, n - 1)));
    setActiveLanguage(lang);

    const inputRef = lang === 'es' ? inputRefEs : inputRefEn;
    inputRef.current?.focus();
  };

  const renderPlaceholder = (ref: string, revealed: number[], userInput: string, lang: 'es' | 'en') => {
    const fillableIndices = getFillableIndices(ref, revealed);
    const words = ref.split(' ');
    
    // Find book vs number parts
    // Typically: "Book Name 1:1"
    // Everything before the last part is book name
    const bookParts = words.slice(0, -1);
    const numberPart = words[words.length - 1];
    
    let charIndexBook = 0;
    
    const renderWordLine = (parts: string[], startCharIdx: number) => {
      let currentIdx = startCharIdx;
      return (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 w-full px-2">
          {parts.map((word, wordIdx) => {
            const wordChars = word.split('');
            const wordStartIdx = currentIdx;
            currentIdx += word.length + 1;

            return (
              <div key={wordIdx} className="flex items-center gap-x-0.5 whitespace-nowrap">
                {wordChars.map((char, i) => {
                  const globalIdx = wordStartIdx + i;
                  const isPunctuation = !/[\p{L}\p{N}]/u.test(char);
                  
                  if (isPunctuation) {
                    return (
                      <span key={i} className="w-2 sm:w-2.5 h-8 sm:h-10 flex items-center justify-center text-xl sm:text-2xl font-serif font-black text-earth/60 dark:text-ivory/60 border-b-2 border-transparent leading-none">
                        {char}
                      </span>
                    );
                  }
                  
                  const isRevealedByClue = revealed.includes(globalIdx);
                  const fillIdx = fillableIndices.indexOf(globalIdx);
                  let userChar = "";
                  let isWrong = false;
                  
                  const isRefActive = activeLanguage === lang;
                  const isSlotActive = isRefActive && !isRevealedByClue && !isCorrect && fillIdx !== -1 && fillIdx === (lang === 'es' ? cursorPositionEs : cursorPositionEn);
                  
                  if (!isRevealedByClue) {
                    if (fillIdx !== -1 && fillIdx < userInput.length) {
                      userChar = userInput[fillIdx];
                      if (hasSubmitted && userChar !== " " && normalize(userChar) !== normalize(char)) {
                        isWrong = true;
                      }
                    }
                  }

                  return (
                    <span 
                      key={i} 
                      onClick={(e) => { e.stopPropagation(); if (fillIdx !== -1) handleCharClick(lang, fillIdx); }}
                      className={`w-6 sm:w-7 h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-serif font-black border-b-[3px] transition-all duration-300 leading-none cursor-text relative ${
                        isCorrect || state.activeAttempt?.citationCorrect || isRevealedByClue || (userChar && userChar !== " ")
                          ? isWrong 
                            ? 'border-coral text-coral bg-coral/5' 
                            : isCorrect || state.activeAttempt?.citationCorrect || (hasSubmitted && !isWrong)
                              ? 'border-teal text-teal'
                              : 'border-playful-purple text-playful-purple' 
                          : 'border-earth/20 dark:border-white/20 text-transparent hover:border-earth/40'
                      }`}
                    >
                      {isCorrect || state.activeAttempt?.citationCorrect ? char : (isRevealedByClue ? char : (userChar === " " ? "" : userChar))}
                      {isSlotActive && !isRevealedByClue && !isCorrect && (
                        <motion.div
                          layoutId={`cards-caret-${lang}`}
                          animate={{ opacity: [0.55, 1, 0.55] }}
                          transition={{
                            layout: { duration: 0.16, ease: "easeOut" },
                            opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                          }}
                          className="absolute inset-x-0 -bottom-[2.5px] h-[2.5px] rounded-full bg-earth dark:bg-ivory"
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    };

    const renderNumberLine = (numWord: string, startCharIdx: number) => {
      const chars = numWord.split('');
      return (
        <div className="flex items-center justify-center gap-x-1 mt-2">
          {chars.map((char, i) => {
            const globalIdx = startCharIdx + i;
            const isPunctuation = !/[\p{L}\p{N}]/u.test(char);
            
            if (isPunctuation) {
              return (
                <span key={i} className="w-2.5 h-10 flex items-center justify-center text-2xl font-serif font-black text-earth/60 dark:text-ivory/60 border-b-2 border-transparent leading-none">
                  {char}
                </span>
              );
            }
            
            const isRevealedByClue = revealed.includes(globalIdx);
            const fillIdx = fillableIndices.indexOf(globalIdx);
            let userChar = "";
            let isWrong = false;
            
            const isRefActive = activeLanguage === lang;
            const isSlotActive = isRefActive && !isRevealedByClue && !isCorrect && fillIdx !== -1 && fillIdx === (lang === 'es' ? cursorPositionEs : cursorPositionEn);
            
            if (!isRevealedByClue && fillIdx !== -1 && fillIdx < userInput.length) {
              userChar = userInput[fillIdx];
              if (hasSubmitted && userChar !== " " && normalize(userChar) !== normalize(char)) {
                isWrong = true;
              }
            }

            return (
              <span 
                key={i} 
                onClick={(e) => { e.stopPropagation(); if (fillIdx !== -1) handleCharClick(lang, fillIdx); }}
                className={`w-6 sm:w-7 h-12 flex items-center justify-center text-2xl sm:text-3xl font-serif font-black border-b-[3px] transition-all duration-300 leading-none cursor-text relative ${
                  isCorrect || state.activeAttempt?.citationCorrect || isRevealedByClue || (userChar && userChar !== " ")
                    ? isWrong 
                      ? 'border-coral text-coral bg-coral/5' 
                      : isCorrect || state.activeAttempt?.citationCorrect || (hasSubmitted && !isWrong)
                        ? 'border-teal text-teal'
                        : 'border-playful-purple text-playful-purple' 
                    : 'border-earth/20 dark:border-white/20 text-transparent hover:border-earth/40'
                }`}
              >
                {isCorrect || state.activeAttempt?.citationCorrect ? char : (isRevealedByClue ? char : (userChar === " " ? "" : userChar))}
                {isSlotActive && !isRevealedByClue && !isCorrect && (
                  <motion.div
                          layoutId={`cards-caret-${lang}`}
                          animate={{ opacity: [0.55, 1, 0.55] }}
                          transition={{
                            layout: { duration: 0.16, ease: "easeOut" },
                            opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                          }}
                          className="absolute inset-x-0 -bottom-[2.5px] h-[2.5px] rounded-full bg-earth dark:bg-ivory"
                        />
                )}
              </span>
            );
          })}
        </div>
      );
    };

    const bookCharsCount = bookParts.join(' ').length + (bookParts.length > 0 ? 1 : 0);

    return (
      <div className="flex flex-col items-center w-full">
        {renderWordLine(bookParts, 0)}
        {renderNumberLine(numberPart, bookCharsCount)}
      </div>
    );
  };

  const normalizeRef = (ref: string) => {
    return ref.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  };

  const getTargetChars = (ref: string, revealed: number[]) => {
    let target = "";
    for (let i = 0; i < ref.length; i++) {
      if (/[\p{L}\p{N}]/u.test(ref[i]) && !revealed.includes(i)) {
        target += ref[i];
      }
    }
    return target;
  };

  // --- Authoritative citation input -----------------------------------------
  // Refs mirror the rendered state so keyboard/submit handlers always read the
  // latest accepted keystroke synchronously (no stale-closure / final-keystroke
  // race). Rendering still uses state; the refs are the source of truth for
  // immediate reads and are kept identical to state by the mirrors below.
  const userInputEsRef = React.useRef("");
  const userInputEnRef = React.useRef("");
  useEffect(() => { userInputEsRef.current = userInputEs; }, [userInputEs]);
  useEffect(() => { userInputEnRef.current = userInputEn; }, [userInputEn]);

  const writeUserInput = (lang: 'es' | 'en', value: string) => {
    if (lang === 'es') { userInputEsRef.current = value; setUserInputEs(value); }
    else { userInputEnRef.current = value; setUserInputEn(value); }
  };
  const writeCursor = (lang: 'es' | 'en', value: number) => {
    if (lang === 'es') { cursorPositionEsRef.current = value; setCursorPositionEs(value); }
    else { cursorPositionEnRef.current = value; setCursorPositionEn(value); }
  };

  const slotCountFor = (lang: 'es' | 'en') =>
    getFillableIndices(lang === 'es' ? esRef : enRef, revealedIndices[lang]).length;

  // Force the value to exactly `n` editable slots: pad short, clamp long. This
  // is what prevents interior/trailing length drift from hiding unmatched chars.
  const padToSlots = (str: string, n: number): string[] => {
    const arr = str.split('');
    while (arr.length < n) arr.push(' ');
    arr.length = n;
    return arr;
  };

  // Accept one character at the authoritative logical cursor, then advance the
  // cursor (kept visible on the final slot). Non-letter/number (e.g. the colon
  // separator) is never stored.
  const acceptChar = (lang: 'es' | 'en', typedChar: string) => {
    if (!/[\p{L}\p{N}]/u.test(typedChar)) return;
    const n = slotCountFor(lang);
    if (n <= 0) return;
    const valueRef = lang === 'es' ? userInputEsRef : userInputEnRef;
    const cursorRef = lang === 'es' ? cursorPositionEsRef : cursorPositionEnRef;
    const pos = Math.min(Math.max(0, cursorRef.current), n - 1);
    const arr = padToSlots(valueRef.current, n);
    arr[pos] = typedChar;
    writeUserInput(lang, arr.join(''));
    writeCursor(lang, Math.min(pos + 1, n - 1));
    setClueFeedback(null);
  };

  // Backspace symmetric with forward typing: clear the active char if present,
  // else step back one slot and clear it. Never jumps to slot zero.
  const backspaceChar = (lang: 'es' | 'en') => {
    const n = slotCountFor(lang);
    if (n <= 0) return;
    const valueRef = lang === 'es' ? userInputEsRef : userInputEnRef;
    const cursorRef = lang === 'es' ? cursorPositionEsRef : cursorPositionEnRef;
    const arr = padToSlots(valueRef.current, n);
    const pos = Math.min(Math.max(0, cursorRef.current), n - 1);
    const target = (arr[pos] && arr[pos] !== ' ') ? pos : Math.max(0, pos - 1);
    arr[target] = ' ';
    writeUserInput(lang, arr.join(''));
    writeCursor(lang, target);
    setClueFeedback(null);
  };

  // Derive the single inserted character from a controlled-input change by
  // diffing against the authoritative previous value (caret-position agnostic,
  // so a desynced native caret can never misplace a character).
  const extractInsertedChar = (lang: 'es' | 'en', raw: string): string => {
    const prev = (lang === 'es' ? userInputEsRef : userInputEnRef).current;
    if (raw.length <= prev.length) return "";
    let i = 0;
    while (i < prev.length && raw[i] === prev[i]) i++;
    return raw[i] ?? raw[raw.length - 1] ?? "";
  };

  const isCitationFilled = (lang: 'es' | 'en'): boolean => {
    const target = getTargetChars(lang === 'es' ? esRef : enRef, revealedIndices[lang]);
    const val = (lang === 'es' ? userInputEsRef : userInputEnRef).current;
    return val.length === target.length && !val.includes(' ');
  };

  const handleSubmit = () => {
    setClueFeedback(null);
    if (!isEligible) {
      onMemorize(verse.id);
      return;
    }
    const esTarget = getTargetChars(esRef, revealedIndices.es);
    const enTarget = getTargetChars(enRef, revealedIndices.en);

    const esMatch = state.memorizeMode === 'en' || normalize(userInputEsRef.current) === normalize(esTarget);
    const enMatch = state.memorizeMode === 'es' || normalize(userInputEnRef.current) === normalize(enTarget);

    setHasSubmitted(true);

    if (esMatch && enMatch) {
      setIsCorrect(true);
      setShowError(false);
      setState(s => {
        if (s.activeAttempt) {
          return {
            ...s,
            activeAttempt: {
              ...s.activeAttempt,
              citationCorrect: true
            }
          };
        }
        return s;
      });
      // Success confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#06B6D4', '#10B981']
      });
    } else {
      setIsCorrect(false);
      setShowError(true);
      setAttemptsLeft(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          localStorage.setItem(`citation_failed_${verse.id}`, 'true');
        }
        return next;
      });
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const canSubmit = useMemo(() => {
    const esTarget = getTargetChars(esRef, revealedIndices.es);
    const enTarget = getTargetChars(enRef, revealedIndices.en);
    
    const esFilled = state.memorizeMode === 'en' || (userInputEs.length === esTarget.length && !userInputEs.includes(' '));
    const enFilled = state.memorizeMode === 'es' || (userInputEn.length === enTarget.length && !userInputEn.includes(' '));
    
    return esFilled && enFilled && !isCorrect && attemptsLeft > 0;
  }, [userInputEs, userInputEn, esRef, enRef, state.memorizeMode, revealedIndices, isCorrect, attemptsLeft]);

  const isFullyCompleted = state.progress.verseStages?.[verse.id] === 7;

  if (isCompleted || isFullyCompleted) {
    const isFailedSession = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    
    // Compute the actual completion count from state
    const isAlreadyCompleted = state.progress.completedVerses.includes(verse.id);
    const completionCounts = state.progress.completionCounts || {};
    const count = completionCounts[verse.id] !== undefined ? completionCounts[verse.id] : (isAlreadyCompleted ? 1 : 0);

    // Bilingual language history only (EN / ES). The combined total and the
    // translation abbreviations are intentionally omitted here — the growth icon
    // and headline already convey progress. Omitted entirely for older records
    // that carry no per-language history.
    const langCounts = state.progress.completionsByLanguage?.[verse.id];
    const enCount = langCounts?.en || 0;
    const esCount = langCounts?.es || 0;
    const langItems: string[] = [];
    if (enCount > 0) langItems.push(`EN ${enCount}`);
    if (esCount > 0) langItems.push(`ES ${esCount}`);
    const hasBreakdown = !isFailedSession && langItems.length > 0;

    let titleText = "";
    let bodyText = "";
    let subtextText = "";

    if (isFailedSession) {
      titleText = state.primaryLanguage === 'es' ? 'Práctica' : 'Practice';
      bodyText = state.primaryLanguage === 'es' 
        ? 'Cita correcta. Te falta dominar el texto del versículo para memorizarlo por completo.' 
        : 'Reference correct. Keep practicing the text of the verse to fully memorize and complete it.';
      subtextText = state.primaryLanguage === 'es' ? 'Sigue intentándolo' : 'Keep practicing';
    } else {
      if (count <= 1) {
        titleText = state.primaryLanguage === 'es' ? '¡Increíble!' : 'Amazing!';
        bodyText = state.primaryLanguage === 'es' 
          ? 'Has guardado su Palabra en tu corazón.' 
          : 'You’ve hidden His Word in your heart.';
        subtextText = state.primaryLanguage === 'es' ? 'Un versículo por día.' : 'One verse a day.';
      } else {
        titleText = state.primaryLanguage === 'es' ? '¡Dio fruto!' : 'It bore fruit!';
        bodyText = state.primaryLanguage === 'es'
          ? 'Esta palabra sigue dando fruto en ti.'
          : 'This word is continuing to bear fruit in you.';
        // The combined repetition total lives only in the growth result
        // (BLOOMED / BORE FRUIT ×N) — no completion-count sentence here.
        subtextText = "";
      }
    }

    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10 py-12"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        <div className="relative">
          <div className="transform-none">
            <motion.div 
              className={`w-40 h-40 ${
                isFailedSession 
                  ? 'bg-sky-blue/10 dark:bg-sky-blue/5 border border-sky-blue/20' 
                  : count >= 2
                    ? 'bg-rose-50 dark:bg-rose-950/20 shadow-2xl shadow-rose-500/10 border border-rose-200/50 dark:border-rose-500/20'
                    : 'bg-amber-50 dark:bg-amber-950/20 shadow-2xl shadow-amber-500/10 border border-amber-200/50 dark:border-amber-500/20'
              } rounded-[48px] flex items-center justify-center`}
              animate={isFailedSession ? {
                scale: [1, 1.02, 1],
                y: [0, -3, 0]
              } : { 
                rotate: [0, 5, -5, 5, 0], 
                scale: [1, 1.05, 1],
                y: [0, -8, 0]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              {isFailedSession ? (
                <Brain size={80} className="text-sky-blue" strokeWidth={1.2} />
              ) : count >= 2 ? (
                <div className="relative flex items-center justify-center">
                  <Grape size={80} className="text-rose-500 dark:text-rose-400" strokeWidth={1.2} />
                  {count >= 3 && (
                    <motion.div 
                      initial={{ scale: 0, rotate: -25 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 12 }}
                      className="absolute -bottom-3 -right-3 bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700 text-white font-serif font-black text-xs tracking-wider px-3 py-1.5 rounded-full shadow-lg shadow-rose-500/20 dark:shadow-rose-950/40 border-[2.5px] border-white dark:border-charcoal whitespace-nowrap min-w-[32px] flex items-center justify-center select-none"
                    >
                      ×{count}
                    </motion.div>
                  )}
                </div>
              ) : (
                <Flower2 size={80} className="text-amber-500 dark:text-amber-400" strokeWidth={1.2} />
              )}
            </motion.div>
          </div>
          
          {/* Animated "Pollen/Dust" stars in warm tones */}
          {!isFailedSession && [...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                x: Math.cos(i * 45 * Math.PI / 180) * 120,
                y: Math.sin(i * 45 * Math.PI / 180) * 120,
                opacity: [0, 0.6, 0],
                scale: [0, 1.2, 0],
                rotate: [0, 90]
              }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${count >= 2 ? 'bg-rose-400/40' : 'bg-amber-400/40'} blur-[1px]`} />
            </motion.div>
          ))}
        </div>

        <div className="space-y-4 px-6">
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl sm:text-8xl font-serif font-black text-earth dark:text-ivory tracking-tighter"
          >
            {titleText}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto flex flex-col items-center gap-2"
          >
            <span>
              {bodyText}
            </span>
            {subtextText && (
              <span className="text-sm font-black text-playful-purple dark:text-plum uppercase tracking-widest mt-2 animate-pulse">
                {subtextText}
              </span>
            )}
          </motion.p>
        </div>

        {hasBreakdown && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6 text-sm text-earth-light dark:text-lavender-muted font-black uppercase tracking-widest"
          >
            {langItems.map((item, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 && <span className="opacity-40 mr-2">·</span>}
                {item}
              </span>
            ))}
          </motion.div>
        )}

        <div className="w-full max-w-sm space-y-6 px-6">
          <div className="space-y-4">
            <motion.button 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => {
                onMemorize(verse.id);
              }} 
              className="btn-primary w-full flex items-center justify-center gap-3 py-5 shadow-playful-purple/20"
            >
              <RotateCcw size={20} />
              <span className="text-lg font-bold tracking-tight lowercase">{state.primaryLanguage === 'es' ? 'repetir' : 'repeat'}</span>
            </motion.button>
            
            {isFailedSession ? (
              <motion.button 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => onMemorize(verse.id)}
                className="w-full bg-teal text-white hover:bg-teal-600 rounded-full flex items-center justify-center gap-3 py-4 px-8 transition-all hover:scale-[1.01] active:scale-95 group shadow-lg shadow-teal/20"
              >
                <Brain size={18} />
                <span className="font-bold tracking-tight lowercase">{state.primaryLanguage === 'es' ? 'intentar memorizar texto' : 'try memorizing text'}</span>
              </motion.button>
            ) : (
              <motion.button 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={onGoToSaved}
                className="w-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm rounded-full flex items-center justify-center gap-3 py-4 px-8 transition-all hover:scale-[1.01] active:scale-95 group"
              >
                <Sprout size={18} className="text-teal dark:text-teal-400" />
                <span className="font-bold tracking-tight lowercase">{state.primaryLanguage === 'es' ? 'ver guardados' : 'view saved'}</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div id="cards-content" className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-full max-w-4xl mx-auto px-6">
        {/* Page Header - Refined for Consistency and Left Aligned with Card */}
        <div className="flex flex-col space-y-2 sm:space-y-3 mb-8 sm:mb-10">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-coral animate-pulse" />
            <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-coral leading-none">
              {state.primaryLanguage === 'es' ? 'CARDS' : 'CARDS'}
            </span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
            {state.primaryLanguage === 'es' ? 'La Cita Bíblica' : 'The Reference'}
          </h2>
          
          <p className="text-sm sm:text-base text-earth-light/70 dark:text-lavender-muted/70 font-medium tracking-tight">
            {state.primaryLanguage === 'es' 
              ? 'Pon a prueba tu memoria con la cita bíblica' 
              : 'Test your memory with the verse reference'}
          </p>
        </div>

        {!isEligible ? (
          <div className="w-full max-w-xl mx-auto my-12 bg-white dark:bg-charcoal shadow-2xl rounded-[40px] border border-earth/5 dark:ring-1 dark:ring-white/5 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-24 h-24 bg-playful-purple/10 dark:bg-plum/10 rounded-full flex items-center justify-center text-playful-purple dark:text-plum">
                <Brain size={44} className="animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-coral text-white p-2.5 rounded-full shadow-lg">
                <Lock size={18} />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                {state.primaryLanguage === 'es' ? 'Nivel bloqueado' : 'Level locked'}
              </h3>
              <p className="text-sm text-earth-light dark:text-lavender-muted leading-relaxed max-w-xs mx-auto font-medium font-serif">
                {state.primaryLanguage === 'es' 
                  ? 'Primero completa la memorización del versículo. Después desbloquearás la cita bíblica.'
                  : 'Complete the verse memorization first. Then you’ll unlock the citation challenge.'}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onMemorize(verse.id)}
              className="px-8 py-4 bg-teal hover:bg-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-lg shadow-teal/20 transition-colors flex items-center gap-2"
            >
              <BookOpen size={16} />
              <span>
                {state.primaryLanguage === 'es' ? 'ir a memorizar' : 'go memorize'}
              </span>
            </motion.button>
          </div>
        ) : (
          <>
            {/* Card Container - Restored to wider width with balanced height */}
            <div className={`relative w-full ${state.memorizeMode === 'both' ? 'h-[720px] sm:h-[740px] lg:h-[780px]' : 'h-[660px] sm:h-[720px] lg:h-[780px]'} perspective-1000 mb-10 mx-auto`}>
          <motion.div
            className="w-full h-full preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
          {/* Front Side - Reference Recall Challenge */}
          <div 
            className="absolute inset-0 backface-hidden"
            onClick={() => {
              if (!isFlipped && !isCorrect && attemptsLeft > 0) {
                if (state.memorizeMode === 'en') inputRefEn.current?.focus();
                else inputRefEs.current?.focus();
              }
            }}
          >
            <div className="shimmer-border w-full h-full rounded-[40px]">
              <div className="w-full h-full card flex flex-col bg-white dark:bg-charcoal shadow-2xl overflow-hidden rounded-[40px] border-none ring-1 ring-earth/5 dark:ring-white/5">
                <div className="flex-1 flex flex-col p-6 sm:p-10 justify-between h-full">
                  {/* Top Section */}
                  <div className="space-y-6 pt-2">
                    {/* Top Icon/Badge - Using correct Layers icon */}
                    <div className="flex justify-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-earth/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-earth-light/60 dark:text-ivory/50">
                        <Layers size={24} className="sm:w-7 sm:h-7" />
                      </div>
                    </div>

                    {/* Translation Labels - Refined Palette */}
                    <div className="flex justify-center gap-4">
                      {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                        <span className="text-xs font-black uppercase tracking-widest text-teal bg-teal/5 dark:bg-teal/10 px-4 py-1.5 rounded-full border border-teal/20">
                          {activePair.es}
                        </span>
                      )}
                      {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                        <span className="text-xs font-black uppercase tracking-widest text-amber-600 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
                          {activePair.en}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Section - Reference Placeholder Area */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-10 sm:space-y-16">
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div 
                        className="space-y-6 sm:space-y-10 w-full cursor-text flex flex-col items-center"
                        onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEs.current?.focus(); }}
                      >
                        <div className="flex items-center gap-3 opacity-60 mb-2 mt-2">
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          <p className="text-[12px] sm:text-[14px] font-black uppercase tracking-[0.4em] text-earth-light dark:text-parchment text-center antialiased">
                            {state.primaryLanguage === 'es' ? 'Cita (ES)' : 'Citation (ES)'}
                          </p>
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          
                          {/* Language-specific clue button */}
                          {attemptsLeft > 0 && !isCorrect && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={(e) => handleClue(e, 'es')}
                              disabled={clueCount.es >= 1 || !hasClueEsAvailable}
                              className={`ml-2 p-1.5 rounded-lg transition-all ${
                                (clueCount.es >= 1 || !hasClueEsAvailable)
                                  ? 'text-earth/10 dark:text-white/10 opacity-0 pointer-events-none'
                                  : 'text-amber-500 hover:bg-amber-500/10 active:scale-95'
                              }`}
                              title={state.primaryLanguage === 'es' ? `Pista (${1 - clueCount.es})` : `Clue (${1 - clueCount.es})`}
                            >
                              <Sparkles size={14} className={(clueCount.es >= 1 || !hasClueEsAvailable) ? '' : 'animate-pulse'} />
                            </motion.button>
                          )}
                        </div>
                        <input 
                          ref={inputRefEs}
                          type="text"
                          value={userInputEs}
                          disabled={isCorrect || attemptsLeft === 0}
                          onFocus={() => setActiveLanguage('es')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const esOk = state.memorizeMode === 'en' || isCitationFilled('es');
                              const enOk = state.memorizeMode === 'es' || isCitationFilled('en');
                              if (isEligible && esOk && enOk && !isCorrect && attemptsLeft > 0) handleSubmit();
                              return;
                            }
                            if (e.key === 'ArrowLeft') {
                              e.preventDefault();
                              writeCursor('es', Math.max(0, cursorPositionEsRef.current - 1));
                              return;
                            }
                            if (e.key === 'ArrowRight') {
                              e.preventDefault();
                              const maxPos = Math.max(0, slotCountFor('es') - 1);
                              writeCursor('es', Math.min(maxPos, cursorPositionEsRef.current + 1));
                              return;
                            }
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              const fillableAll = getFillableIndices(esRef, revealedIndices.es);
                              const bookStr = esRef.split(' ').slice(0, -1).join(' ');
                              const bookCharsCount = bookStr.length + (bookStr.length > 0 ? 1 : 0);
                              const firstNumFillIdx = fillableAll.findIndex(gi => gi >= bookCharsCount);
                              const bookFillCount = firstNumFillIdx === -1 ? fillableAll.length : firstNumFillIdx;
                              const numFillCount = firstNumFillIdx === -1 ? 0 : fillableAll.length - firstNumFillIdx;
                              const cur = cursorPositionEsRef.current;
                              let newPos = cur;
                              if (e.key === 'ArrowDown' && cur < bookFillCount && numFillCount > 0) {
                                newPos = firstNumFillIdx + Math.min(numFillCount - 1, cur);
                              } else if (e.key === 'ArrowUp' && firstNumFillIdx !== -1 && cur >= firstNumFillIdx && bookFillCount > 0) {
                                newPos = Math.min(bookFillCount - 1, cur - firstNumFillIdx);
                              }
                              if (newPos !== cur) writeCursor('es', newPos);
                              return;
                            }
                            if (e.key === 'Backspace') {
                              e.preventDefault();
                              backspaceChar('es');
                              return;
                            }
                          }}
                          onChange={(e) => {
                            const inserted = extractInsertedChar('es', e.target.value);
                            if (inserted) acceptChar('es', inserted);
                            setHasSubmitted(false);
                            setShowError(false);
                          }}
                          className="sr-only"
                          style={{ opacity: 0, pointerEvents: 'none', caretColor: 'transparent' }}
                        />
                        <div className="flex justify-center w-full">
                          {renderPlaceholder(esRef, revealedIndices.es, userInputEs, 'es')}
                        </div>
                      </div>
                    )}
                    
                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div 
                        className="space-y-6 sm:space-y-10 w-full cursor-text flex flex-col items-center"
                        onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEn.current?.focus(); }}
                      >
                        <div className="flex items-center gap-3 opacity-60 mb-2 mt-2">
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          <p className="text-[12px] sm:text-[14px] font-black uppercase tracking-[0.4em] text-earth-light dark:text-parchment text-center antialiased">
                            {state.primaryLanguage === 'es' ? 'Cita (EN)' : 'Citation (EN)'}
                          </p>
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          
                          {/* Language-specific clue button */}
                          {attemptsLeft > 0 && !isCorrect && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={(e) => handleClue(e, 'en')}
                              disabled={clueCount.en >= 1 || !hasClueEnAvailable}
                              className={`ml-2 p-1.5 rounded-lg transition-all ${
                                (clueCount.en >= 1 || !hasClueEnAvailable)
                                  ? 'text-earth/10 dark:text-white/10 opacity-0 pointer-events-none'
                                  : 'text-amber-500 hover:bg-amber-500/10 active:scale-95'
                              }`}
                              title={state.primaryLanguage === 'es' ? `Pista (${1 - clueCount.en})` : `Clue (${1 - clueCount.en})`}
                            >
                              <Sparkles size={14} className={(clueCount.en >= 1 || !hasClueEnAvailable) ? '' : 'animate-pulse'} />
                            </motion.button>
                          )}
                        </div>
                        <input 
                          ref={inputRefEn}
                          type="text"
                          value={userInputEn}
                          disabled={isCorrect || attemptsLeft === 0}
                          onFocus={() => setActiveLanguage('en')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const esOk = state.memorizeMode === 'en' || isCitationFilled('es');
                              const enOk = state.memorizeMode === 'es' || isCitationFilled('en');
                              if (isEligible && esOk && enOk && !isCorrect && attemptsLeft > 0) handleSubmit();
                              return;
                            }
                            if (e.key === 'ArrowLeft') {
                              e.preventDefault();
                              writeCursor('en', Math.max(0, cursorPositionEnRef.current - 1));
                              return;
                            }
                            if (e.key === 'ArrowRight') {
                              e.preventDefault();
                              const maxPos = Math.max(0, slotCountFor('en') - 1);
                              writeCursor('en', Math.min(maxPos, cursorPositionEnRef.current + 1));
                              return;
                            }
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              const fillableAll = getFillableIndices(enRef, revealedIndices.en);
                              const bookStr = enRef.split(' ').slice(0, -1).join(' ');
                              const bookCharsCount = bookStr.length + (bookStr.length > 0 ? 1 : 0);
                              const firstNumFillIdx = fillableAll.findIndex(gi => gi >= bookCharsCount);
                              const bookFillCount = firstNumFillIdx === -1 ? fillableAll.length : firstNumFillIdx;
                              const numFillCount = firstNumFillIdx === -1 ? 0 : fillableAll.length - firstNumFillIdx;
                              const cur = cursorPositionEnRef.current;
                              let newPos = cur;
                              if (e.key === 'ArrowDown' && cur < bookFillCount && numFillCount > 0) {
                                newPos = firstNumFillIdx + Math.min(numFillCount - 1, cur);
                              } else if (e.key === 'ArrowUp' && firstNumFillIdx !== -1 && cur >= firstNumFillIdx && bookFillCount > 0) {
                                newPos = Math.min(bookFillCount - 1, cur - firstNumFillIdx);
                              }
                              if (newPos !== cur) writeCursor('en', newPos);
                              return;
                            }
                            if (e.key === 'Backspace') {
                              e.preventDefault();
                              backspaceChar('en');
                              return;
                            }
                          }}
                          onChange={(e) => {
                            const inserted = extractInsertedChar('en', e.target.value);
                            if (inserted) acceptChar('en', inserted);
                            setHasSubmitted(false);
                            setShowError(false);
                          }}
                          className="sr-only"
                          style={{ opacity: 0, pointerEvents: 'none', caretColor: 'transparent' }}
                        />
                        <div className="flex justify-center w-full">
                          {renderPlaceholder(enRef, revealedIndices.en, userInputEn, 'en')}
                        </div>
                      </div>
                    )}

                    {showError && attemptsLeft > 0 && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-black uppercase tracking-widest text-coral text-center"
                      >
                        {state.primaryLanguage === 'es' ? 'Incorrecto' : 'Incorrect'}
                      </motion.p>
                    )}

                    {attemptsLeft === 0 && !isCorrect && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4 text-center px-4"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-black text-coral uppercase tracking-wider">
                            {state.primaryLanguage === 'es' ? 'Se agotaron los intentos.' : 'Attempts exhausted.'}
                          </p>
                          <p className="text-[11px] text-earth-light/60 dark:text-lavender-muted/60 font-medium">
                            {state.primaryLanguage === 'es' ? 'Voltea la tarjeta para ver la respuesta.' : 'Flip the card to review the citation.'}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {isCorrect && (
                      <motion.p 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] font-black uppercase tracking-widest text-teal text-center flex items-center gap-2"
                      >
                        <CheckCircle2 size={14} />
                        {state.primaryLanguage === 'es' ? '¡Correcto!' : 'Correct!'}
                      </motion.p>
                    )}
                  </div>

                  {/* Bottom Section - Integrated Controls */}
                  <div className="flex flex-col items-center gap-4 pb-14 pt-4 mt-auto">
                    {/* Compact Clue Button and Attempts */}
                    <div className="flex flex-col items-center gap-6 w-full">
                      {attemptsLeft > 0 && !isCorrect && state.memorizeMode !== 'both' && (
                        <button
                          onClick={(e) => handleClue(e, state.memorizeMode as 'es' | 'en')}
                          disabled={clueCount[state.memorizeMode as 'es' | 'en'] >= 1}
                          className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-2xl font-black text-[11px] sm:text-[12px] uppercase tracking-widest transition-all ${
                            clueCount[state.memorizeMode as 'es' | 'en'] >= 1
                              ? 'text-earth/20 dark:text-white/20 cursor-not-allowed border border-earth/10 opacity-0 pointer-events-none'
                              : 'bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm active:scale-95'
                          }`}
                        >
                          <Sparkles size={14} className={clueCount[state.memorizeMode as 'es' | 'en'] >= 1 ? '' : 'animate-pulse text-amber-500 dark:text-amber-400'} />
                          <span>{state.primaryLanguage === 'es' ? 'pista' : 'clue'} ({1 - clueCount[state.memorizeMode as 'es' | 'en']})</span>
                        </button>
                      )}

                      {/* Inline clue guidance (reserved height to avoid layout jump). Supportive, not an error. */}
                      <div className="min-h-[2.25rem] flex items-center justify-center px-4 w-full">
                        {clueFeedback && (
                          <motion.p
                            key={clueFeedback}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[11px] sm:text-xs font-bold text-earth-light dark:text-lavender-muted text-center leading-snug"
                          >
                            {clueFeedback === 'check-first'
                              ? (state.primaryLanguage === 'es'
                                  ? 'Primero revisa tu respuesta.'
                                  : 'Check your answer first.')
                              : clueFeedback === 'corrected'
                                ? (state.primaryLanguage === 'es'
                                    ? 'Se corrigió una letra incorrecta. Revisa tu respuesta de nuevo.'
                                    : 'One incorrect letter was corrected. Check your answer again.')
                                : (state.primaryLanguage === 'es'
                                    ? 'Se reveló una letra.'
                                    : 'A letter was revealed.')}
                          </motion.p>
                        )}
                      </div>

                      <div className="opacity-40">
                        <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-earth-light dark:text-lavender-muted">
                          {state.primaryLanguage === 'es' ? `Intentos: ${attemptsLeft}` : `Attempts: ${attemptsLeft}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared Overlapping Flip Button */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-30">
              <motion.button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (isCorrect || attemptsLeft === 0) onFlip(); 
                }}
                disabled={!isCorrect && attemptsLeft > 0}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all border-4 border-white dark:border-charcoal relative group ${
                  (!isCorrect && attemptsLeft > 0)
                    ? 'bg-earth/20 text-earth/20 dark:bg-white/5 dark:text-white/5 cursor-not-allowed border-earth/10'
                    : isFlipped 
                      ? 'bg-sky-blue text-white rotate-180' 
                      : 'bg-playful-purple text-white rotate-0 shadow-lg shadow-playful-purple/30'
                }`}
                whileHover={(!isCorrect && attemptsLeft > 0) ? {} : { scale: 1.05 }}
                whileTap={(!isCorrect && attemptsLeft > 0) ? {} : { scale: 0.95 }}
                aria-label={state.primaryLanguage === 'es' ? 'voltear tarjeta' : 'flip card'}
              >
                <RotateCcw size={24} />
                {!isFlipped && (isCorrect || attemptsLeft === 0) && (
                  <motion.div 
                    className="absolute -inset-1 rounded-full border-2 border-playful-purple/30"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.button>
            </div>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="shimmer-border w-full h-full rounded-[40px]">
              <div className="w-full h-full card flex flex-col bg-sky-blue/5 dark:bg-sky-blue/10 border-none shadow-2xl overflow-hidden rounded-[40px] ring-1 ring-sky-blue/10">
                <div className="flex-1 flex flex-col p-6 sm:p-10 justify-between h-full">
                  <div className="flex-1 flex flex-col">
                    {/* Top Section */}
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-blue/10 rounded-2xl flex items-center justify-center text-sky-blue">
                          <BookOpen size={20} className="sm:w-6 sm:h-6" />
                        </div>
                      </div>

                      {/* Revealed Reference Area */}
                      <div className="text-center">
                        <h3 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight whitespace-nowrap">
                          {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-blue mt-1">
                          {state.memorizeMode === 'both' 
                            ? (state.primaryLanguage === 'es' ? `${activePair.es} + ${activePair.en}` : `${activePair.en} + ${activePair.es}`)
                            : state.memorizeMode === 'es' ? activePair.es : activePair.en
                          }
                        </p>
                      </div>
                    </div>

                    {/* Middle Section - Verse Text Area */}
                    <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 overflow-y-auto scrollbar-hide py-4">
                      {(() => {
                        const esBlock = (state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                          <div key="es" className={`space-y-1 font-serif font-bold text-earth/80 dark:text-ivory/80 ${VERSE_LAYOUT.LINE_HEIGHT}`}>
                            {getVerseLines(esText).map((line, i) => (
                              <p key={i} className={`${state.memorizeMode === 'both' ? 'text-sm sm:text-lg' : 'text-base sm:text-xl'} leading-relaxed text-balance`}>
                                {line}
                              </p>
                            ))}
                          </div>
                        );

                        const enBlock = (state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                          <div key="en" className={`space-y-1 font-serif font-bold text-earth/80 dark:text-ivory/80 ${VERSE_LAYOUT.LINE_HEIGHT}`}>
                            {getVerseLines(enText).map((line, i) => (
                              <p key={i} className={`${state.memorizeMode === 'both' ? 'text-sm sm:text-lg' : 'text-base sm:text-xl'} leading-relaxed text-balance`}>
                                {line}
                              </p>
                            ))}
                          </div>
                        );

                        const divider = state.memorizeMode === 'both' && (
                          <div key="divider" className="h-px w-12 bg-sky-blue/30 mx-auto my-2 shrink-0" />
                        );

                        if (state.memorizeMode !== 'both') return esBlock || enBlock;

                        return state.primaryLanguage === 'es' 
                          ? [esBlock, divider, enBlock] 
                          : [enBlock, divider, esBlock];
                      })()}
                    </div>
                  </div>

                  {/* Bottom Section - Integrated Spacer Area */}
                  <div className="flex flex-col items-center pt-8 mt-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onFlip(); }}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-sky-blue/60 hover:text-sky-blue transition-colors"
                    >
                      <RotateCcw size={14} />
                      <span>{state.primaryLanguage === 'es' ? 'volver' : 'back'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* External Action Area - Centered same as card */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 mt-12 mb-20 px-6">
        <AnimatePresence mode="wait">
          {(isCorrect || (attemptsLeft === 0 && !isCorrect)) ? (
            <motion.div
              key="next-action"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full px-4"
            >
              <button
                onClick={() => {
                  if (isCorrect) {
                    handleComplete();
                  } else if (onRestartMemorization) {
                    onRestartMemorization(verse.id);
                  } else {
                    onMemorize(verse.id);
                  }
                }}
                disabled={!hasReviewed || isFlipped}
                className={`w-full rounded-[24px] py-5 flex items-center justify-center gap-3 transition-all ${
                  hasReviewed && !isFlipped
                    ? (isCorrect 
                        ? 'bg-teal text-white shadow-xl shadow-teal/30 hover:scale-[1.02] active:scale-95' 
                        : 'bg-coral text-white shadow-xl shadow-coral/30 hover:scale-[1.02] active:scale-95')
                    : 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-not-allowed grayscale'
                }`}
              >
                {isCorrect ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                <span className="text-lg font-bold tracking-tight lowercase">
                  {isCorrect
                    ? (localStorage.getItem(`memorize_failed_${verse.id}`) === "true"
                        ? (state.primaryLanguage === 'es' ? 'terminar práctica' : 'finish practice')
                        : (state.primaryLanguage === 'es' ? 'versículo memorizado' : 'verse memorized'))
                    : (state.primaryLanguage === 'es' ? 'repasar versículo' : 'review verse')}
                </span>
                {isCorrect && hasReviewed && !isFlipped && <ArrowRight size={20} />}
              </button>
            </motion.div>
          ) : (
            !isFlipped && (
              <motion.div 
                key="recall-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-6 w-full px-4"
              >
                {/* Primary Circular Check Button - High Contrast Verso Treatment */}
                <motion.button 
                  onClick={handleSubmit}
                  disabled={isCorrect || attemptsLeft === 0}
                  whileHover={!isCorrect && attemptsLeft > 0 ? { scale: 1.05 } : {}}
                  whileTap={!isCorrect && attemptsLeft > 0 ? { scale: 0.95 } : {}}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all relative border-2 ${
                    !isCorrect && attemptsLeft > 0
                      ? (showError 
                          ? 'border-coral text-coral bg-white dark:bg-charcoal shadow-coral/30' 
                          : (canSubmit 
                              ? 'bg-playful-purple text-white shadow-playful-purple/40 ring-4 ring-playful-purple/20 border-white/20 hover:bg-playful-purple/90'
                              : 'border-playful-purple/40 dark:border-plum/40 text-playful-purple dark:text-plum bg-white dark:bg-charcoal shadow-sm hover:border-playful-purple/60 dark:hover:border-plum/60'))
                      : 'bg-earth/5 text-earth/20 border-earth/10 cursor-not-allowed opacity-40'
                  }`}
                >
                  <ArrowRight size={32} strokeWidth={3} />
                  {(canSubmit || showError) && !isCorrect && attemptsLeft > 0 && (
                    <motion.div 
                      className={`absolute -inset-1.5 rounded-full border-2 opacity-30 ${showError ? 'border-coral' : 'border-playful-purple'}`}
                      animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  )}
                </motion.button>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
          </>
        )}
    </div>
  </div>
);
}
