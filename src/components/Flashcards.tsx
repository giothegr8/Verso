import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState } from "../types";
import { VERSE_OF_THE_DAY, MOCK_VERSES } from "../constants";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, BookOpen, Brain, HelpCircle, Trophy, Star, Bookmark, CheckCircle2 } from "lucide-react";
import { getValidatedVerse, getCurrentTranslationPair } from "../utils/verseUtils";
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
  
  const activePair = getCurrentTranslationPair(state);
  const verse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || VERSE_OF_THE_DAY)
    : VERSE_OF_THE_DAY;

  const { esText, enText } = useMemo(() => 
    getValidatedVerse(verse, state),
    [verse, state]
  );

  // Reset state when verse changes
  useEffect(() => {
    setIsFlipped(false);
    setIsCompleted(false);
    setClueCount(0);
    setRevealedIndices({ es: [], en: [] });
  }, [verse.id]);

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
    
    // Mark as completed in global state
    setState(s => {
      const isAlreadyCompleted = s.progress.completedVerses.includes(verse.id);
      return {
        ...s,
        progress: {
          ...s.progress,
          totalMemorized: isAlreadyCompleted ? s.progress.totalMemorized : s.progress.totalMemorized + 1,
          completedVerses: isAlreadyCompleted ? s.progress.completedVerses : [...s.progress.completedVerses, verse.id],
        }
      };
    });
  };

  const showBilingual = state.languageMode === 'both';

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
  };

  const handleClue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clueCount >= 2) return;

    const newRevealed = { ...revealedIndices };
    
    const getValidIndices = (str: string, current: number[]) => {
      const indices: number[] = [];
      for (let i = 0; i < str.length; i++) {
        // Use a more inclusive regex for letters (including unicode) and numbers
        if (/[\p{L}\p{N}]/u.test(str[i]) && !current.includes(i)) {
          indices.push(i);
        }
      }
      return indices;
    };

    // Reveal one random character in Spanish reference
    if (state.languageMode === 'es' || state.languageMode === 'both') {
      const esValid = getValidIndices(esRef, revealedIndices.es);
      if (esValid.length > 0) {
        const pick = esValid[Math.floor(Math.random() * esValid.length)];
        newRevealed.es = [...newRevealed.es, pick];
      }
    }

    // Reveal one random character in English reference
    if (state.languageMode === 'en' || state.languageMode === 'both') {
      const enValid = getValidIndices(enRef, revealedIndices.en);
      if (enValid.length > 0) {
        const pick = enValid[Math.floor(Math.random() * enValid.length)];
        newRevealed.en = [...newRevealed.en, pick];
      }
    }

    setRevealedIndices(newRevealed);
    setClueCount(prev => prev + 1);
  };

  const renderPlaceholder = (ref: string, revealed: number[]) => {
    // Group by words to prevent mid-word breaks
    const words = ref.split(' ');
    let charIndex = 0;

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
                const isPunctuation = [':', ',', '.', '-', '(', ')'].includes(char);
                
                if (isPunctuation) {
                  return (
                    <span key={i} className="text-xl sm:text-2xl font-serif font-black text-earth/40 dark:text-ivory/40 self-center">
                      {char}
                    </span>
                  );
                }
                
                const isRevealed = revealed.includes(globalIdx);
                return (
                  <span 
                    key={i} 
                    className={`w-4 sm:w-5 h-8 sm:h-10 flex items-center justify-center text-xl sm:text-2xl font-serif font-black border-b-2 transition-all duration-500 ${
                      isRevealed 
                        ? 'border-playful-purple text-playful-purple' 
                        : 'border-earth/30 dark:border-white/30 text-transparent'
                    }`}
                  >
                    {isRevealed ? char : '_'}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

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
            className="text-xl text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto"
          >
            {state.primaryLanguage === 'es' 
              ? 'Has guardado este tesoro en tu corazón.' 
              : 'You have hidden this treasure in your heart.'}
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
                      <span className="text-[10px] font-black uppercase tracking-tighter text-playful-purple bg-playful-purple/10 dark:bg-plum/20 px-2 py-0.5 rounded border border-playful-purple/20 dark:border-plum/30">
                        {activePair.es}
                      </span>
                      {showBilingual && (
                        <span className="text-[10px] font-black uppercase tracking-tighter text-golden bg-golden/10 dark:bg-gold/20 px-2 py-0.5 rounded border border-golden/20 dark:border-gold/30">
                          {activePair.en}
                        </span>
                      )}
                    </div>

                    {/* Reference Placeholder Area */}
                    <div className="flex flex-col justify-center items-center space-y-12">
                      {(state.languageMode === 'es' || state.languageMode === 'both') && (
                        <div className="space-y-2 w-full">
                          <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 text-center mb-2">
                            {state.primaryLanguage === 'es' ? 'Cita bíblica (ES)' : 'Cita bíblica (ES)'}
                          </p>
                          {renderPlaceholder(esRef, revealedIndices.es)}
                        </div>
                      )}
                      
                      {(state.languageMode === 'en' || state.languageMode === 'both') && (
                        <div className="space-y-2 w-full">
                          <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 text-center mb-2">
                            {state.primaryLanguage === 'es' ? 'Reference (EN)' : 'Reference (EN)'}
                          </p>
                          {renderPlaceholder(enRef, revealedIndices.en)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clue Button Area - Fully inside the card */}
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={handleClue}
                      disabled={clueCount >= 2}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                        clueCount >= 2
                          ? 'bg-earth/5 dark:bg-white/5 text-earth/20 dark:text-white/20 cursor-not-allowed'
                          : 'bg-playful-purple/10 text-playful-purple hover:bg-playful-purple/20 active:scale-95'
                      }`}
                    >
                      <Sparkles size={16} />
                      <span>{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'} ({2 - clueCount})</span>
                    </button>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/40">
                      {state.primaryLanguage === 'es' ? 'Toca la tarjeta para revelar' : 'Tap card to reveal'}
                    </p>
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
                        {verse.book} {verse.chapter}:{verse.verse}
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-blue mt-1">
                        {activePair.es} {showBilingual && `+ ${activePair.en}`}
                      </p>
                    </div>

                    {/* Verse Text Area */}
                    <div className="flex flex-col justify-center items-center text-center space-y-4">
                      {(state.languageMode === 'es' || state.languageMode === 'both') && (
                        <p className="text-lg sm:text-xl font-serif font-bold text-earth/80 dark:text-ivory/80 leading-relaxed">
                          {esText}
                        </p>
                      )}
                      {state.languageMode === 'both' && (
                        <div className="h-px w-8 bg-sky-blue/20 mx-auto" />
                      )}
                      {(state.languageMode === 'en' || state.languageMode === 'both') && (
                        <p className="text-base sm:text-lg font-serif text-earth-light/70 dark:text-lavender-muted/70 leading-relaxed">
                          {enText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMemorize(verse.id);
                      }}
                      className="btn-primary w-full shadow-lg shadow-playful-purple/20 py-5 flex items-center justify-center gap-3"
                    >
                      <Brain size={20} />
                      <span className="text-lg">{state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Completion Action - Appears only when revealed */}
      <div className="w-full max-w-md h-24 flex items-center justify-center">
        <AnimatePresence>
          {isFlipped && (
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
                  {state.primaryLanguage === 'es' ? 'Versículo Completado' : 'Complete Verse'}
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
