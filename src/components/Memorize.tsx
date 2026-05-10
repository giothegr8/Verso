import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers, MessageCircle, BookOpen, Sprout } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, getVerseLines, removeAccents, VERSE_LAYOUT } from "../utils/verseUtils";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
  tourStepId?: string | null;
}

const STAGES = [
  { id: 1, label: "Reading", es: "Lectura" },
  { id: 2, label: "", es: "" }, 
  { id: 3, label: "", es: "" }, 
  { id: 4, label: "Recall", es: "Recuerdo" },
  { id: 5, label: "Typing", es: "Escritura" },
];

export default function Memorize({ state, setState, onComplete, onGoToFlashcards, tourStepId }: MemorizeProps) {
  const today = getLocalDateString();
  const votd = getVerseByDate(today);
  
  const verse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || votd)
    : votd;

  const [stage, setStage] = useState(() => state.progress.verseStages[verse.id] || 1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [coachType, setCoachType] = useState<'encouragement' | 'suggestion' | 'tip'>('encouragement');
  const [attemptsEs, setAttemptsEs] = useState(0);
  const [attemptsEn, setAttemptsEn] = useState(0);
  const [userInputEs, setUserInputEs] = useState<string[]>([]);
  const [userInputEn, setUserInputEn] = useState<string[]>([]);
  const [cursorIndexEs, setCursorIndexEs] = useState(0);
  const [cursorIndexEn, setCursorIndexEn] = useState(0);
  const [clueCountEs, setClueCountEs] = useState(0);
  const [clueCountEn, setClueCountEn] = useState(0);
  const [revealedIndicesEs, setRevealedIndicesEs] = useState<number[]>([]);
  const [revealedIndicesEn, setRevealedIndicesEn] = useState<number[]>([]);
  const [isWrongEs, setIsWrongEs] = useState(false);
  const [isWrongEn, setIsWrongEn] = useState(false);
  const [hasSubmittedEs, setHasSubmittedEs] = useState(false);
  const [hasSubmittedEn, setHasSubmittedEn] = useState(false);
  const [isCorrectEs, setIsCorrectEs] = useState(false);
  const [isCorrectEn, setIsCorrectEn] = useState(false);
  const [didFailFlowEs, setDidFailFlowEs] = useState(false);
  const [didFailFlowEn, setDidFailFlowEn] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [activeLanguage, setActiveLanguage] = useState<'es' | 'en'>(() => {
    if (state.memorizeMode === 'en') return 'en';
    if (state.memorizeMode === 'es') return 'es';
    return state.primaryLanguage === 'en' ? 'en' : 'es';
  });

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

  const isAnyPartFailed = state.memorizeMode === 'both'
    ? (didFailFlowEs || didFailFlowEn)
    : (state.memorizeMode === 'es' ? didFailFlowEs : didFailFlowEn);
  
  const [inputValue, setInputValue] = useState(" ");
  
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure card height on mount or verse change to LOCK IT
  useEffect(() => {
    if (cardRef.current && stage === 1) {
      // Small timeout to allow content to settle
      const timer = setTimeout(() => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect && rect.height > 0) {
          setCardHeight(rect.height);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [verse.id, state.memorizeMode, stage]);

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

  const [bilingualPass, setBilingualPass] = useState(1);
  const [showHalfwayTransition, setShowHalfwayTransition] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  
  const activePair = getCurrentTranslationPair(state);

  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const { esText, enText, esError, enError } = getValidatedVerse(verse, state);

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
      setStage(1);
      setIsRevealed(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      setAttemptsEs(0);
      setAttemptsEn(0);
      setUserInputEs([]);
      setUserInputEn([]);
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrongEs(false);
      setIsWrongEn(false);
      setHasSubmittedEs(false);
      setHasSubmittedEn(false);
      setIsCorrectEs(false);
      setIsCorrectEn(false);
      setFeedback(null);
      setRevealedIndicesEs([]);
      setRevealedIndicesEn([]);
      setCursorIndexEs(0);
      setCursorIndexEn(0);
      setActiveLanguage(state.memorizeMode === 'en' ? 'en' : 'es');
      
      lastConfigRef.current = {
        selectedTranslationsEs: state.selectedTranslations.es,
        selectedTranslationsEn: state.selectedTranslations.en,
        memorizeMode: state.memorizeMode,
        verseId: verse.id
      };

      // Update global state to ensure consistency
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

  // Focus management for Stage 5 typing
  useEffect(() => {
    // Allow focus if in stage 5, not revealed, and either not submitted OR submitted but wrong with attempts left
    const canEdit = stage === 5 && !isRevealed && !isAlmostDone && (!hasSubmitted || (isWrong && attempts < 3));
    
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
  }, [stage, isRevealed, isAlmostDone, hasSubmitted, isWrong, attempts, activeLanguage, clueCountEs, clueCountEn]);

  useEffect(() => {
    if (isAlmostDone && isOverallSuccess) {
      // Water-based burst using blue/teal shades
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
  }, [isAlmostDone, isOverallSuccess]);

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
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      setAttemptsEs(0);
      setAttemptsEn(0);
      setUserInputEs([]);
      setUserInputEn([]);
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrongEs(false);
      setIsWrongEn(false);
      setHasSubmittedEs(false);
      setHasSubmittedEn(false);
      setIsCorrectEs(false);
      setIsCorrectEn(false);
      setFeedback(null);
      setRevealedIndicesEs([]);
      setRevealedIndicesEn([]);
      setCursorIndexEs(0);
      setCursorIndexEn(0);
      
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
        setShowHalfwayTransition(true);
      } else {
        // Success Persistence Fix: Save verse when successfully completed
        if (!isAnyPartFailed) {
          setState(s => ({
            ...s,
            savedVerses: s.savedVerses.includes(verse.id) ? s.savedVerses : [...s.savedVerses, verse.id],
            progress: {
              ...s.progress,
              totalMemorized: s.progress.completedVerses.includes(verse.id) ? s.progress.totalMemorized : s.progress.totalMemorized + 1,
              completedVerses: s.progress.completedVerses.includes(verse.id) ? s.progress.completedVerses : [...s.progress.completedVerses, verse.id]
            }
          }));
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
    setActiveLanguage(prev => prev === 'es' ? 'en' : 'es');
    setIsRevealed(false);
    setAttemptsEs(0);
    setAttemptsEn(0);
    setUserInputEs([]);
    setUserInputEn([]);
    setClueCountEs(0);
    setClueCountEn(0);
    setIsWrongEs(false);
    setIsWrongEn(false);
    setHasSubmittedEs(false);
    setHasSubmittedEn(false);
    setIsCorrectEs(false);
    setIsCorrectEn(false);
    setFeedback(null);
    setRevealedIndicesEs([]);
    setRevealedIndicesEn([]);
    setCursorIndexEs(0);
    setCursorIndexEn(0);
  };

  const prevStage = () => {
    if (stage > 1) {
      const newStage = stage - 1;
      setStage(newStage);
      setIsRevealed(false);
      setIsAlmostDone(false);
      setShowHalfwayTransition(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      setAttemptsEs(0);
      setAttemptsEn(0);
      setUserInputEs([]);
      setUserInputEn([]);
      setCursorIndexEs(0);
      setCursorIndexEn(0);
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrongEs(false);
      setIsWrongEn(false);
      setHasSubmittedEs(false);
      setHasSubmittedEn(false);
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
            [verse.id]: newStage
          }
        }
      }));
    }
  };

  const reset = () => {
    setStage(1);
    setIsRevealed(false);
    setIsAlmostDone(false);
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    setAttemptsEs(0);
    setAttemptsEn(0);
    setUserInputEs([]);
    setUserInputEn([]);
    setClueCountEs(0);
    setClueCountEn(0);
    setIsWrongEs(false);
    setIsWrongEn(false);
    setHasSubmittedEs(false);
    setHasSubmittedEn(false);
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
          let firstEmpty = 0;
          while (firstEmpty < cleanTargetArr.length && newRevealed.includes(firstEmpty)) {
            firstEmpty++;
          }
          setCursor(firstEmpty);
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

  const getCleanLetters = (text: string | null | undefined) => {
    if (!text) return "";
    return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, "");
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
    
    for (let i = 0; i < normalizedTarget.length; i++) {
      if (!revealed.includes(i)) {
        const char = userInput[i] || "";
        if (removeAccents(char.toLowerCase()) !== normalizedTarget[i]) {
          isCurrentCorrect = false;
          break;
        }
      }
    }
    
    if (isCurrentCorrect) {
      if (activeLanguage === 'es') setIsCorrectEs(true);
      else setIsCorrectEn(true);

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
        setTimeout(() => setIsWrongEs(false), 1500);
      } else {
        setAttemptsEn(nextAttempts);
        setIsWrongEn(true);
        setTimeout(() => setIsWrongEn(false), 1500);
      }
      
      if (nextAttempts >= 3) {
        if (activeLanguage === 'es') setDidFailFlowEs(true);
        else setDidFailFlowEn(true);

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

    const getNextEditable = (idx: number, dir: number) => {
      let next = idx;
      while (next >= 0 && next < cleanTargetArr.length && revealed.includes(next)) {
        next += dir;
      }
      return Math.max(0, Math.min(next, cleanTargetArr.length));
    };

    return (
      <div className={`w-full font-serif select-none ${VERSE_LAYOUT.FONT_SIZE_CLASSES} ${VERSE_LAYOUT.FONT_WEIGHT} transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex flex-wrap justify-center content-start gap-y-4 sm:gap-y-6 gap-x-[0.5em] w-full max-w-4xl mx-auto px-4 sm:px-12">
          {words.map((word, wordIdx) => {
            const chars = word.split("");
            return (
              <div key={wordIdx} className="flex flex-row flex-nowrap gap-x-[1.5px] items-end">
                {chars.map((char, charIdx) => {
                  const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char);
                  const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.25em] ${VERSE_LAYOUT.CHAR_HEIGHT} transition-all duration-300`;
                  
                  if (!isLetter) {
                    return <span key={charIdx} className={`${baseSlotClasses} text-earth/40 dark:text-ivory/40`}>{char}</span>;
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
                    const currentLetterIndex = words.slice(0, wordIdx).reduce((acc, w) => acc + getCleanLetters(w).length, 0) + getCleanLetters(word.slice(0, charIdx)).length;
                    const isRevealedByClue = revealed.includes(currentLetterIndex);
                    const userChar = (userInput[currentLetterIndex] || "").trim();
                    const isSlotActive = isCurrentActive && currentLetterIndex === (lang === 'es' ? cursorIndexEs : cursorIndexEn);
                    const isWrongChar = hasSubmitted && !isCorrect && userChar && removeAccents(userChar.toLowerCase()) !== removeAccents(char.toLowerCase());
                    
                    return (
                      <span 
                        key={charIdx} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrentActive) setActiveLanguage(lang);
                          const targetIdx = isRevealedByClue ? getNextEditable(currentLetterIndex, 1) : currentLetterIndex;
                          if (lang === 'es') setCursorIndexEs(targetIdx);
                          else setCursorIndexEn(targetIdx);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className={`${baseSlotClasses} cursor-text ${
                          isRevealedByClue || userChar
                            ? isWrongChar ? 'text-coral bg-coral/5' : isCorrect || isRevealedByClue ? 'text-teal' : 'text-playful-purple'
                            : 'text-transparent'
                        }`}
                      >
                        <span className={`absolute bottom-1 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                          isRevealedByClue || userChar
                            ? isWrongChar ? 'bg-coral' : isCorrect || isRevealedByClue ? 'bg-teal' : 'bg-playful-purple'
                            : isSlotActive ? 'bg-coral' : 'bg-earth/10 dark:bg-white/10'
                        }`} />
                        {isSlotActive && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="absolute inset-y-1 sm:inset-y-2 left-0 w-[3px] bg-coral rounded-full shadow-[0_0_8px_rgba(255,111,97,0.5)]"
                          />
                        )}
                        <span className="opacity-0 pointer-events-none select-none">{char}</span>
                        <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${(userChar || isRevealedByClue) ? 'opacity-100' : 'opacity-0'}`}>
                          {userChar || (isRevealedByClue ? char : "")}
                        </span>
                      </span>
                    );
                  }

                  return <span key={charIdx} className={`${baseSlotClasses} opacity-100`}>{char}</span>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isAlmostDone) {
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
            className="text-4xl font-serif font-black text-earth dark:text-ivory"
          >
            {isAnyPartFailed 
              ? (state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet')
              : (state.primaryLanguage === 'es' ? '¡Ya casi!' : "You're almost there!")
            }
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto"
          >
            {isAnyPartFailed 
              ? (state.primaryLanguage === 'es' 
                  ? 'Puedes seguir e intentar el próximo paso, o repasar este versículo desde el principio.' 
                  : 'You can keep going and try the next step, or review this verse from the beginning.')
              : (state.primaryLanguage === 'es' 
                  ? 'Texto completo. Ahora falta el último paso: la cita bíblica.' 
                  : 'Text complete. Now for the final step: the citation.')
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
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => onGoToFlashcards?.(verse.id)} 
              className={`w-full ${
                isAnyPartFailed 
                  ? 'bg-earth/10 dark:bg-white/5 text-earth dark:text-ivory border border-earth/10 dark:border-white/10' 
                  : 'bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm'
              } rounded-full flex items-center justify-center gap-3 py-4 px-8 hover:scale-[1.01] active:scale-95 transition-all group`}
            >
              <Layers size={20} className={isAnyPartFailed ? 'text-earth/40 dark:text-ivory/40' : 'text-teal dark:text-teal-400'} />
              <span className="text-sm sm:text-base font-bold tracking-tight lowercase">
                {isAnyPartFailed 
                  ? (state.primaryLanguage === 'es' ? 'continuar' : 'continue')
                  : (state.primaryLanguage === 'es' ? 'Reto: Cita bíblica' : 'Challenge: Citation')
                }
              </span>
            </motion.button>
            
            {isAnyPartFailed ? (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={reset}
                className="w-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm rounded-full flex items-center justify-center gap-3 py-4 px-8 transition-all hover:scale-[1.01] active:scale-95 group"
              >
                <RotateCcw size={18} />
                <span className="text-sm font-bold tracking-tight lowercase">
                  {state.primaryLanguage === 'es' ? 'repasar de nuevo' : 'review again'}
                </span>
              </motion.button>
            ) : (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => setIsAlmostDone(false)}
                className="text-xs font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-ivory/40 hover:text-teal dark:hover:text-teal-400 transition-colors py-2 flex items-center gap-2 group"
              >
                <span>{state.primaryLanguage === 'es' ? '← Volver al texto' : '← Back to text'}</span>
                <div className="relative w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity">
                  <Star size={16} fill="currentColor" className="text-gold" />
                </div>
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
          <h2 className="text-4xl font-serif font-black text-earth dark:text-ivory">
            {currentPassFailed 
              ? (state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet')
              : (state.primaryLanguage === 'es' ? '¡Vas muy bien!' : "You’re doing great!")
            }
          </h2>
          <div className="space-y-2">
            {!currentPassFailed && (
              <p className="text-xl font-bold text-playful-purple dark:text-plum">
                {state.primaryLanguage === 'es' 
                  ? (isEnNext ? 'Ahora en inglés' : 'Ahora en español')
                  : (isEnNext ? 'Now in English' : 'Now in Spanish')
                }
              </p>
            )}
            <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto leading-relaxed">
              {currentPassFailed
                ? (state.primaryLanguage === 'es' 
                    ? 'Puedes seguir e intentar el próximo paso, o repasar este versículo desde el principio.' 
                    : 'You can keep going and try the next step, or review this verse from the beginning.')
                : (state.primaryLanguage === 'es' 
                    ? `Ya memorizaste este versículo en ${activeLanguage === 'es' ? 'español' : 'inglés'}. Sigue con la versión en ${isEnNext ? 'inglés' : 'español'}.`
                    : `You’ve memorized this verse in ${activeLanguage === 'es' ? 'Spanish' : 'English'}. Keep going with the ${isEnNext ? 'English' : 'Spanish'} version.`
                  )
              }
            </p>
          </div>
        </div>

        <div className="w-full max-w-[280px] px-6 space-y-4">
          <button 
            onClick={handleHalfwayContinue}
            className={`w-full ${currentPassFailed ? 'bg-earth dark:bg-charcoal' : 'bg-playful-purple'} text-white rounded-[24px] py-5 font-bold shadow-xl shadow-playful-purple/20 hover:scale-[1.02] active:scale-95 transition-all lowercase`}
          >
            {state.primaryLanguage === 'es' ? 'continuar' : 'continue'}
          </button>
          {currentPassFailed && (
            <button 
              onClick={reset}
              className="w-full bg-playful-purple text-white rounded-[24px] py-5 font-bold shadow-xl shadow-playful-purple/20 hover:scale-[1.02] active:scale-95 transition-all lowercase"
            >
              {state.primaryLanguage === 'es' ? 'repasar de nuevo' : 'review again'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div id="memorize-content" className="flex-1 flex flex-col pt-4 pb-12">
      {/* Top Section - Premium Header (Refined Size) */}
      <div className="px-6 sm:px-12 mb-8 sm:mb-10 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-gold leading-none">
                  {state.primaryLanguage === 'es' ? 'MEMORIZA' : 'MEMORIZE'}
                </span>
              </div>
              
              {state.memorizeMode === 'both' && (
                <span className="bg-teal/10 dark:bg-teal/20 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full text-teal dark:text-teal-400 border border-teal/20">
                  {activeLanguage === 'es' 
                    ? (state.primaryLanguage === 'es' ? 'Español' : 'Spanish')
                    : (state.primaryLanguage === 'es' ? 'Inglés' : 'English')}
                </span>
              )}
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
              {getLocalizedBookName(verse.book, activeLanguage)} {verse.chapter}:{verse.verse}
            </h2>
            
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
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-6 mt-2 sm:mt-0">
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-earth-light/20 dark:text-lavender-muted/30 mb-0.5">
                {state.primaryLanguage === 'es' ? 'Paso' : 'Step'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-serif font-black text-amber-100/90 dark:text-amber-200/90 lining-nums">{stage}</span>
                <span className="text-sm text-earth/20 dark:text-ivory/20 font-black">/ 5</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Dotted Progress Indicator - Organic Seed Trail */}
        <div className="w-full flex justify-center items-center pt-10 pb-8 overflow-hidden">
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
                                ? "bg-amber-100/90 dark:bg-amber-200/90 shadow-[0_0_15px_rgba(251,191,36,0.4)]" 
                                : "bg-earth/20 dark:bg-white/10"
                          }`
                        : `w-1 h-1 ${
                            isCompleted 
                              ? "bg-amber-500/10 dark:bg-amber-100/5" 
                              : "bg-earth-light/10 dark:bg-white/5"
                          }`
                    }`}
                  />
                  
                  {/* Subtle active pulse for current main node */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-amber-200/40"
                      initial={{ opacity: 0, scale: 1 }}
                      animate={{ opacity: [0, 0.4, 0], scale: [1, 2.5, 3] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}

                  {/* Seed glow for completed trail */}
                  {isCompleted && !isMainNode && i % 2 === 0 && (
                    <motion.div 
                      className="absolute inset-0 rounded-full bg-amber-500/5 blur-[2px]"
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
            style={cardHeight ? { height: `${cardHeight}px` } : { height: 'auto', minHeight: isMobile ? '340px' : '500px' }}
            className="w-full flex flex-col items-center justify-between p-6 sm:p-12 relative bg-white dark:bg-charcoal border-none rounded-[40px] overflow-visible transition-[height] duration-300"
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
                  const revealed = activeLanguage === 'es' ? revealedIndicesEs : revealedIndicesEn;
                  const cursor = activeLanguage === 'es' ? cursorIndexEs : cursorIndexEn;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEs : setCursorIndexEn;
                  const targetTextClean = getCleanLetters(activeLanguage === 'es' ? esText : enText);
                  const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;

                  const getNextIdx = (idx: number, dir: number) => {
                    let next = idx + dir;
                    while (next >= 0 && next < targetTextClean.length && revealed.includes(next)) {
                      next += dir;
                    }
                    return Math.max(0, Math.min(next, targetTextClean.length));
                  };

                  if (e.key === 'Backspace') {
                    // Manual backspace handling
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

                    // Move to previous editable slot
                    let prev = cursor - 1;
                    while (prev >= 0 && revealed.includes(prev)) {
                      prev--;
                    }
                    
                    if (prev >= 0) {
                      setter(prevArr => {
                        const next = [...prevArr];
                        next[prev] = ""; // Clear the character
                        return next;
                      });
                      setCursor(prev);
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setCursor(getNextIdx(cursor, -1));
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setCursor(getNextIdx(cursor, 1));
                  } else if (e.key === 'Enter') {
                    handleCheck();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const cursor = activeLanguage === 'es' ? cursorIndexEs : cursorIndexEn;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEs : setCursorIndexEn;
                  const revealed = activeLanguage === 'es' ? revealedIndicesEs : revealedIndicesEn;
                  const targetText = activeLanguage === 'es' ? esText : enText;
                  const targetClean = getCleanLetters(targetText || "");
                  const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
                  
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
                    
                    if (cursor < targetClean.length && !revealed.includes(cursor)) {
                      // Update state
                      setter(prev => {
                        const next = [...prev];
                        next[cursor] = char;
                        return next;
                      });

                      // Advance cursor to next editable
                      let next = cursor + 1;
                      while (next < targetClean.length && revealed.includes(next)) {
                        next++;
                      }
                      setCursor(Math.min(next, targetClean.length));
                    }
                  } else if (val.length === 0) {
                    // Mobile Backspace detection fallback
                    // Move to previous editable slot
                    let prev = cursor - 1;
                    while (prev >= 0 && revealed.includes(prev)) {
                      prev--;
                    }
                    
                    if (prev >= 0) {
                      setter(prevArr => {
                        const next = [...prevArr];
                        next[prev] = ""; // Clear the character
                        return next;
                      });
                      setCursor(prev);
                    }
                  }

                  // Always reset input value to " " to be ready for next char/deletion
                  setInputValue(" ");
                }}
                className="absolute opacity-0 inset-0 w-full h-full cursor-default"
                autoFocus
              />
            )}

            {/* Verse Content - ALWAYS ONE LANGUAGE AT A TIME */}
            <div className="w-full flex-1 flex flex-col items-center justify-center py-2 sm:py-6">
              {/* Translation Label - Minimal & Elegant */}
              <motion.div 
                key={`${activeLanguage}-${state.selectedTranslations.es}-${state.selectedTranslations.en}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 flex items-center gap-3 opacity-40"
              >
                <div className="h-px w-6 bg-earth/30 dark:bg-white/20" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-earth-light dark:text-lavender-muted">
                  {activeLanguage === 'es' ? (activePair?.es || 'RVR1960') : (activePair?.en || 'KJV')}
                </span>
                <div className="h-px w-6 bg-earth/30 dark:bg-white/20" />
              </motion.div>

              <div className="w-full max-w-3xl">
                {activeLanguage === 'es' 
                  ? renderVerseContent(esText, userInputEs, 'es', true)
                  : renderVerseContent(enText, userInputEn, 'en', true)
                }
              </div>
            </div>

            {/* Utility Controls (Clue/Eye) - RESERVED BOTTOM ROW */}
            <div className="w-full h-14 sm:h-16 flex items-center justify-center gap-8 mt-2 sm:mt-6 flex-shrink-0 relative z-30">
              <div className="flex-1 flex justify-end">
                <AnimatePresence>
                  {stage === 5 && !isRevealed && !hasSubmitted && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); handleClue(activeLanguage); }}
                      disabled={(activeLanguage === 'es' ? clueCountEs : clueCountEn) >= 1}
                      className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-teal/10 dark:bg-teal-900/20 border border-teal/20 text-[10px] font-black uppercase tracking-widest text-teal dark:text-teal-400 shadow-sm hover:bg-teal/20 transition-all active:scale-95 disabled:opacity-10"
                    >
                      <Sparkles size={16} className={(activeLanguage === 'es' ? clueCountEs : clueCountEn) >= 1 ? '' : 'text-amber-500/80 dark:text-amber-400/80 animate-pulse'} />
                      <span>{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-6 bg-earth/5 dark:bg-white/5" />

              <div className="flex-1 flex justify-start">
                <button
                  disabled={stage === 5}
                  onPointerDown={() => setIsRevealed(true)}
                  onPointerUp={() => setIsRevealed(false)}
                  onPointerLeave={() => setIsRevealed(false)}
                  className={`p-3 rounded-full transition-all duration-300 border flex items-center justify-center shadow-lg active:scale-90 ${
                    stage === 5
                      ? 'opacity-20 grayscale pointer-events-none'
                      : isRevealed 
                        ? 'bg-playful-purple text-white border-playful-purple scale-110 shadow-playful-purple/20' 
                        : 'bg-white dark:bg-charcoal text-earth/40 dark:text-ivory/40 border-earth/10 dark:border-white/10 hover:text-playful-purple hover:border-playful-purple/30'
                  }`}
                >
                  {isRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
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
        <div className="h-12 w-full flex items-center justify-center mb-2">
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
                onClick={prevStage}
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white dark:bg-charcoal text-playful-purple dark:text-plum border-2 border-playful-purple/30 dark:border-plum/30 flex items-center justify-center hover:bg-playful-purple/5 hover:border-playful-purple transition-all shadow-sm group relative"
                aria-label="Back"
              >
                <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                {/* Subtle back ring */}
                <motion.div 
                  className="absolute inset-0 rounded-full border border-playful-purple/10"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
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
                    setTimeout(() => inputRef.current?.focus(), 0);
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
                    : 'w-2 bg-earth/10 dark:bg-white/10'
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
