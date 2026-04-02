import { motion } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { VERSE_OF_THE_DAY, MOCK_VERSES } from "../constants";
import { Globe, Play, Flame, Trophy, Sparkles, Languages, BookOpen, History, AlertCircle } from "lucide-react";
import React from "react";
import { getCurrentTranslationPair, getValidatedVerse } from "../utils/verseUtils";

interface HomeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string) => void;
  onGetAnotherVerse: () => void;
}

export default function Home({ state, setState, onStartMemorizing, onGetAnotherVerse }: HomeProps) {
  const activePair = getCurrentTranslationPair(state);
  
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const currentVerse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || VERSE_OF_THE_DAY)
    : VERSE_OF_THE_DAY;

  const isVotd = currentVerse.id === VERSE_OF_THE_DAY.id;

  const { esText, enText, esError, enError } = getValidatedVerse(currentVerse, state);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="h-full flex flex-col space-y-12 pb-24"
    >
      {/* Header Section - Clean and Focused */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 bg-coral/10 px-3 py-1.5 rounded-full border border-coral/20"
          >
            <Flame size={14} className="text-coral" fill="currentColor" />
            <span className="text-[10px] font-black text-coral uppercase tracking-widest">
              {state.progress.currentStreak} {state.primaryLanguage === 'es' ? 'Días seguidos' : 'Day streak'}
            </span>
          </motion.div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <motion.div 
            key={`${esDetail.label}-${enDetail.label}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 bg-playful-purple/10 dark:bg-plum/20 px-4 py-2 rounded-2xl border border-playful-purple/20 dark:border-plum/30"
          >
            <Languages size={16} className="text-playful-purple dark:text-plum" />
            <span className="text-xs font-black text-playful-purple dark:text-plum uppercase tracking-widest">
              {esDetail.label} / {enDetail.label}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Verse of the Day Card */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-golden" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
              {isVotd 
                ? (state.primaryLanguage === 'es' ? 'Versículo del día' : 'Verse of the Day')
                : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra Verse')}
            </h2>
          </div>
          
          {!isVotd && (
            <button 
              onClick={() => setState(s => ({ ...s, selectedVerseId: null }))}
              className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline"
            >
              {state.primaryLanguage === 'es' ? 'Volver al diario' : 'Back to Daily'}
            </button>
          )}
        </div>
        
        <motion.div 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="card bg-white dark:bg-charcoal p-10 shadow-2xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
        >
          <div className="relative space-y-10">
            <div className="space-y-8">
              {(state.languageMode === 'es' || state.languageMode === 'both') && (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-playful-purple/80 dark:text-plum/80">
                    {esDetail.name}
                  </span>
                  {esText ? (
                    <p className="text-3xl font-serif leading-relaxed text-earth dark:text-ivory font-medium">
                      {esText}
                    </p>
                  ) : (
                    <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                      <AlertCircle size={20} />
                      <p className="text-sm font-bold">{esError}</p>
                    </div>
                  )}
                </div>
              )}

              {state.languageMode === 'both' && (
                <div className="h-px w-full bg-earth/10 dark:bg-white/10" />
              )}

              {(state.languageMode === 'en' || state.languageMode === 'both') && (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-golden/80">
                    {enDetail.name}
                  </span>
                  {enText ? (
                    <p className="text-3xl font-serif leading-relaxed text-earth dark:text-ivory font-medium">
                      {enText}
                    </p>
                  ) : (
                    <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                      <AlertCircle size={20} />
                      <p className="text-sm font-bold">{enError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-end pt-6 border-t border-earth/5 dark:border-white/5">
              <div className="space-y-1">
                <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                  {currentVerse.book} {currentVerse.chapter}:{currentVerse.verse}
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                  {isVotd 
                    ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                    : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse')}
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (esText || enText) {
                    onStartMemorizing(currentVerse.id);
                  }
                }}
                disabled={!esText && !enText}
                className={`btn-primary flex items-center gap-2 py-3 px-6 shadow-xl shadow-playful-purple/20 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                <Play size={20} fill="currentColor" />
                <span className="text-lg">{state.primaryLanguage === 'es' ? 'Memorizar' : 'Memorize'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Secondary Action - Another Verse */}
      <div className="flex justify-center pt-4">
        <button 
          onClick={onGetAnotherVerse}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/50 dark:bg-charcoal/50 border border-earth/10 dark:border-white/10 hover:bg-white dark:hover:bg-charcoal transition-all group"
        >
          <History size={16} className="text-earth-light/60 dark:text-lavender-muted/60 group-hover:text-playful-purple transition-colors" />
          <span className="text-xs font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60 group-hover:text-playful-purple transition-colors">
            {state.primaryLanguage === 'es' ? 'Otro versículo' : 'Another verse'}
          </span>
        </button>
      </div>
    </motion.div>
  );
}
