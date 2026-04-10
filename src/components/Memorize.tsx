import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers, MessageCircle } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString } from "../utils/verseUtils";
import CoachCard from "./CoachCard";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
}

const STAGES = [
  { id: 1, label: "First & Second", es: "Primeras 2 Letras" },
  { id: 2, label: "Random Mix A", es: "Mezcla Aleatoria A" },
  { id: 3, label: "Random Mix B", es: "Mezcla Aleatoria B" },
  { id: 4, label: "First Letter", es: "Primera Letra" },
  { id: 5, label: "Full Recall", es: "Recuerdo Total" },
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

  const handleClue = (lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return;

    const count = lang === 'es' ? clueCountEs : clueCountEn;
    const setCount = lang === 'es' ? setClueCountEs : setClueCountEn;
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const setRevealed = lang === 'es' ? setRevealedIndicesEs : setRevealedIndicesEn;
    const userInput = lang === 'es' ? userInputEs : userInputEn;

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
    const esCorrect = state.memorizeMode === 'en' || normalizeText(userInputEs) === normalizeText(esText || "");
    const enCorrect = state.memorizeMode === 'es' || normalizeText(userInputEn) === normalizeText(enText || "");
    
    if (esCorrect && enCorrect && (userInputEs.length > 0 || state.memorizeMode === 'en') && (userInputEn.length > 0 || state.memorizeMode === 'es')) {
      nextStage();
    } else {
      setAttempts(prev => prev + 1);
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 1000);
      
      if (attempts + 1 >= 3) {
        setIsRevealed(true);
      }
    }
  };

  useEffect(() => {
    if (stage === 5 && !isAlmostDone && !isRevealed && !isWrong) {
      const esTarget = getCleanLetters(esText || "").toLowerCase();
      const enTarget = getCleanLetters(enText || "").toLowerCase();
      const esInput = getCleanLetters(userInputEs).toLowerCase();
      const enInput = getCleanLetters(userInputEn).toLowerCase();

      const isTextCorrect = (target: string, input: string, revealed: number[]) => {
        if (target.length === 0) return true;
        for (let i = 0; i < target.length; i++) {
          const targetChar = target[i];
          const inputChar = input[i];
          const isRevealed = revealed.includes(i);
          
          if (inputChar) {
            if (inputChar !== targetChar) return false;
          } else if (!isRevealed) {
            return false;
          }
        }
        return true;
      };

      const esCorrect = state.memorizeMode === 'en' || isTextCorrect(esTarget, esInput, revealedIndicesEs);
      const enCorrect = state.memorizeMode === 'es' || isTextCorrect(enTarget, enInput, revealedIndicesEn);
      
      if (esCorrect && enCorrect && (userInputEs.length > 0 || revealedIndicesEs.length > 0 || state.memorizeMode === 'en') && (userInputEn.length > 0 || revealedIndicesEn.length > 0 || state.memorizeMode === 'es')) {
        setTimeout(nextStage, 500);
      } else {
        // Check if "full" but wrong
        const isFull = (target: string, input: string, revealed: number[]) => {
          if (target.length === 0) return true;
          for (let i = 0; i < target.length; i++) {
            if (!input[i] && !revealed.includes(i)) return false;
          }
          return true;
        };

        const esFull = state.memorizeMode === 'en' || isFull(esTarget, esInput, revealedIndicesEs);
        const enFull = state.memorizeMode === 'es' || isFull(enTarget, enInput, revealedIndicesEn);
        
        if (esFull && enFull && (userInputEs.length > 0 || revealedIndicesEs.length > 0 || state.memorizeMode === 'en') && (userInputEn.length > 0 || revealedIndicesEn.length > 0 || state.memorizeMode === 'es')) {
          // If full but reached here, it means isTextCorrect was false
          setIsWrong(true);
          setAttempts(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setTimeout(() => setIsRevealed(true), 1000);
            }
            return next;
          });
          setTimeout(() => setIsWrong(false), 1500);
        }
      }
    }
  }, [userInputEs, userInputEn, stage, esText, enText, state.memorizeMode, isAlmostDone, isRevealed, isWrong, revealedIndicesEs, revealedIndicesEn]);

  const renderHangmanText = (text: string | null | undefined, userInput: string, lang: 'es' | 'en') => {
    if (!text) return null;
    const words = text.split(" ");
    let letterIndex = 0;
    const cleanInput = getCleanLetters(userInput);
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;

    return (
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-4 font-serif text-2xl sm:text-3xl font-black leading-relaxed">
        {words.map((word, wordIdx) => {
          const chars = word.split("");
          return (
            <div key={wordIdx} className="flex">
              {chars.map((char, charIdx) => {
                const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(char);
                if (!isLetter) {
                  return <span key={charIdx} className="text-earth/40 dark:text-ivory/40">{char}</span>;
                }
                
                const userChar = cleanInput[letterIndex];
                const isRevealedByClue = revealed.includes(letterIndex);
                const isActive = letterIndex === cleanInput.length;
                
                letterIndex++;
                
                return (
                  <span key={charIdx} className="relative inline-flex flex-col items-center min-w-[0.6em] mx-[1px]">
                    <span className={`transition-all duration-200 ${(userChar || isRevealedByClue) ? 'opacity-100' : 'opacity-0'}`}>
                      {userChar || (isRevealedByClue ? char : "")}
                    </span>
                    
                    {/* Visible Cursor */}
                    {isActive && !isRevealed && (
                      <motion.div 
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <div className="w-[2.5px] h-[70%] bg-playful-purple dark:bg-plum rounded-full shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                      </motion.div>
                    )}
                    
                    {/* Persistent Blank Line */}
                    <span className={`absolute bottom-0 left-0 right-0 h-[2px] transition-colors duration-300 ${isActive ? 'bg-playful-purple dark:bg-plum' : 'bg-earth/20 dark:bg-white/20'}`} />
                  </span>
                );
              })}
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
              {stage > 1 && stage < 5 && (state.primaryLanguage === 'es' ? 'Dilo en voz alta (No escribas)' : 'Say it out loud (No typing yet)')}
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

        <div className="card min-h-[480px] max-h-[560px] flex flex-col justify-center items-center text-center p-8 sm:p-12 relative group bg-white dark:bg-charcoal shadow-xl border border-earth/10 dark:border-white/10 overflow-hidden">
          <div className="flex flex-col justify-center gap-8 w-full h-full relative z-10 overflow-y-auto scrollbar-hide py-4">
            {stage === 5 && !isRevealed ? (
              <div 
                className="space-y-12 w-full cursor-text py-8"
                onClick={() => inputRef.current?.focus()}
              >
                <input
                  ref={inputRef}
                  type="text"
                  className="sr-only"
                  autoFocus
                  value={state.memorizeMode === 'es' ? userInputEs : userInputEn}
                  onChange={(e) => {
                    if (state.memorizeMode === 'es') setUserInputEs(e.target.value);
                    else if (state.memorizeMode === 'en') setUserInputEn(e.target.value);
                    else {
                      // In 'both' mode, we might need a more complex way to toggle, 
                      // but for now let's assume it fills ES then EN or just one.
                      // Actually, let's just use the first language for simplicity in 'both' mode if not specified.
                      setUserInputEs(e.target.value);
                    }
                  }}
                />
                
                {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                      <span className="px-3 py-1 bg-playful-purple/10 dark:bg-plum/20 rounded-full text-[10px] font-black uppercase tracking-widest text-playful-purple dark:text-plum">
                        {esDetail.name}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleClue('es'); }}
                        disabled={clueCountEs >= 2}
                        className="text-[10px] font-black uppercase tracking-widest text-playful-purple/60 hover:text-playful-purple disabled:opacity-30 flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        {state.primaryLanguage === 'es' ? 'Pista' : 'Clue'} ({2 - clueCountEs})
                      </button>
                    </div>
                    {renderHangmanText(esText, userInputEs, 'es')}
                  </div>
                )}

                {state.memorizeMode === 'both' && (
                  <div className="h-px w-12 bg-earth/10 dark:bg-white/10 mx-auto" />
                )}

                {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                      <span className="px-3 py-1 bg-golden/10 rounded-full text-[10px] font-black uppercase tracking-widest text-golden">
                        {enDetail.name}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleClue('en'); }}
                        disabled={clueCountEn >= 2}
                        className="text-[10px] font-black uppercase tracking-widest text-golden/60 hover:text-golden disabled:opacity-30 flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        {state.primaryLanguage === 'es' ? 'Pista' : 'Clue'} ({2 - clueCountEn})
                      </button>
                    </div>
                    {state.memorizeMode === 'both' ? (
                      <input
                        type="text"
                        value={userInputEn}
                        onChange={(e) => setUserInputEn(e.target.value)}
                        placeholder={state.primaryLanguage === 'es' ? "Escribe en inglés..." : "Type in English..."}
                        className="w-full bg-transparent border-b-2 border-earth/10 dark:border-white/10 py-2 text-center outline-none focus:border-golden transition-colors font-serif text-xl"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      renderHangmanText(enText, userInputEn, 'en')
                    )}
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 pt-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-earth/30 dark:text-ivory/30">
                    {state.primaryLanguage === 'es' ? `Intentos: ${attempts}/3` : `Attempts: ${attempts}/3`}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                  <div className="flex flex-col justify-center space-y-3 shrink-0">
                    <div>
                      <span className="px-3 py-1 bg-playful-purple/10 dark:bg-plum/20 rounded-full text-[10px] font-black uppercase tracking-widest text-playful-purple dark:text-plum">
                        {esDetail.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <p className="text-2xl sm:text-3xl font-serif leading-relaxed font-black text-earth dark:text-ivory select-none">
                        {processedEs}
                      </p>
                    </div>
                  </div>
                )}

                {state.memorizeMode === 'both' && (
                  <div className="flex items-center justify-center gap-4 h-4 shrink-0">
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                    <Sparkles size={16} className="text-golden/40" />
                    <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                  </div>
                )}

                {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                  <div className="flex flex-col justify-center space-y-3 shrink-0">
                    <div>
                      <span className="px-3 py-1 bg-golden/10 rounded-full text-[10px] font-black uppercase tracking-widest text-golden">
                        {enDetail.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <p className="text-2xl sm:text-3xl font-serif leading-relaxed font-black text-earth dark:text-ivory select-none">
                        {processedEn}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="absolute top-4 right-4 z-20">
            <button 
              onClick={() => setIsRevealed(!isRevealed)}
              className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 border ${
                isRevealed 
                  ? 'bg-playful-purple/10 dark:bg-plum/20 text-playful-purple dark:text-plum border-playful-purple/20 dark:border-plum/30' 
                  : 'bg-earth/5 dark:bg-white/5 text-earth/30 dark:text-ivory/30 border-transparent hover:text-playful-purple dark:hover:text-plum hover:bg-earth/10 dark:hover:bg-white/10'
              }`}
              title={state.primaryLanguage === 'es' ? (isRevealed ? 'Ocultar' : 'Ver') : (isRevealed ? 'Hide' : 'Reveal')}
            >
              {isRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
              {isRevealed && (
                <motion.span 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  className="text-[9px] font-black uppercase tracking-widest overflow-hidden whitespace-nowrap pr-0.5"
                >
                  {state.primaryLanguage === 'es' ? 'Viendo' : 'Revealed'}
                </motion.span>
              )}
            </button>
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
                onClick={nextStage}
                className={`w-full h-full flex items-center justify-center gap-3 group rounded-2xl font-bold transition-all shadow-xl relative overflow-hidden ${
                  stage === 5 
                    ? 'bg-plum-deep dark:bg-indigo-rich text-white shadow-plum-deep/30 dark:shadow-indigo-rich/40' 
                    : 'btn-primary shadow-playful-purple/30 dark:shadow-plum/40'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-xl font-bold relative z-10 tracking-tight">
                  {stage === 5 
                    ? (state.primaryLanguage === 'es' ? '¡Lo tengo!' : 'Got it!') 
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
