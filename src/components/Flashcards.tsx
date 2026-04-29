import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, BookOpen, Brain, HelpCircle, Trophy, Star, Bookmark, CheckCircle2 } from "lucide-react";
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
  const [clueCount, setClueCount] = useState(0);
  const [revealedIndices, setRevealedIndices] = useState<{ es: number[], en: number[] }>({ es: [], en: [] });
  const [userInputEs, setUserInputEs] = useState("");
  const [userInputEn, setUserInputEn] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [showError, setShowError] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  
  const inputRefEs = React.useRef<HTMLInputElement>(null);
  const inputRefEn = React.useRef<HTMLInputElement>(null);

  const activePair = getCurrentTranslationPair(state);
  const today = getLocalDateString();
  const votd = getVerseByDate(today);
  
  const verse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || votd)
    : votd;

  const { esText, enText } = useMemo(() => 
    getValidatedVerse(verse, state),
    [verse, state]
  );

  // Reset state when verse or configuration changes
  useEffect(() => {
    setIsFlipped(false);
    setIsCompleted(false);
    setClueCount(0);
    setRevealedIndices({ es: [], en: [] });
    setUserInputEs("");
    setUserInputEn("");
    setIsCorrect(false);
    setShowError(false);
    setHasSubmitted(false);
    setAttemptsLeft(3);
  }, [verse.id, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode]);

  useEffect(() => {
    if (isCompleted) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
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
      
      // Streak Logic
      let newStreak = s.progress.currentStreak;
      let newBestStreak = s.progress.bestStreak;
      let newLastStreakDate = s.progress.lastStreakDate;
      let newLastCompletedDailyVerseDate = s.progress.lastCompletedDailyVerseDate;

      // Only increment streak if this is the first completion of the day
      if (s.progress.lastPracticeDate !== today) {
        // Check if it's a continuation of yesterday's streak
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

        if (s.progress.lastPracticeDate === yesterdayStr) {
          newStreak += 1;
        } else {
          // If they missed a day, streak starts over at 1 today
          newStreak = 1;
        }
        
        if (newStreak > newBestStreak) {
          newBestStreak = newStreak;
        }
        newLastStreakDate = today;
      }

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
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          lastPracticeDate: today,
          lastStreakDate: newLastStreakDate,
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

  const handleReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped(false);
    setClueCount(0);
    setRevealedIndices({ es: [], en: [] });
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

  const handleClue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clueCount >= 2) return;

    const newRevealed = { ...revealedIndices };
    
    const getUnrevealedFillableIndices = (ref: string, current: number[]) => {
      const indices: number[] = [];
      for (let i = 0; i < ref.length; i++) {
        if (/[\p{L}\p{N}]/u.test(ref[i]) && !current.includes(i)) {
          indices.push(i);
        }
      }
      return indices;
    };

    // Reveal one random character in Spanish reference
    let newlyRevealedEs: number | null = null;
    if (state.memorizeMode === 'es' || state.memorizeMode === 'both') {
      const esValid = getUnrevealedFillableIndices(esRef, revealedIndices.es);
      if (esValid.length > 0) {
        newlyRevealedEs = esValid[Math.floor(Math.random() * esValid.length)];
        newRevealed.es = [...newRevealed.es, newlyRevealedEs];
      }
    }

    // Reveal one random character in English reference
    let newlyRevealedEn: number | null = null;
    if (state.memorizeMode === 'en' || state.memorizeMode === 'both') {
      const enValid = getUnrevealedFillableIndices(enRef, revealedIndices.en);
      if (enValid.length > 0) {
        newlyRevealedEn = enValid[Math.floor(Math.random() * enValid.length)];
        newRevealed.en = [...newRevealed.en, newlyRevealedEn];
      }
    }

    // Adjust user input to prevent shifting
    if (newlyRevealedEs !== null) {
      let newInput = "";
      let inputPtr = 0;
      for (let i = 0; i < esRef.length; i++) {
        const isLetter = /[\p{L}\p{N}]/u.test(esRef[i]);
        if (isLetter) {
          const isAlreadyRevealed = revealedIndices.es.includes(i);
          if (!isAlreadyRevealed) {
            const userChar = userInputEs[inputPtr];
            if (userChar && i !== newlyRevealedEs) {
              newInput += userChar;
            }
            inputPtr++;
          }
        }
      }
      setUserInputEs(newInput);
    }

    if (newlyRevealedEn !== null) {
      let newInput = "";
      let inputPtr = 0;
      for (let i = 0; i < enRef.length; i++) {
        const isLetter = /[\p{L}\p{N}]/u.test(enRef[i]);
        if (isLetter) {
          const isAlreadyRevealed = revealedIndices.en.includes(i);
          if (!isAlreadyRevealed) {
            const userChar = userInputEn[inputPtr];
            if (userChar && i !== newlyRevealedEn) {
              newInput += userChar;
            }
            inputPtr++;
          }
        }
      }
      setUserInputEn(newInput);
    }

    setRevealedIndices(newRevealed);
    setClueCount(prev => prev + 1);
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

  const renderPlaceholder = (ref: string, revealed: number[], userInput: string, lang: 'es' | 'en') => {
    const fillableIndices = getFillableIndices(ref, revealed);
    const words = ref.split(' ');
    let charIndex = 0;
    const targetChars = getTargetChars(ref, revealed);

    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-4 w-full px-2">
        {words.map((word, wordIdx) => {
          const wordChars = word.split('');
          const wordStartIdx = charIndex;
          charIndex += word.length + 1; // +1 for space

          return (
            <div key={wordIdx} className="flex gap-x-1 whitespace-nowrap">
              {wordChars.map((char, i) => {
                const globalIdx = wordStartIdx + i;
                const isPunctuation = !/[\p{L}\p{N}]/u.test(char);
                
                if (isPunctuation) {
                  return (
                    <span key={i} className="text-xl sm:text-2xl font-serif font-black text-earth/40 dark:text-ivory/40 self-center">
                      {char}
                    </span>
                  );
                }
                
                const isRevealed = revealed.includes(globalIdx);
                const fillIdx = fillableIndices.indexOf(globalIdx);
                let userChar = "";
                let isWrong = false;
                
                if (!isRevealed) {
                  if (fillIdx !== -1 && fillIdx < userInput.length) {
                    userChar = userInput[fillIdx];
                    // Check if normalized character matches - only show error after submission
                    if (hasSubmitted && normalize(userChar) !== normalize(char)) {
                      isWrong = true;
                    }
                  }
                }

                const isCurrentCursor = !isRevealed && fillIdx === userInput.length && !isCorrect;
                
                return (
                  <span 
                    key={i} 
                    className={`w-4 sm:w-5 h-8 sm:h-10 flex items-center justify-center text-xl sm:text-2xl font-serif font-black border-b-2 transition-all duration-500 ${
                      isRevealed || userChar
                        ? isWrong 
                          ? 'border-coral text-coral bg-coral/5' 
                          : isCorrect || (hasSubmitted && !isWrong)
                            ? 'border-teal text-teal'
                            : 'border-playful-purple text-playful-purple' 
                        : isCurrentCursor
                          ? 'border-coral animate-pulse'
                          : 'border-earth/30 dark:border-white/30 text-transparent'
                    }`}
                  >
                    {isRevealed ? char : (userChar || '_')}
                  </span>
                );
              })}
            </div>
          );
        })}
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
    
    const esFilled = state.memorizeMode === 'en' || userInputEs.length === esTarget.length;
    const enFilled = state.memorizeMode === 'es' || userInputEn.length === enTarget.length;
    
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
            className="w-40 h-40 bg-gold rounded-[48px] flex items-center justify-center shadow-2xl shadow-gold/40"
            animate={{ 
              rotate: [0, 10, -10, 10, 0], 
              scale: [1, 1.1, 1],
              y: [0, -10, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Trophy size={80} className="text-white" fill="currentColor" />
          </motion.div>
          
          {/* Animated Stars */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                x: Math.cos(i * 45 * Math.PI / 180) * 120,
                y: Math.sin(i * 45 * Math.PI / 180) * 120,
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                rotate: [0, 180]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
            >
              <Star size={24} className="text-gold" fill="currentColor" />
            </motion.div>
          ))}
        </div>

        <div className="space-y-4 px-6">
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl font-serif font-black text-earth dark:text-ivory"
          >
            {state.primaryLanguage === 'es' ? '¡Increíble!' : 'Amazing!'}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto flex flex-col items-center gap-2"
          >
            <span>
              {state.primaryLanguage === 'es' 
                ? 'Has guardado este tesoro en tu corazón.' 
                : 'You have hidden this treasure in your heart.'}
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
                setClueCount(0);
                setRevealedIndices({ es: [], en: [] });
              }} 
              className="btn-primary w-full flex items-center justify-center gap-3 py-5"
            >
              <RotateCcw size={24} />
              <span className="text-lg font-black uppercase tracking-widest">{state.primaryLanguage === 'es' ? 'Repetir' : 'Repeat'}</span>
            </motion.button>
            
            <motion.button 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={onGoToSaved}
              className="w-full py-5 rounded-[32px] bg-white dark:bg-charcoal text-earth dark:text-ivory font-black text-lg flex items-center justify-center gap-3 hover:bg-earth/5 dark:hover:bg-white/5 transition-all shadow-xl border-2 border-earth/5 dark:border-white/5"
            >
              <Bookmark size={24} className="text-playful-purple dark:text-plum" fill="currentColor" />
              <span className="font-black uppercase tracking-widest">{state.primaryLanguage === 'es' ? 'Ver Mi Tesoro' : 'View My Treasure'}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col items-center">
      {/* Page Header */}
      <div className="w-full max-w-md space-y-1 text-center mb-4">
        <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory flex items-center justify-center gap-3">
          <Brain className="text-playful-purple" />
          <span>{state.primaryLanguage === 'es' ? 'Tarjetas' : 'Flashcards'}</span>
        </h2>
        <p className="text-xs font-black text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
          {state.primaryLanguage === 'es' ? 'Versículo del día' : 'Verse of the Day'}
        </p>
      </div>

      {/* Card Container */}
      <div className="relative w-full max-w-md h-[720px] perspective-1000">
        <motion.div
          className="w-full h-full preserve-3d cursor-pointer"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          onClick={onFlip}
        >
          {/* Front Side - Reference Recall Challenge */}
          <div className="absolute inset-0 backface-hidden">
            <div className="shimmer-border w-full h-full rounded-[32px]">
              <div className="w-full h-full card flex flex-col bg-white dark:bg-charcoal shadow-2xl overflow-hidden rounded-[32px] border-none">
                <div className="flex-1 flex flex-col p-8 sm:p-10 justify-between">
                  <div>
                    {/* Top Icon/Badge */}
                    <div className="flex justify-center mb-6">
                      <div className="w-12 h-12 bg-playful-purple/10 rounded-2xl flex items-center justify-center text-playful-purple">
                        <HelpCircle size={24} />
                      </div>
                    </div>

                    {/* Translation Labels */}
                    <div className="flex justify-center gap-2 mb-8">
                      {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                        <span className="text-[10px] font-black uppercase tracking-tighter text-playful-purple bg-playful-purple/10 dark:bg-plum/20 px-2 py-0.5 rounded border border-playful-purple/20 dark:border-plum/30">
                          {activePair.es}
                        </span>
                      )}
                      {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                        <span className="text-[10px] font-black uppercase tracking-tighter text-golden bg-golden/10 dark:bg-gold/20 px-2 py-0.5 rounded border border-golden/20 dark:border-gold/30">
                          {activePair.en}
                        </span>
                      )}
                    </div>

                    {/* Reference Placeholder Area */}
                    <div className="flex flex-col justify-center items-center space-y-8">
                      {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                        <div 
                          className="space-y-4 w-full cursor-text"
                          onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEs.current?.focus(); }}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 text-center">
                            {state.primaryLanguage === 'es' ? 'Escribe la cita bíblica (ES)' : 'Type the citation (ES)'}
                          </p>
                          <input 
                            ref={inputRefEs}
                            type="text"
                            value={userInputEs}
                            disabled={isCorrect || attemptsLeft === 0}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\p{L}\p{N}]/gu, "");
                              const max = getFillableIndices(esRef, revealedIndices.es).length;
                              setUserInputEs(val.slice(0, max));
                              setHasSubmitted(false);
                            }}
                            className="sr-only"
                          />
                          <div className="flex justify-center">
                            {renderPlaceholder(esRef, revealedIndices.es, userInputEs, 'es')}
                          </div>
                        </div>
                      )}
                      
                      {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                        <div 
                          className="space-y-4 w-full cursor-text"
                          onClick={(e) => { e.stopPropagation(); if (!isCorrect && attemptsLeft > 0) inputRefEn.current?.focus(); }}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 text-center">
                            {state.primaryLanguage === 'es' ? 'Type the reference (EN)' : 'Type the reference (EN)'}
                          </p>
                          <input 
                            ref={inputRefEn}
                            type="text"
                            value={userInputEn}
                            disabled={isCorrect || attemptsLeft === 0}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\p{L}\p{N}]/gu, "");
                              const max = getFillableIndices(enRef, revealedIndices.en).length;
                              setUserInputEn(val.slice(0, max));
                              setHasSubmitted(false);
                            }}
                            className="sr-only"
                          />
                          <div className="flex justify-center">
                            {renderPlaceholder(enRef, revealedIndices.en, userInputEn, 'en')}
                          </div>
                        </div>
                      )}

                      {showError && (
                        <motion.p 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-black uppercase tracking-widest text-coral text-center"
                        >
                          {state.primaryLanguage === 'es' 
                            ? 'Esa no es la cita bíblica correcta. Inténtalo de nuevo.' 
                            : 'Not quite. That’s not the right citation yet. Try again.'}
                        </motion.p>
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
                  </div>

                  {/* Submit Button & Clue Area */}
                  <div className="flex flex-col items-center gap-6">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                      disabled={!canSubmit}
                      className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
                        canSubmit
                          ? 'bg-playful-purple text-white shadow-playful-purple/20 hover:scale-[1.02] active:scale-95'
                          : 'bg-earth/5 dark:bg-white/5 text-earth/20 dark:text-white/20 cursor-not-allowed'
                      }`}
                    >
                      {state.primaryLanguage === 'es' ? 'Comprobar' : 'Check Answer'}
                    </button>

                    <div className="flex flex-col items-center gap-4 w-full">
                      <button
                        onClick={handleClue}
                        disabled={clueCount >= 2 || isCorrect || attemptsLeft === 0}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                          clueCount >= 2 || isCorrect || attemptsLeft === 0
                            ? 'bg-earth/5 dark:bg-white/5 text-earth/20 dark:text-white/20 cursor-not-allowed'
                            : 'bg-playful-purple/10 text-playful-purple hover:bg-playful-purple/20 active:scale-95'
                        }`}
                      >
                        <Sparkles size={16} />
                        <span>{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'} ({2 - clueCount})</span>
                      </button>
                      
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-playful-purple animate-pulse">
                          {state.primaryLanguage === 'es' ? 'Toca para revelar si te rindes' : 'Tap to reveal if you give up'}
                        </p>
                        <div className="flex items-center gap-4">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-earth-light/30">
                            {state.primaryLanguage === 'es' ? `Intentos restantes: ${attemptsLeft}` : `Attempts left: ${attemptsLeft}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="shimmer-border w-full h-full rounded-[32px]">
              <div className="w-full h-full card flex flex-col bg-sky-blue/5 dark:bg-sky-blue/10 border-none shadow-2xl overflow-hidden rounded-[32px]">
                <div className="flex-1 flex flex-col p-8 sm:p-10 justify-between">
                  <div>
                    {/* Top Icon/Badge */}
                    <div className="flex justify-center mb-6">
                      <div className="w-12 h-12 bg-sky-blue/10 rounded-2xl flex items-center justify-center text-sky-blue">
                        <BookOpen size={24} />
                      </div>
                    </div>

                    {/* Revealed Reference Area */}
                    <div className="text-center mb-6">
                      <h3 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                        {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-blue mt-1">
                        {state.memorizeMode === 'both' 
                          ? `${activePair.es} + ${activePair.en}`
                          : state.memorizeMode === 'es' ? activePair.es : activePair.en
                        }
                      </p>
                    </div>

                    {/* Verse Text Area */}
                    <div className="flex flex-col justify-center items-center text-center space-y-4">
                      {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                        <div className={`space-y-1 font-serif font-bold text-earth/80 dark:text-ivory/80 ${VERSE_LAYOUT.LINE_HEIGHT}`}>
                          {getVerseLines(esText).map((line, i) => (
                            <p key={i} className="text-lg sm:text-xl">
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                      {state.memorizeMode === 'both' && (
                        <div className="h-px w-8 bg-sky-blue/20 mx-auto" />
                      )}
                      {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                        <div className={`space-y-1 font-serif text-earth-light/70 dark:text-lavender-muted/70 ${VERSE_LAYOUT.LINE_HEIGHT}`}>
                          {getVerseLines(enText).map((line, i) => (
                            <p key={i} className="text-base sm:text-lg">
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Completion Action - Appears only when correct */}
      <div className="w-full max-w-md h-24 flex items-center justify-center">
        <AnimatePresence>
          {isCorrect && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full px-4"
            >
              <button
                onClick={handleComplete}
                className="w-full bg-teal text-white rounded-[24px] py-6 flex items-center justify-center gap-3 shadow-xl shadow-teal/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <CheckCircle2 size={24} />
                <span className="text-lg font-black uppercase tracking-widest">
                  {state.primaryLanguage === 'es' ? 'Versículo Memorizado' : 'Verse Memorized'}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset Control - Consistent and clear */}
      <div className="flex justify-center pt-4">
        <button 
          onClick={handleReset}
          className="btn-icon w-14 h-14 rounded-2xl bg-white dark:bg-charcoal shadow-xl hover:text-playful-purple transition-all"
          title={state.primaryLanguage === 'es' ? 'Reiniciar' : 'Reset'}
        >
          <RotateCcw size={28} />
        </button>
      </div>
    </div>
  );
}
