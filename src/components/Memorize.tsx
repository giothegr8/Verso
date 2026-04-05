import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { VERSE_OF_THE_DAY, MOCK_VERSES } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Star, Trophy, Languages, Sparkles, AlertCircle, Bookmark, Layers } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse } from "../utils/verseUtils";
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
  const verse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || VERSE_OF_THE_DAY)
    : VERSE_OF_THE_DAY;

  const [stage, setStage] = useState(() => state.progress.verseStages[verse.id] || 1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [coachType, setCoachType] = useState<'encouragement' | 'suggestion' | 'tip'>('encouragement');
  
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
    activePairIndex: state.activePairIndex,
    customPairEs: state.customPair.es,
    customPairEn: state.customPair.en,
    memorizeMode: state.memorizeMode,
    verseId: verse.id
  });

  // Reset stage when verse, translations, or display mode changes
  useEffect(() => {
    const configChanged = 
      lastConfigRef.current.activePairIndex !== state.activePairIndex ||
      lastConfigRef.current.customPairEs !== state.customPair.es ||
      lastConfigRef.current.customPairEn !== state.customPair.en ||
      lastConfigRef.current.memorizeMode !== state.memorizeMode ||
      lastConfigRef.current.verseId !== verse.id;

    if (configChanged) {
      setStage(1);
      setIsRevealed(false);
      setIsAlmostDone(false);
      
      lastConfigRef.current = {
        activePairIndex: state.activePairIndex,
        customPairEs: state.customPair.es,
        customPairEn: state.customPair.en,
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
  }, [verse.id, state.activePairIndex, state.customPair.es, state.customPair.en, state.memorizeMode, setState]);

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

  const processText = (text: string, currentStage: number) => {
    if (isRevealed) return text;
    if (!text) return "";

    const words = text.split(" ");
    return words.map((word, idx) => {
      if (!word) return "";
      
      if (currentStage === 1) {
        // First and second letters only
        return word.length > 2 
          ? word.slice(0, 2) + word.slice(2).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_")
          : word;
      }
      if (currentStage === 2) {
        // Random words mixed with blanks (Stage A)
        return idx % 2 === 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      }
      if (currentStage === 3) {
        // Different random words mixed with blanks (Stage B)
        return idx % 2 !== 0 ? word : word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      }
      if (currentStage === 4) {
        // First letter only
        return (word[0] || "") + word.slice(1).replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      }
      if (currentStage === 5) {
        // Fully hidden
        return word.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "_");
      }
      return word;
    }).join(" ");
  };

  const nextStage = () => {
    // Rotate coach type for variety
    const types: ('encouragement' | 'suggestion' | 'tip')[] = ['encouragement', 'suggestion', 'tip'];
    setCoachType(types[Math.floor(Math.random() * types.length)]);

    if (stage < 5) {
      const newStage = stage + 1;
      setStage(newStage);
      setIsRevealed(false);
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
            {state.primaryLanguage === 'es' ? '¡Casi lo tienes!' : "You're almost there!"}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-earth-light dark:text-lavender-muted font-medium max-w-sm mx-auto"
          >
            {state.primaryLanguage === 'es' 
              ? 'Has memorizado el texto perfectamente. Ahora, ¿puedes recordar la cita?' 
              : 'You have memorized the text perfectly. Now, can you recall the citation?'}
          </motion.p>
        </div>

        <div className="w-full max-w-sm space-y-8 px-6">
          <CoachCard 
            state={state}
            type="encouragement"
            verseReference={`${verse.book} ${verse.chapter}:${verse.verse}`}
            verseText={esText || enText || ""}
            stage={5}
            status="succeeding"
          />

          <div className="flex flex-col items-center gap-6">
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => onGoToFlashcards?.(verse.id)} 
              className="w-full bg-playful-purple dark:bg-plum text-white rounded-[32px] flex items-center justify-center gap-4 py-6 shadow-2xl shadow-playful-purple/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Layers size={24} />
              </div>
              <span className="text-lg font-black uppercase tracking-widest">
                {state.primaryLanguage === 'es' ? 'Reto Final: Cita' : 'Final Challenge: Citation'}
              </span>
            </motion.button>
            
            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={() => setIsAlmostDone(false)}
              className="text-xs font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-ivory/40 hover:text-playful-purple dark:hover:text-plum transition-colors py-2"
            >
              {state.primaryLanguage === 'es' ? '← Volver al texto' : '← Back to text'}
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
                {verse.book} {verse.chapter}:{verse.verse}
              </motion.h3>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-earth-light dark:text-lavender-muted">
                  {STAGES[Math.max(0, Math.min(stage - 1, STAGES.length - 1))]?.[state.primaryLanguage === 'es' ? 'es' : 'label'] || ""}
                </p>
                <span className="w-1.5 h-1.5 rounded-full bg-teal shadow-sm" />
                <div className="flex items-center gap-1.5 bg-playful-purple/10 dark:bg-plum/20 px-3 py-1 rounded-full border border-playful-purple/20 dark:border-plum/30">
                  <Languages size={12} className="text-playful-purple dark:text-plum" />
                  <span className="text-[10px] font-black text-playful-purple dark:text-plum uppercase tracking-widest">
                    {esDetail.label} / {enDetail.label}
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
            verseReference={`${verse.book} ${verse.chapter}:${verse.verse}`}
            verseText={esText || enText || ""}
            stage={stage}
            status="succeeding"
          />
        </div>
      </div>
    </div>
  );
}
