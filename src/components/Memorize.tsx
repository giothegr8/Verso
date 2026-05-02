import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers, MessageCircle, BookOpen } from "lucide-react";
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
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#06B6D4', '#10B981']
      });
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
      
      // Ensure current language is active when entering a new stage in bilingual mode
      if (state.memorizeMode === 'both') {
        // On mobile sequential, stick to the pass language. On desktop, default to es (or keep active)
        if (!isMobile) {
          setActiveLanguage('es');
        }
      }

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
      if (state.memorizeMode === 'both' && isMobile && bilingualPass === 1) {
        setShowHalfwayTransition(true);
      } else {
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

      const otherLang = activeLanguage === 'es' ? 'en' : 'es';
      const isOtherDone = state.memorizeMode !== 'both' || (otherLang === 'es' ? (isCorrectEs || didFailFlowEs) : (isCorrectEn || didFailFlowEn));

      if (isOtherDone) {
        setFeedback(state.primaryLanguage === 'es' ? "¡Todo correcto!" : "Everything correct!");
        setTimeout(() => {
          nextStage();
        }, 1500);
      } else {
        // Only one correct so far in bilingual mode
        if (activeLanguage === 'es') {
          setFeedback(state.primaryLanguage === 'es' ? "Español correcto. Ahora completa inglés." : "Spanish correct. Now complete English.");
        } else {
          setFeedback(state.primaryLanguage === 'es' ? "Inglés correcto. Ahora completa español." : "English correct. Now complete Spanish.");
        }
        
        setTimeout(() => {
          handleLanguageSwitch(otherLang);
          setFeedback(null);
        }, 2000);
      }
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

        const otherLang = activeLanguage === 'es' ? 'en' : 'es';
        const isOtherDone = state.memorizeMode !== 'both' || (otherLang === 'es' ? (isCorrectEs || didFailFlowEs) : (isCorrectEn || didFailFlowEn));

        if (isOtherDone) {
          setFeedback(state.primaryLanguage === 'es' ? "Se acabaron los intentos. Revelando texto..." : "Out of attempts. Revealing text...");
          setTimeout(() => {
            nextStage();
          }, 2000);
        } else {
          setFeedback(state.primaryLanguage === 'es' ? "Se acabaron los intentos. Ahora completa el otro idioma." : "Out of attempts. Now complete the other language.");
          setTimeout(() => {
            handleLanguageSwitch(otherLang);
            setFeedback(null);
          }, 2500);
        }
      } else {
        const remaining = 3 - nextAttempts;
        setFeedback(state.primaryLanguage === 'es' 
          ? `Todavía no. Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'}.` 
          : `Not quite. You have ${remaining} tr${remaining === 1 ? 'y' : 'ies'} left.`);
      }
    }
  };

  const renderVerseContent = (text: string | null | undefined, userInput: string[], lang: 'es' | 'en', isCurrentActive: boolean = true) => {
    if (!text) return null;
    
    const lines = getVerseLines(text);
    let letterIndex = 0;
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const cleanTargetArr = getCleanLetters(text).split("");

    const getNextEditable = (idx: number, dir: number) => {
      let next = idx;
      while (next >= 0 && next < cleanTargetArr.length && revealed.includes(next)) {
        next += dir;
      }
      return Math.max(0, Math.min(next, cleanTargetArr.length));
    };

    const isLangRevealed = isRevealed || (lang === 'es' ? didFailFlowEs : didFailFlowEn);
    
    return (
      <div className={`space-y-4 sm:space-y-6 w-full font-serif select-none ${VERSE_LAYOUT.FONT_SIZE_CLASSES} ${VERSE_LAYOUT.FONT_WEIGHT} ${VERSE_LAYOUT.LINE_HEIGHT} transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        {lines.map((line, lineIdx) => {
          const words = line.split(" ");
          return (
            <div key={lineIdx} className="flex flex-row justify-center flex-nowrap w-full min-w-0 px-8 sm:px-2">
              <div className="flex flex-row justify-center flex-nowrap gap-x-[0.4em]">
                {words.map((word, wordIdx) => {
                  const chars = word.split("");
                  return (
                    <div key={wordIdx} className="flex flex-row flex-nowrap gap-x-[1px]">
                      {chars.map((char, charIdx) => {
                        const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char);
                        const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.2em] ${VERSE_LAYOUT.CHAR_HEIGHT} transition-all duration-300`;
                      
                      if (!isLetter) {
                        return (
                          <span key={charIdx} className={`${baseSlotClasses} text-earth/40 dark:text-ivory/40`}>
                            {char}
                          </span>
                        );
                      }
                      
                      if (stage < 5 && !isLangRevealed) {
                        let isHidden = false;
                        if (stage === 1) {
                          if (charIdx >= 2) isHidden = true;
                        } else if (stage === 2) {
                          if (wordIdx % 2 !== 0) isHidden = true;
                        } else if (stage === 3) {
                          if (wordIdx % 2 === 0) isHidden = true;
                        } else if (stage === 4) {
                          if (charIdx > 0) isHidden = true;
                        }

                        return (
                          <span key={charIdx} className={baseSlotClasses}>
                            <span className={`transition-all duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
                              {char}
                            </span>
                            {isHidden && (
                              <span className="absolute bottom-1 left-0 right-0 h-[1.5px] bg-earth/10 dark:bg-white/10 rounded-full" />
                            )}
                          </span>
                        );
                      }

                      if (stage === 5 && !isLangRevealed) {
                        const isRevealedByClue = revealed.includes(letterIndex);
                        const userChar = (userInput[letterIndex] || "").trim();
                        const currentLetterIndex = letterIndex;
                        const isSlotActive = isCurrentActive && currentLetterIndex === (lang === 'es' ? cursorIndexEs : cursorIndexEn);
                        const isWrongChar = hasSubmitted && !isCorrect && userChar && 
                          removeAccents(userChar.toLowerCase()) !== removeAccents(char.toLowerCase());
                        
                        const result = (
                          <span 
                            key={charIdx} 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCurrentActive) {
                                setActiveLanguage(lang);
                              }
                              // If clue, find nearest editable
                              const targetIdx = isRevealedByClue ? getNextEditable(currentLetterIndex, 1) : currentLetterIndex;
                              if (lang === 'es') setCursorIndexEs(targetIdx);
                              else setCursorIndexEn(targetIdx);
                              
                              // Small timeout to ensure inputRef is ready after potentially switching activeLanguage
                              setTimeout(() => inputRef.current?.focus(), 0);
                            }}
                            className={`${baseSlotClasses} cursor-text ${
                              isRevealedByClue || userChar
                                ? isWrongChar ? 'text-coral bg-coral/5' : isCorrect || isRevealedByClue ? 'text-teal' : 'text-playful-purple'
                                : 'text-transparent'
                            }`}
                          >
                            <span className={`absolute bottom-1 left-0 right-0 h-[1.5px] rounded-full transition-all duration-300 ${
                              isRevealedByClue || userChar
                                ? isWrongChar ? 'bg-coral' : isCorrect || isRevealedByClue ? 'bg-teal' : 'bg-playful-purple'
                                : isSlotActive ? 'bg-coral' : 'bg-earth/10 dark:bg-white/10'
                            }`} />

                            {isSlotActive && (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                className="absolute inset-y-1 left-0 w-[3px] bg-coral rounded-full shadow-[0_0_8px_rgba(255,111,97,0.5)]"
                              />
                            )}

                            <span className="opacity-0 pointer-events-none select-none">{char}</span>
                            <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${(userChar || isRevealedByClue) ? 'opacity-100' : 'opacity-0'}`}>
                              {userChar || (isRevealedByClue ? char : "")}
                            </span>
                          </span>
                        );

                        letterIndex++;
                        return result;
                      }

                      const result = (
                        <span key={charIdx} className={`${baseSlotClasses} opacity-100`}>
                          {char}
                        </span>
                      );
                      letterIndex++;
                      return result;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
              <Sparkles size={80} className="text-playful-purple dark:text-plum" fill="currentColor" />
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
              className="text-sm font-black text-playful-purple dark:text-plum uppercase tracking-widest mt-4"
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
              className={`w-full ${isAnyPartFailed ? 'bg-earth dark:bg-charcoal' : 'bg-playful-purple dark:bg-plum'} text-white rounded-[32px] flex items-center justify-center gap-4 py-6 px-8 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Layers size={24} />
              </div>
              <span className="text-sm sm:text-base font-bold tracking-tight leading-tight text-center">
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
                className="w-full bg-playful-purple dark:bg-plum text-white rounded-[32px] flex items-center justify-center gap-4 py-6 px-8 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all group"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={24} />
                </div>
                <span className="text-sm sm:text-base font-bold tracking-tight leading-tight text-center">
                  {state.primaryLanguage === 'es' ? 'repasar de nuevo' : 'review again'}
                </span>
              </motion.button>
            ) : (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => setIsAlmostDone(false)}
                className="text-xs font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-ivory/40 hover:text-playful-purple dark:hover:text-plum transition-colors py-2 flex items-center gap-2 group"
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
    <div className="flex-1 flex flex-col pt-2 pb-10">
      {/* Top Section - Citation & Progress */}
      <div className="px-6 sm:px-12 mb-6 sm:mb-10 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-playful-purple/10 dark:bg-plum/20 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full text-playful-purple dark:text-plum border border-playful-purple/20">
                {state.memorizeMode === 'both' ? 'Bilingual' : state.memorizeMode === 'es' ? 'Español' : 'English'}
              </span>
              <span className="text-earth/30 dark:text-ivory/30 text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                • {state.primaryLanguage === 'es' ? STAGES[stage - 1]?.es : STAGES[stage - 1]?.label}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-playful-purple dark:text-plum tracking-tight">
              {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
            </h2>
          </div>
          
          {/* Desktop Step Counter */}
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-playful-purple dark:text-plum lining-nums">{stage}</span>
              <span className="text-sm text-earth/30 dark:text-ivory/20 font-bold uppercase tracking-tighter">/ 5</span>
            </div>
          </div>
        </div>
        
        {/* Colorful Animated Progress Bar - SHARED ACROSS ALL VIEWPORTS */}
        <div className="h-4 sm:h-5 w-full bg-earth/10 dark:bg-white/10 rounded-full overflow-hidden p-1 relative mt-4 transition-all duration-500 shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-playful-purple via-sky-blue to-teal rounded-full relative overflow-hidden shadow-[0_0_15px_rgba(109,40,217,0.4)]"
            initial={{ width: 0 }}
            animate={{ width: `${(stage / 5) * 100}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
          >
            {/* Multiple Neon Scanners for "moving lights" effect */}
            {[0, 1, 2].map((i) => (
              <motion.div 
                key={i}
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md"
                animate={{ 
                  left: ["-20%", "120%"] 
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "linear",
                  delay: i * 0.7
                }}
              />
            ))}
            
            {/* Inner Glow / Pulse */}
            <motion.div 
              className="absolute inset-0 bg-white/10"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
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

            {/* Verse Content */}
            <div className="w-full flex-1 flex flex-col items-center justify-center py-2 sm:py-6">
              {state.memorizeMode === 'both' && !isMobile ? (
                <div className="flex flex-col gap-10 sm:gap-16 w-full max-w-4xl">
                  <div 
                    className={`space-y-4 sm:space-y-6 cursor-pointer transition-transform duration-300 ${activeLanguage === 'es' ? 'scale-[1.01]' : 'hover:scale-[1.005]'}`}
                    onClick={() => handleLanguageSwitch('es')}
                  >
                    <div className="flex items-center gap-4 opacity-20">
                      <div className="h-px flex-1 bg-playful-purple" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{esDetail.label}</span>
                      <div className="h-px flex-1 bg-playful-purple" />
                    </div>
                    {renderVerseContent(esText, userInputEs, 'es', activeLanguage === 'es')}
                  </div>
                  <div 
                    className={`space-y-4 sm:space-y-6 cursor-pointer transition-transform duration-300 ${activeLanguage === 'en' ? 'scale-[1.01]' : 'hover:scale-[1.005]'}`}
                    onClick={() => handleLanguageSwitch('en')}
                  >
                    <div className="flex items-center gap-4 opacity-20">
                      <div className="h-px flex-1 bg-golden" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{enDetail.label}</span>
                      <div className="h-px flex-1 bg-golden" />
                    </div>
                    {renderVerseContent(enText, userInputEn, 'en', activeLanguage === 'en')}
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-3xl">
                  {activeLanguage === 'es' 
                    ? renderVerseContent(esText, userInputEs, 'es', true)
                    : renderVerseContent(enText, userInputEn, 'en', true)
                  }
                </div>
              )}
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
                      className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-playful-purple/10 dark:bg-plum/10 border border-playful-purple/20 text-[10px] font-black uppercase tracking-widest text-playful-purple dark:text-plum shadow-sm hover:bg-playful-purple/20 transition-all active:scale-95 disabled:opacity-30"
                    >
                      <Sparkles size={16} />
                      <span>{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-6 bg-earth/5 dark:bg-white/5" />

              <div className="flex-1 flex justify-start">
                <button
                  onPointerDown={() => setIsRevealed(true)}
                  onPointerUp={() => setIsRevealed(false)}
                  onPointerLeave={() => setIsRevealed(false)}
                  className={`p-3 rounded-full transition-all duration-300 border flex items-center justify-center shadow-lg active:scale-90 ${
                    isRevealed 
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
        className="w-full flex-shrink-0 px-6 sm:px-12 pb-6 sm:pb-8 pt-4 relative z-[60]"
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
        <div className="h-8 flex justify-center items-center gap-3 mt-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div 
              key={s} 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                s === stage 
                  ? 'w-8 bg-playful-purple dark:bg-plum shadow-[0_0_10px_rgba(151,71,255,0.3)]' 
                  : s < stage ? 'w-1.5 bg-teal opacity-50' : 'w-1.5 bg-earth/10 dark:bg-white/10'
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
