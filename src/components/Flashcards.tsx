import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, BookOpen, Brain, HelpCircle, Trophy, Star, Bookmark, CheckCircle2, ArrowRight, Flower2, Sprout, Compass, Layers } from "lucide-react";
import { getValidatedVerse, getCurrentTranslationPair, getLocalizedBookName, getLocalDateString, getVerseLines, removeAccents, VERSE_LAYOUT } from "../utils/verseUtils";
import confetti from "canvas-confetti";

interface FlashcardsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onMemorize: (verseId: string) => void;
  onGoToSaved?: () => void;
}

export default function Flashcards({ state, setState, onMemorize, onGoToSaved }: FlashcardsProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [clueCount, setClueCount] = useState<{ es: number, en: number }>({ es: 0, en: 0 });
  const [revealedIndices, setRevealedIndices] = useState<{ es: number[], en: number[] }>({ es: [], en: [] });
  const [activeLanguage, setActiveLanguage] = useState<'es' | 'en' | null>(null);
  const [cursorPositionEs, setCursorPositionEs] = useState<number>(0);
  const [cursorPositionEn, setCursorPositionEn] = useState<number>(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showError, setShowError] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  
  const inputRefEs = React.useRef<HTMLInputElement>(null);
  const inputRefEn = React.useRef<HTMLInputElement>(null);

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

  const activePair = getCurrentTranslationPair(state);
  const today = getLocalDateString();
  const votd = getVerseByDate(today);

  // TEMPORARY QA OVERRIDE: Set Song of Songs for testing
  // To remove: delete these lines and the songOfSongs fallback
  const songOfSongs: any = {
    id: "qa-song-of-songs",
    book: "Cantar de Cantares / Song of Songs",
    chapter: 8,
    verse: 7,
    text: {
      es: { RVR1960: "Las muchas aguas no podrán apagar el amor, ni lo ahogarán los ríos.", NVI: "", NBLA: "", KJV: "", NIV: "", NASB: "" },
      en: { KJV: "Many waters cannot quench love, neither can the floods drown it.", NIV: "", NASB: "", RVR1960: "", NVI: "", NBLA: "" }
    }
  };

  const verse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || votd)
    : songOfSongs; // Temporarily forced to Song of Songs for QA

  const { esText, enText } = useMemo(() => 
    getValidatedVerse(verse, state),
    [verse, state]
  );

  // Reset state when verse or configuration changes
  useEffect(() => {
    setIsFlipped(false);
    setIsCompleted(false);
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
    setAttemptsLeft(3);
  }, [verse.id, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode]);

  useEffect(() => {
    if (isCompleted) {
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
  }, [isCompleted]);

  const onFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleComplete = () => {
    setIsCompleted(true);
    
    const today = getLocalDateString();
    
    // Mark as completed in global state
    setState(s => {
      const isAlreadyCompleted = s.progress.completedVerses.includes(verse.id);
      const today = getLocalDateString();
      let newLastCompletedDailyVerseDate = s.progress.lastCompletedDailyVerseDate;

      // Track if this was the daily verse
      if (verse.id === votd.id) {
        newLastCompletedDailyVerseDate = today;
      }

      return {
        ...s,
        progress: {
          ...s.progress,
          totalMemorized: isAlreadyCompleted ? s.progress.totalMemorized : s.progress.totalMemorized + 1,
          completedVerses: isAlreadyCompleted ? s.progress.completedVerses : [...s.progress.completedVerses, verse.id],
          lastCompletedDailyVerseDate: newLastCompletedDailyVerseDate,
        }
      };
    });
  };

  const showBilingual = state.memorizeMode === 'both';

  // Split book names
  const [esBook, enBook] = useMemo(() => {
    const parts = verse.book.split(' / ');
    return [parts[0], parts[1] || parts[0]];
  }, [verse.book]);

  const esRef = `${esBook} ${verse.chapter}:${verse.verse}`;
  const enRef = `${enBook} ${verse.chapter}:${verse.verse}`;

  const [userInputEs, setUserInputEs] = useState("");
  const [userInputEn, setUserInputEn] = useState("");
  
  // Initialize user inputs with spaces when verse or mode changes
  useEffect(() => {
    const esTarget = getTargetChars(esRef, revealedIndices.es);
    const enTarget = getTargetChars(enRef, revealedIndices.en);
    
    setUserInputEs(" ".repeat(esTarget.length));
    setUserInputEn(" ".repeat(enTarget.length));
  }, [verse.id, state.memorizeMode]);

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
    setAttemptsLeft(3);
  };

  const normalize = (str: string) => {
    return removeAccents(str)
      .toLowerCase()
      .trim();
  };

  // Citation clue logic: exactly 1 random useful clue per language
  const handleClue = (e: React.MouseEvent, lang: 'es' | 'en') => {
    e.stopPropagation();
    if (clueCount[lang] >= 1) return;

    const ref = lang === 'es' ? esRef : enRef;
    const userInput = lang === 'es' ? userInputEs : userInputEn;
    const fillableIndices = getFillableIndices(ref, revealedIndices[lang]);
    
    // Find book name vs numbers part for prioritization
    const parts = ref.split(' ');
    const numbersPart = parts[parts.length - 1]; 
    const numberStartIdx = ref.lastIndexOf(numbersPart);

    // Eligible indices are those that are fillable AND NOT correctly typed by user
    const eligibleIndices = fillableIndices.filter(idx => {
      const char = ref[idx];
      const fillIdx = fillableIndices.indexOf(idx);
      const userChar = userInput[fillIdx];
      // Eligible if slot is empty OR user typed it incorrectly
      return !userChar || userChar === " " || normalize(userChar) !== normalize(char);
    });

    if (eligibleIndices.length === 0) return;

    // Prioritize letters (book name) over digits (chapter/verse)
    const letterIndices = eligibleIndices.filter(idx => idx < numberStartIdx && /[\p{L}]/u.test(ref[idx]));
    const digitIndices = eligibleIndices.filter(idx => idx >= numberStartIdx && /[\p{N}]/u.test(ref[idx]));

    let chosenIdx: number;
    if (letterIndices.length > 0) {
      chosenIdx = letterIndices[Math.floor(Math.random() * letterIndices.length)];
    } else {
      chosenIdx = digitIndices[Math.floor(Math.random() * digitIndices.length)];
    }

    const newRevealed = { ...revealedIndices };
    newRevealed[lang] = [...newRevealed[lang], chosenIdx].sort((a, b) => a - b);
    
    // Adjust user input to account for the new revealed character
    const setInput = lang === 'es' ? setUserInputEs : setUserInputEn;
    const removedFillIdx = fillableIndices.indexOf(chosenIdx);
    
    if (removedFillIdx !== -1) {
      let newUserInput = userInput.split('');
      newUserInput.splice(removedFillIdx, 1);
      setInput(newUserInput.join(''));
      
      const setCursor = lang === 'es' ? setCursorPositionEs : setCursorPositionEn;
      const currentCursor = lang === 'es' ? cursorPositionEs : cursorPositionEn;
      if (currentCursor > removedFillIdx) {
        setCursor(currentCursor - 1);
      }
    }

    setRevealedIndices(newRevealed);
    setClueCount(prev => ({ ...prev, [lang]: prev[lang] + 1 }));
  };

  const getFillableIndices = (ref: string, revealed: number[]) => {
    const indices: number[] = [];
    for (let i = 0; i < ref.length; i++) {
      const char = ref[i];
      // Check if it's a letter or number
      if (/[\p{L}\p{N}]/u.test(char) && !revealed.includes(i)) {
        indices.push(i);
      }
    }
    return indices;
  };

  const handleCharClick = (lang: 'es' | 'en', fillIdx: number) => {
    if (isCorrect || attemptsLeft === 0 || isFlipped) return;
    
    const setCursor = lang === 'es' ? setCursorPositionEs : setCursorPositionEn;
    setCursor(fillIdx);
    setActiveLanguage(lang);
    
    const inputRef = lang === 'es' ? inputRefEs : inputRefEn;
    if (inputRef.current) {
      inputRef.current.focus();
      // Use a slightly longer timeout or requestAnimationFrame to ensure focus is solid
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(fillIdx, fillIdx + 1);
        }
      }, 50);
    }
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
                        isRevealedByClue || (userChar && userChar !== " ")
                          ? isWrong 
                            ? 'border-coral text-coral bg-coral/5' 
                            : isCorrect || (hasSubmitted && !isWrong)
                              ? 'border-teal text-teal'
                              : 'border-playful-purple text-playful-purple' 
                          : 'border-earth/20 dark:border-white/20 text-transparent hover:border-earth/40'
                      }`}
                    >
                      {isRevealedByClue ? char : (userChar === " " ? "" : userChar)}
                      {isSlotActive && !isRevealedByClue && !isCorrect && (
                        <div className="absolute inset-x-0 -bottom-[2.5px] h-[2.5px] bg-coral animate-pulse shadow-[0_0_8px_rgba(255,111,97,0.5)]" />
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
                  isRevealedByClue || (userChar && userChar !== " ")
                    ? isWrong 
                      ? 'border-coral text-coral bg-coral/5' 
                      : isCorrect || (hasSubmitted && !isWrong)
                        ? 'border-teal text-teal'
                        : 'border-playful-purple text-playful-purple' 
                    : 'border-earth/20 dark:border-white/20 text-transparent hover:border-earth/40'
                }`}
              >
                {isRevealedByClue ? char : (userChar === " " ? "" : userChar)}
                {isSlotActive && !isRevealedByClue && !isCorrect && (
                  <div className="absolute inset-x-0 -bottom-[2.5px] h-[2.5px] bg-coral animate-pulse shadow-[0_0_8px_rgba(255,111,97,0.5)]" />
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

  const handleSubmit = () => {
    const esTarget = getTargetChars(esRef, revealedIndices.es);
    const enTarget = getTargetChars(enRef, revealedIndices.en);
    
    const esMatch = state.memorizeMode === 'en' || normalize(userInputEs) === normalize(esTarget);
    const enMatch = state.memorizeMode === 'es' || normalize(userInputEn) === normalize(enTarget);

    setHasSubmitted(true);

    if (esMatch && enMatch) {
      setIsCorrect(true);
      setShowError(false);
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
      setAttemptsLeft(prev => Math.max(0, prev - 1));
      
      // Shake effect or similar feedback could be added here
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

  if (isCompleted) {
    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10 py-12"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        <div className="relative">
          <motion.div 
            className="w-40 h-40 bg-amber-50 dark:bg-amber-950/20 rounded-[48px] flex items-center justify-center shadow-2xl shadow-amber-500/10 border border-amber-200/50 dark:border-amber-500/20"
            animate={{ 
              rotate: [0, 5, -5, 5, 0], 
              scale: [1, 1.05, 1],
              y: [0, -8, 0]
            }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Flower2 size={80} className="text-amber-500 dark:text-amber-400" strokeWidth={1.2} />
          </motion.div>
          
          {/* Animated "Pollen/Dust" stars in warm tones */}
          {[...Array(8)].map((_, i) => (
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
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 blur-[1px]" />
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
            {state.primaryLanguage === 'es' ? '¡Increíble!' : 'Incredible!'}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto flex flex-col items-center gap-2"
          >
            <span>
              {state.primaryLanguage === 'es' 
                ? 'Has guardado su Palabra en tu corazón.' 
                : 'You’ve stored His Word in your heart.'}
            </span>
            <span className="text-sm font-black text-playful-purple dark:text-plum uppercase tracking-widest mt-2">
              {state.primaryLanguage === 'es' ? 'Un versículo por día.' : 'One verse a day.'}
            </span>
          </motion.p>
        </div>

        <div className="w-full max-w-sm space-y-6 px-6">
          <div className="space-y-4">
            <motion.button 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => {
                setIsFlipped(false);
                setIsCompleted(false);
                setClueCount({ es: 0, en: 0 });
                setRevealedIndices({ es: [], en: [] });
                setActiveLanguage(null);
                setCursorPositionEs(0);
                setCursorPositionEn(0);
              }} 
              className="btn-primary w-full flex items-center justify-center gap-3 py-5 shadow-playful-purple/20"
            >
              <RotateCcw size={20} />
              <span className="text-lg font-bold tracking-tight lowercase">{state.primaryLanguage === 'es' ? 'repetir' : 'repeat'}</span>
            </motion.button>
            
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
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div id="cards-content" className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header - Refined for Consistency and Left Aligned with Card */}
      <div className="w-full max-w-xl mx-auto px-1 mb-8 sm:mb-10">
        <div className="flex flex-col space-y-2 sm:space-y-3 pl-5 sm:pl-9">
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
      </div>

      {/* Card Container - Adjusted for Breathing Room */}
      <div className="flex flex-col items-center px-6">
        <div className="relative w-full max-w-xl h-[680px] sm:h-[760px] lg:h-[820px] perspective-1000 mb-10">
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
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-teal bg-teal/5 dark:bg-teal/10 px-3 py-1 rounded-full border border-teal/20">
                          {activePair.es}
                        </span>
                      )}
                      {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-600 bg-amber-500/5 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                          {activePair.en}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Section - Reference Placeholder Area */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-8 sm:space-y-14">
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div 
                        className="space-y-5 sm:space-y-8 w-full cursor-text flex flex-col items-center"
                        onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEs.current?.focus(); }}
                      >
                        <div className="flex items-center gap-3 opacity-60 mb-2 mt-2">
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          <p className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.4em] text-earth-light dark:text-parchment text-center antialiased">
                            {state.primaryLanguage === 'es' ? 'Cita (ES)' : 'Citation (ES)'}
                          </p>
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          
                          {/* Language-specific clue button */}
                          {attemptsLeft > 0 && !isCorrect && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={(e) => handleClue(e, 'es')}
                              disabled={clueCount.es >= 1}
                              className={`ml-2 p-1.5 rounded-lg transition-all ${
                                clueCount.es >= 1
                                  ? 'text-earth/10 dark:text-white/10 opacity-0 pointer-events-none'
                                  : 'text-amber-500 hover:bg-amber-500/10 active:scale-95'
                              }`}
                              title={state.primaryLanguage === 'es' ? `Pista (${1 - clueCount.es})` : `Clue (${1 - clueCount.es})`}
                            >
                              <Sparkles size={14} className={clueCount.es >= 1 ? '' : 'animate-pulse'} />
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
                            if (e.key === 'Backspace' && inputRefEs.current) {
                              const start = inputRefEs.current.selectionStart;
                              const end = inputRefEs.current.selectionEnd;
                              if (start !== null && end !== null) {
                                e.preventDefault();
                                const newStart = start === end ? Math.max(0, start - 1) : start;
                                const newVal = userInputEs.split('');
                                for (let i = newStart; i < end || (start === end && i === newStart); i++) {
                                  newVal[i] = ' ';
                                }
                                setUserInputEs(newVal.join(''));
                                setCursorPositionEs(newStart);
                                setTimeout(() => inputRefEs.current?.setSelectionRange(newStart, newStart), 0);
                              }
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\p{L}\p{N}]/gu, "");
                            const selectionStart = e.target.selectionStart;
                            
                            if (selectionStart !== null) {
                              const typedChar = val.charAt(selectionStart - 1);
                              if (typedChar) {
                                const newVal = userInputEs.split('');
                                newVal[selectionStart - 1] = typedChar;
                                setUserInputEs(newVal.join(''));
                                setCursorPositionEs(selectionStart);
                                setTimeout(() => inputRefEs.current?.setSelectionRange(selectionStart, selectionStart), 0);
                              }
                            }
                            
                            setHasSubmitted(false);
                            setShowError(false);
                          }}
                          className="sr-only"
                        />
                        <div className="flex justify-center w-full">
                          {renderPlaceholder(esRef, revealedIndices.es, userInputEs, 'es')}
                        </div>
                      </div>
                    )}
                    
                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div 
                        className="space-y-5 sm:space-y-8 w-full cursor-text flex flex-col items-center"
                        onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEn.current?.focus(); }}
                      >
                        <div className="flex items-center gap-3 opacity-60 mb-2 mt-2">
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          <p className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.4em] text-earth-light dark:text-parchment text-center antialiased">
                            {state.primaryLanguage === 'es' ? 'Cita (EN)' : 'Citation (EN)'}
                          </p>
                          <div className="h-px w-8 bg-earth/20 dark:bg-white/20" />
                          
                          {/* Language-specific clue button */}
                          {attemptsLeft > 0 && !isCorrect && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={(e) => handleClue(e, 'en')}
                              disabled={clueCount.en >= 1}
                              className={`ml-2 p-1.5 rounded-lg transition-all ${
                                clueCount.en >= 1
                                  ? 'text-earth/10 dark:text-white/10 opacity-0 pointer-events-none'
                                  : 'text-amber-500 hover:bg-amber-500/10 active:scale-95'
                              }`}
                              title={state.primaryLanguage === 'es' ? `Pista (${1 - clueCount.en})` : `Clue (${1 - clueCount.en})`}
                            >
                              <Sparkles size={14} className={clueCount.en >= 1 ? '' : 'animate-pulse'} />
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
                            if (e.key === 'Backspace' && inputRefEn.current) {
                              const start = inputRefEn.current.selectionStart;
                              const end = inputRefEn.current.selectionEnd;
                              if (start !== null && end !== null) {
                                e.preventDefault();
                                const newStart = start === end ? Math.max(0, start - 1) : start;
                                const newVal = userInputEn.split('');
                                for (let i = newStart; i < end || (start === end && i === newStart); i++) {
                                  newVal[i] = ' ';
                                }
                                setUserInputEn(newVal.join(''));
                                setCursorPositionEn(newStart);
                                setTimeout(() => inputRefEn.current?.setSelectionRange(newStart, newStart), 0);
                              }
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\p{L}\p{N}]/gu, "");
                            const selectionStart = e.target.selectionStart;
                            
                            if (selectionStart !== null) {
                              const typedChar = val.charAt(selectionStart - 1);
                              if (typedChar) {
                                const newVal = userInputEn.split('');
                                newVal[selectionStart - 1] = typedChar;
                                setUserInputEn(newVal.join(''));
                                setCursorPositionEn(selectionStart);
                                setTimeout(() => inputRefEn.current?.setSelectionRange(selectionStart, selectionStart), 0);
                              }
                            }
                            
                            setHasSubmitted(false);
                            setShowError(false);
                          }}
                          className="sr-only"
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
                            {state.primaryLanguage === 'es' ? 'Esta vez no.' : 'Not this time.'}
                          </p>
                          <p className="text-[11px] text-earth-light/60 dark:text-lavender-muted/60 font-medium">
                            {state.primaryLanguage === 'es' ? 'Repasemos este versículo.' : 'Let’s review this verse again.'}
                          </p>
                        </div>
                        <button
                          onClick={() => onMemorize(verse.id)}
                          className="bg-coral/10 text-coral border border-coral/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-coral/20 transition-all active:scale-95"
                        >
                          {state.primaryLanguage === 'es' ? 'repasar' : 'review'}
                        </button>
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
                          className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            clueCount[state.memorizeMode as 'es' | 'en'] >= 1
                              ? 'text-earth/20 dark:text-white/20 cursor-not-allowed border border-earth/10 opacity-0 pointer-events-none'
                              : 'bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 shadow-sm active:scale-95'
                          }`}
                        >
                          <Sparkles size={14} className={clueCount[state.memorizeMode as 'es' | 'en'] >= 1 ? '' : 'animate-pulse text-amber-500 dark:text-amber-400'} />
                          <span>{state.primaryLanguage === 'es' ? 'pista' : 'clue'} ({1 - clueCount[state.memorizeMode as 'es' | 'en']})</span>
                        </button>
                      )}
                      
                      <div className="opacity-40">
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-earth-light dark:text-lavender-muted">
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
                onClick={(e) => { e.stopPropagation(); onFlip(); }}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all border-4 border-white dark:border-charcoal relative group ${
                  isFlipped 
                    ? 'bg-sky-blue text-white rotate-180' 
                    : 'bg-playful-purple text-white rotate-0'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={state.primaryLanguage === 'es' ? 'voltear tarjeta' : 'flip card'}
              >
                <RotateCcw size={24} />
                {!isFlipped && (
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
                        <h3 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                          {(() => {
                            const parts = verse.book.split(' / ');
                            const esBook = parts[0];
                            const enBook = parts[1] || parts[0];
                            if (state.memorizeMode === 'es') return esBook;
                            if (state.memorizeMode === 'en') return enBook;
                            return state.primaryLanguage === 'es' ? `${esBook} / ${enBook}` : `${enBook} / ${esBook}`;
                          })()} {verse.chapter}:{verse.verse}
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
                              <p key={i} className="text-base sm:text-xl leading-relaxed">
                                {line}
                              </p>
                            ))}
                          </div>
                        );

                        const enBlock = (state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                          <div key="en" className={`space-y-1 font-serif font-bold text-earth/80 dark:text-ivory/80 ${VERSE_LAYOUT.LINE_HEIGHT}`}>
                            {getVerseLines(enText).map((line, i) => (
                              <p key={i} className="text-base sm:text-xl leading-relaxed">
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

      {/* External Action Area */}
      <div className="w-full max-w-md flex flex-col items-center gap-6 mt-4 mb-20">
        <AnimatePresence mode="wait">
          {isCorrect ? (
            <motion.div
              key="success-action"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full px-4"
            >
              <button
                onClick={handleComplete}
                className="w-full bg-teal text-white rounded-[24px] py-5 flex items-center justify-center gap-3 shadow-xl shadow-teal/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <CheckCircle2 size={24} />
                <span className="text-lg font-bold tracking-tight lowercase">
                  {state.primaryLanguage === 'es' ? 'versículo memorizado' : 'verse memorized'}
                </span>
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
    </div>
  </div>
);
}
