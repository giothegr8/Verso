import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers, MessageCircle } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, getVerseLines, removeAccents, VERSE_LAYOUT } from "../utils/verseUtils";
import CoachCard from "./CoachCard";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
}

const STAGES = [
  { id: 1, label: "First & Second", es: "Primeras dos letras" },
  { id: 2, label: "Random Mix A", es: "Mezcla aleatoria A" },
  { id: 3, label: "Random Mix B", es: "Mezcla aleatoria B" },
  { id: 4, label: "First Letter", es: "Primera letra" },
  { id: 5, label: "Full Recall", es: "Recuerdo completo" },
];

export default function Memorize({ state, setState, onComplete, onGoToFlashcards }: MemorizeProps) {
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
  const [attempts, setAttempts] = useState(0);
  const [userInputEs, setUserInputEs] = useState("");
  const [userInputEn, setUserInputEn] = useState("");
  const [clueCountEs, setClueCountEs] = useState(0);
  const [clueCountEn, setClueCountEn] = useState(0);
  const [revealedIndicesEs, setRevealedIndicesEs] = useState<number[]>([]);
  const [revealedIndicesEn, setRevealedIndicesEn] = useState<number[]>([]);
  const [isWrong, setIsWrong] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'es' | 'en'>(() => 
    state.memorizeMode === 'en' ? 'en' : 'es'
  );
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
      setIsAlmostDone(false);
      setAttempts(0);
      setUserInputEs("");
      setUserInputEn("");
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrong(false);
      setRevealedIndicesEs([]);
      setRevealedIndicesEn([]);
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

  // Focus management for Stage 5 typing
  useEffect(() => {
    if (stage === 5 && !isRevealed && !isAlmostDone && !hasSubmitted) {
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      };
      
      // Initial focus
      focusInput();
      
      // Re-focus on window focus to ensure typing always works
      window.addEventListener('focus', focusInput);
      return () => window.removeEventListener('focus', focusInput);
    }
  }, [stage, isRevealed, isAlmostDone, hasSubmitted, activeLanguage, clueCountEs, clueCountEn]);

  useEffect(() => {
    if (isAlmostDone) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#06B6D4', '#10B981']
      });
    }
  }, [isAlmostDone]);

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
      setAttempts(0);
      setUserInputEs("");
      setUserInputEn("");
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrong(false);
      setHasSubmitted(false);
      setIsCorrect(false);
      setFeedback(null);
      setRevealedIndicesEs([]);
      setRevealedIndicesEn([]);
      
      // Ensure Spanish is active when entering a new stage in bilingual mode
      if (state.memorizeMode === 'both') {
        setActiveLanguage('es');
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
      setIsAlmostDone(true);
    }
  };

  const prevStage = () => {
    if (stage > 1) {
      const newStage = stage - 1;
      setStage(newStage);
      setIsRevealed(false);
      setIsAlmostDone(false);
      setAttempts(0);
      setUserInputEs("");
      setUserInputEn("");
      setClueCountEs(0);
      setClueCountEn(0);
      setIsWrong(false);
      setHasSubmitted(false);
      setIsCorrect(false);
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
    setAttempts(0);
    setUserInputEs("");
    setUserInputEn("");
    setClueCountEs(0);
    setClueCountEn(0);
    setIsWrong(false);
    setHasSubmitted(false);
    setIsCorrect(false);
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
      // Immediate focus for mobile
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleClue = (lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return;

    const count = lang === 'es' ? clueCountEs : clueCountEn;
    const setCount = lang === 'es' ? setClueCountEs : setClueCountEn;
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const setRevealed = lang === 'es' ? setRevealedIndicesEs : setRevealedIndicesEn;

    if (stage === 5) {
      if (count >= 1) return; // Only one clue in stage 5
      
      const newRevealed: number[] = [];
      let currentLetterIndex = 0;
      
      const lines = text.split("\n");
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
      
      // When revealing clues, we should adjust the user input to avoid shifting
      // if they already typed the letters that are now revealed.
      const currentInput = lang === 'es' ? userInputEs : userInputEn;
      const setInput = lang === 'es' ? setUserInputEs : setUserInputEn;
      const oldRevealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
      
      let newInput = "";
      let inputPtr = 0;
      const cleanTarget = getCleanLetters(text);
      
      for (let i = 0; i < cleanTarget.length; i++) {
        const isAlreadyRevealed = oldRevealed.includes(i);
        const isNewlyRevealed = newRevealed.includes(i);
        
        if (!isAlreadyRevealed) {
          const userChar = currentInput[inputPtr];
          if (userChar) {
            if (!isNewlyRevealed) {
              newInput += userChar;
            }
          }
          inputPtr++;
        }
      }
      
      setInput(newInput);
      setRevealed(newRevealed);
      setCount(1);
      
      // Explicitly restore focus for mobile keyboard continuity
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return;
    }

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
  };

  const normalizeText = (text: string | null | undefined) => {
    if (!text) return "";
    return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
  };

  const getCleanLetters = (text: string | null | undefined) => {
    if (!text) return "";
    return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "");
  };

  const handleCheck = () => {
    if (hasSubmitted || isCorrect) return;
    
    setHasSubmitted(true);
    const esTarget = getCleanLetters(esText || "").toLowerCase();
    const enTarget = getCleanLetters(enText || "").toLowerCase();
    const esInput = getCleanLetters(userInputEs).toLowerCase();
    const enInput = getCleanLetters(userInputEn).toLowerCase();

    const isTextCorrect = (target: string, input: string, revealed: number[]) => {
      if (target.length === 0) return true;
      
      // Normalize both target and input for comparison (remove accents and lowercase)
      const normalizedTarget = removeAccents(target).toLowerCase();
      const normalizedInput = removeAccents(input).toLowerCase();
      
      let inputPtr = 0;
      for (let i = 0; i < normalizedTarget.length; i++) {
        if (!revealed.includes(i)) {
          if ((normalizedInput[inputPtr] || "") !== normalizedTarget[i]) return false;
          inputPtr++;
        }
      }
      const requiredLength = normalizedTarget.length - revealed.length;
      return normalizedInput.length >= requiredLength;
    };

    const esCorrect = state.memorizeMode === 'en' || isTextCorrect(esTarget, esInput, revealedIndicesEs);
    const enCorrect = state.memorizeMode === 'es' || isTextCorrect(enTarget, enInput, revealedIndicesEn);
    
    if (esCorrect && enCorrect) {
      setIsCorrect(true);
      setFeedback(state.primaryLanguage === 'es' ? "¡Correcto!" : "Correct!");
      setTimeout(() => {
        nextStage();
      }, 1500);
    } else {
      setIsCorrect(false);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setIsWrong(true);
      
      if (newAttempts >= 3) {
        setFeedback(state.primaryLanguage === 'es' ? "Se acabaron los intentos. Revelando texto..." : "Out of attempts. Revealing text...");
        setTimeout(() => {
          setIsRevealed(true);
          setFeedback(null);
        }, 2000);
      } else {
        const remaining = 3 - newAttempts;
        setFeedback(state.primaryLanguage === 'es' 
          ? `Todavía no. Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'}.` 
          : `Not quite. You have ${remaining} tr${remaining === 1 ? 'y' : 'ies'} left.`);
      }
      
      setTimeout(() => setIsWrong(false), 1500);
    }
  };

  // Remove auto-check useEffect to fix attempts counter glitch and allow manual submission
  
  const renderVerseContent = (text: string | null | undefined, userInput: string, lang: 'es' | 'en', isCurrentActive: boolean = true) => {
    if (!text) return null;
    
    // Use the shared line-break utility as the single source of truth for layout
    const lines = getVerseLines(text);
    
    let letterIndex = 0;
    let inputIdx = 0;
    const cleanInput = getCleanLetters(userInput);
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;

    return (
      <div className={`space-y-4 sm:space-y-6 w-full font-serif ${VERSE_LAYOUT.FONT_SIZE_CLASSES} ${VERSE_LAYOUT.FONT_WEIGHT} ${VERSE_LAYOUT.LINE_HEIGHT} transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        {lines.map((line, lineIdx) => {
          const words = line.split(" ");
          return (
            <div key={lineIdx} className="flex flex-row justify-center flex-nowrap w-full min-w-0 px-2">
              <div className="flex flex-row justify-center flex-nowrap gap-x-[0.4em]">
                {words.map((word, wordIdx) => {
                  const chars = word.split("");
                  return (
                    <div key={wordIdx} className="flex flex-row flex-nowrap gap-x-[1px]">
                      {chars.map((char, charIdx) => {
                        const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(char);
                        
                        // Base classes for every character slot to ensure dimensions never shift
                        const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.2em] ${VERSE_LAYOUT.CHAR_HEIGHT} transition-all duration-300`;
                      
                      if (!isLetter) {
                        return (
                          <span key={charIdx} className={`${baseSlotClasses} text-earth/40 dark:text-ivory/40`}>
                            {char}
                          </span>
                        );
                      }
                      
                      // Handle Stages 1-4 (Memorization rehearsal)
                      if (stage < 5 && !isRevealed) {
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
                            {/* The 'Ghost' character preserves natural width even when hidden */}
                            <span className={`transition-all duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
                              {char}
                            </span>
                            {isHidden && (
                              <span className="absolute bottom-1 left-0 right-0 h-[1.5px] bg-earth/10 dark:bg-white/10 rounded-full" />
                            )}
                          </span>
                        );
                      }

                      // Handle Stage 5 (Interactive typing)
                      if (stage === 5 && !isRevealed) {
                        const isRevealedByClue = revealed.includes(letterIndex);
                        const userChar = isRevealedByClue ? "" : cleanInput[inputIdx];
                        const isSlotActive = isCurrentActive && !isRevealedByClue && inputIdx === cleanInput.length;
                        
                        // Normalize for visual feedback comparison (ignore accents)
                        const isWrongChar = hasSubmitted && !isCorrect && userChar && 
                          removeAccents(userChar.toLowerCase()) !== removeAccents(char.toLowerCase());
                        
                        const result = (
                          <span 
                            key={charIdx} 
                            className={`${baseSlotClasses} ${
                              isRevealedByClue || userChar
                                ? isWrongChar 
                                  ? 'text-coral bg-coral/5' 
                                  : isCorrect
                                    ? 'text-teal'
                                    : 'text-playful-purple'
                                : 'text-transparent'
                            }`}
                          >
                            {/* Individual Underline */}
                            <span className={`absolute bottom-1 left-0 right-0 h-[1.5px] rounded-full transition-all duration-300 ${
                              isRevealedByClue || userChar
                                ? isWrongChar 
                                  ? 'bg-coral' 
                                  : isCorrect
                                    ? 'bg-teal'
                                    : 'bg-playful-purple'
                                : isSlotActive && !hasSubmitted
                                  ? 'bg-coral'
                                  : 'bg-earth/10 dark:bg-white/10'
                            }`} />

                            {/* Caret */}
                            {isSlotActive && !hasSubmitted && (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                className="absolute inset-y-1 left-0 w-[3px] bg-coral rounded-full shadow-[0_0_8px_rgba(255,111,97,0.5)]"
                              />
                            )}

                            {/* Ghost character preserves width */}
                            <span className="opacity-0 pointer-events-none select-none">{char}</span>
                            
                            {/* User input or revealed clue rendered absolutely over the ghost */}
                            <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${(userChar || isRevealedByClue) ? 'opacity-100' : 'opacity-0'}`}>
                              {userChar || (isRevealedByClue ? char : "")}
                            </span>
                          </span>
                        );

                        if (!isRevealedByClue) inputIdx++;
                        letterIndex++;
                        return result;
                      }

                      // Handle Reveal / Normal View
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
            className="w-40 h-40 bg-playful-purple/10 dark:bg-plum/10 rounded-[48px] flex items-center justify-center shadow-2xl shadow-playful-purple/10"
            animate={{ 
              scale: [1, 1.05, 1],
              y: [0, -5, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles size={80} className="text-playful-purple dark:text-plum" fill="currentColor" />
          </motion.div>
          
          {/* Animated Stars */}
          {[...Array(5)].map((_, i) => (
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
            {state.primaryLanguage === 'es' ? '¡Ya casi!' : "You're almost there!"}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto"
          >
            {state.primaryLanguage === 'es' 
              ? 'Texto completo. Ahora falta el último paso: la cita bíblica.' 
              : 'Text complete. Now for the final step: the citation.'}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm font-black text-playful-purple dark:text-plum uppercase tracking-widest mt-4"
          >
            {state.primaryLanguage === 'es' ? 'Un paso más.' : 'One more step.'}
          </motion.p>
        </div>

        <div className="w-full max-w-sm space-y-8 px-6">
          <div className="flex flex-col items-center gap-6">
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => onGoToFlashcards?.(verse.id)} 
              className="w-full bg-playful-purple dark:bg-plum text-white rounded-[32px] flex items-center justify-center gap-4 py-6 px-8 shadow-2xl shadow-playful-purple/30 hover:scale-[1.02] active:scale-95 transition-all group"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Layers size={24} />
              </div>
              <span className="text-base sm:text-lg font-black uppercase tracking-widest leading-tight text-center">
                {state.primaryLanguage === 'es' ? 'Reto Final: Cita bíblica' : 'Final Challenge: Citation'}
              </span>
            </motion.button>
            
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
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-1 pb-4 scrollbar-hide">
        {/* Progress Header */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <motion.h3 
                className="text-2xl font-serif font-black text-playful-purple dark:text-plum tracking-tight"
                key={verse.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
              </motion.h3>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-earth-light dark:text-lavender-muted">
                  {STAGES[Math.max(0, Math.min(stage - 1, STAGES.length - 1))]?.[state.primaryLanguage === 'es' ? 'es' : 'label'] || ""}
                </p>
                <span className="w-1.5 h-1.5 rounded-full bg-teal shadow-sm" />
                <div className="flex items-center gap-1.5 bg-playful-purple/10 dark:bg-plum/20 px-3 py-1 rounded-full border border-playful-purple/20 dark:border-plum/30">
                  <Languages size={12} className="text-playful-purple dark:text-plum" />
                  <span className="text-[10px] font-black text-playful-purple dark:text-plum uppercase tracking-widest">
                    {state.memorizeMode === 'both' 
                      ? `${esDetail.label} / ${enDetail.label}`
                      : state.memorizeMode === 'es' ? esDetail.label : enDetail.label
                    }
                  </span>
                </div>
              </div>
            </div>
            <div 
              className="flex flex-col items-end"
            >
              <span className="text-lg font-black text-playful-purple dark:text-plum">
                {stage} <span className="text-xs text-earth-light/40 dark:text-lavender-muted/40">/ 5</span>
              </span>
            </div>
          </div>
          
          {/* Subtle Instruction */}
          {stage < 5 && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-lavender-muted/40 text-center"
            >
              {stage === 1 && (state.primaryLanguage === 'es' ? 'Lee y ensaya' : 'Read and rehearse')}
              {stage > 1 && stage < 5 && (state.primaryLanguage === 'es' ? 'Dilo en voz alta mientras las letras desaparecen (No escribas)' : 'Say it out loud as the letters disappear (No typing yet)')}
            </motion.p>
          )}

          <div className="h-4 w-full bg-earth/10 dark:bg-white/10 rounded-full overflow-hidden p-1 relative shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-playful-purple via-sky-blue to-teal rounded-full shadow-lg relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${(stage / 5) * 100}%` }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
            >
              {/* Shimmer Effect */}
              <motion.div 
                className="absolute inset-0 bg-white/30 skew-x-[-20deg]"
                animate={{ 
                  x: ['-100%', '200%'],
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  repeatDelay: 0.5
                }}
                style={{ width: '40%' }}
              />
            </motion.div>
          </div>
        </div>

        <div className="shimmer-border w-full rounded-[32px] bg-white dark:bg-charcoal">
          <div className="card min-h-[480px] flex flex-col justify-center items-center text-center p-4 sm:p-8 md:p-12 relative group bg-white dark:bg-charcoal shadow-xl border-none">
            <div className="flex flex-col items-center w-full relative z-10 px-2">
            <div 
              className={`flex flex-col gap-12 sm:gap-16 w-full py-12 my-auto ${stage === 5 && !isRevealed ? 'cursor-text' : ''}`}
              onClick={() => stage === 5 && !isRevealed && inputRef.current?.focus()}
            >
              {stage === 5 && !isRevealed && (
                <input
                  ref={inputRef}
                  type="text"
                  className="sr-only"
                  autoFocus
                  value={activeLanguage === 'es' ? userInputEs : userInputEn}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "");
                    const text = activeLanguage === 'es' ? esText : enText;
                    const revealed = activeLanguage === 'es' ? revealedIndicesEs : revealedIndicesEn;
                    
                    let fillableCount = 0;
                    if (text) {
                      const cleanLetters = getCleanLetters(text);
                      fillableCount = cleanLetters.length - revealed.length;
                    }

                    const limitedVal = val.slice(0, fillableCount);

                    if (activeLanguage === 'es') {
                      setUserInputEs(limitedVal);
                      // Auto-transition to English if Spanish is complete in bilingual mode
                      if (state.memorizeMode === 'both' && limitedVal.length === fillableCount) {
                        setTimeout(() => setActiveLanguage('en'), 300);
                      }
                    } else {
                      setUserInputEn(limitedVal);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !hasSubmitted) {
                      handleCheck();
                    }
                    if (e.key === 'Backspace' && (activeLanguage === 'es' ? userInputEs : userInputEn).length === 0 && state.memorizeMode === 'both' && activeLanguage === 'en') {
                      setActiveLanguage('es');
                    }
                  }}
                />
              )}
              
              {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                <div 
                  className={`w-full flex flex-col gap-6 transition-all duration-500 ${state.memorizeMode === 'both' && activeLanguage !== 'es' ? 'opacity-50 cursor-pointer' : 'opacity-100'}`}
                  onClick={() => handleLanguageSwitch('es')}
                >
                  {/* Dedicated Metadata Row - Spanish */}
                  <div className="flex justify-center items-center px-2 min-h-[44px] w-full relative">
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                    <span className={`mx-4 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 ${
                      activeLanguage === 'es' 
                        ? 'bg-playful-purple text-white border-playful-purple shadow-lg shadow-playful-purple/20' 
                        : 'bg-white/50 dark:bg-charcoal/50 text-playful-purple border-playful-purple/40 dark:text-plum dark:border-plum/40 backdrop-blur-sm'
                    }`}>
                      {esDetail.label}
                    </span>
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                    
                    {stage === 5 && !isRevealed && activeLanguage === 'es' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleClue('es'); }}
                        disabled={clueCountEs >= 1}
                        className="absolute right-0 text-[10px] font-black uppercase tracking-widest text-playful-purple/60 hover:text-playful-purple disabled:opacity-30 flex items-center gap-1 bg-white/80 dark:bg-charcoal/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-playful-purple/10"
                      >
                        <Sparkles size={12} />
                        {state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}
                      </button>
                    )}
                  </div>
                  
                  <div className="w-full">
                    {renderVerseContent(esText, userInputEs, 'es', activeLanguage === 'es')}
                  </div>
                </div>
              )}

              {state.memorizeMode === 'both' && (
                <div className="flex items-center justify-center py-2">
                  <div className="w-12 h-px bg-earth/5 dark:bg-white/5" />
                  <div className="flex gap-1.5 px-4">
                    <div className="w-1 h-1 rounded-full bg-earth/20 dark:bg-white/20" />
                    <div className="w-1 h-1 rounded-full bg-earth/20 dark:bg-white/20" />
                    <div className="w-1 h-1 rounded-full bg-earth/20 dark:bg-white/20" />
                  </div>
                  <div className="w-12 h-px bg-earth/5 dark:bg-white/5" />
                </div>
              )}

              {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                <div 
                  className={`w-full flex flex-col gap-6 transition-all duration-500 ${state.memorizeMode === 'both' && activeLanguage !== 'en' ? 'opacity-50 cursor-pointer' : 'opacity-100'}`}
                  onClick={() => handleLanguageSwitch('en')}
                >
                  {/* Dedicated Metadata Row - English */}
                  <div className="flex justify-center items-center px-2 min-h-[44px] w-full relative">
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                    <span className={`mx-4 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 ${
                      activeLanguage === 'en' 
                        ? 'bg-golden text-white border-golden shadow-lg shadow-golden/20' 
                        : 'bg-white/50 dark:bg-charcoal/50 text-golden border-golden/40 backdrop-blur-sm'
                    }`}>
                      {enDetail.label}
                    </span>
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                    
                    {stage === 5 && !isRevealed && activeLanguage === 'en' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleClue('en'); }}
                        disabled={clueCountEn >= 1}
                        className="absolute right-0 text-[10px] font-black uppercase tracking-widest text-golden/60 hover:text-golden disabled:opacity-30 flex items-center gap-1 bg-white/80 dark:bg-charcoal/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-golden/10"
                      >
                        <Sparkles size={12} />
                        {state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}
                      </button>
                    )}
                  </div>

                  <div className="w-full">
                    {renderVerseContent(enText, userInputEn, 'en', activeLanguage === 'en')}
                  </div>
                </div>
              )}

              {stage === 5 && !isRevealed && (
                <div className="flex flex-col items-center gap-6 pt-4">
                  {feedback && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-sm font-bold ${isCorrect ? 'text-teal' : 'text-coral'}`}
                    >
                      {feedback}
                    </motion.div>
                  )}
                  
                  {!hasSubmitted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCheck(); }}
                      className="btn-primary px-8 py-3 text-sm"
                    >
                      {state.primaryLanguage === 'es' ? 'Comprobar' : 'Check'}
                    </button>
                  )}

                  <div className="text-[10px] font-black uppercase tracking-widest text-earth/30 dark:text-ivory/30">
                    {state.primaryLanguage === 'es' ? `Intentos: ${attempts}/3` : `Attempts: ${attempts}/3`}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute top-4 right-4 z-20">
            <button 
              onPointerDown={() => setIsRevealed(true)}
              onPointerUp={() => setIsRevealed(false)}
              onPointerLeave={() => setIsRevealed(false)}
              className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 border active:scale-95 ${
                isRevealed 
                  ? 'bg-playful-purple/10 dark:bg-plum/20 text-playful-purple dark:text-plum border-playful-purple/20 dark:border-plum/30' 
                  : 'bg-earth/5 dark:bg-white/5 text-earth/30 dark:text-ivory/30 border-transparent hover:text-playful-purple dark:hover:text-plum hover:bg-earth/10 dark:hover:bg-white/10'
              }`}
              title={state.primaryLanguage === 'es' ? 'Mantén presionado para ver' : 'Hold to reveal'}
            >
              {isRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
              <AnimatePresence>
                {isRevealed && (
                  <motion.span 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="text-[9px] font-black uppercase tracking-widest overflow-hidden whitespace-nowrap pr-0.5"
                  >
                    {state.primaryLanguage === 'es' ? 'Viendo' : 'Revealed'}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Fixed Bottom Action Area - Refined Visual Design */}
      <div className="flex-shrink-0 flex flex-col gap-6 p-6 pb-10 z-30">
        {/* Action Container - Styled like a card with matching radius */}
        <div className="h-[180px] w-full bg-white/95 dark:bg-charcoal/95 rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 p-8 flex flex-col justify-between">
          {/* Stable Button Row */}
          <div className="h-20 flex items-center gap-4">
            {/* Back Button Slot - Always takes 50% space to keep Next button stable */}
            <div className="flex-1 h-full">
              <AnimatePresence>
                {stage > 1 && (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={prevStage}
                    className="w-full h-full rounded-2xl font-black text-lg uppercase tracking-widest bg-earth/5 dark:bg-white/5 text-earth-light/60 dark:text-lavender-muted/60 hover:bg-earth/10 dark:hover:bg-white/10 transition-all border-2 border-transparent flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowLeft size={20} />
                    <span>{state.primaryLanguage === 'es' ? 'Atrás' : 'Back'}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            
            {/* Primary Action Slot - Fixed position (flex-1) */}
            <div className="flex-1 h-full">
              <motion.button 
                onClick={stage === 5 && !hasSubmitted ? handleCheck : nextStage}
                className={`w-full h-full flex items-center justify-center gap-3 group rounded-2xl font-bold transition-all shadow-xl relative overflow-hidden ${
                  stage === 5 
                    ? 'bg-plum-deep dark:bg-indigo-rich text-white shadow-plum-deep/30 dark:shadow-indigo-rich/40' 
                    : 'btn-primary shadow-playful-purple/30 dark:shadow-plum/40'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-xl font-bold relative z-10 tracking-tight">
                  {stage === 5 
                    ? (hasSubmitted ? (state.primaryLanguage === 'es' ? 'Siguiente' : 'Next') : (state.primaryLanguage === 'es' ? 'Comprobar' : 'Check')) 
                    : (state.primaryLanguage === 'es' ? 'Siguiente' : 'Next step')}
                </span>
                <div className="relative z-10">
                  <ArrowRight size={24} strokeWidth={3} />
                </div>
              </motion.button>
            </div>
          </div>

          {/* Stable Step Indicators */}
          <div className="h-6 flex justify-center items-center gap-4">
            {[1, 2, 3, 4, 5].map(s => (
              <div 
                key={s} 
                className={`h-3 rounded-full transition-all duration-300 relative overflow-hidden ${s === stage ? 'w-12 bg-playful-purple dark:bg-plum shadow-lg shadow-playful-purple/40' : s < stage ? 'w-3 bg-teal shadow-sm' : 'w-3 bg-earth/10 dark:bg-white/10'}`} 
              />
            ))}
          </div>
        </div>

        {/* Guidance Area - Outside the fixed action box */}
        <div className="h-[140px] w-full">
          <CoachCard 
            state={state}
            type={coachType}
            verseReference={`${getLocalizedBookName(verse.book, state.memorizeMode)} ${verse.chapter}:${verse.verse}`}
            verseText={esText || enText || ""}
            stage={stage}
            status="succeeding"
          />
        </div>
      </div>
    </div>
  );
}
