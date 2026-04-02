import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { Bookmark, Share2, Trash2, BookOpen, Search, Languages, Star, Heart, AlertCircle } from "lucide-react";
import { MOCK_VERSES } from "../constants";
import React, { useState } from "react";
import { getCurrentTranslationPair, getValidatedVerse } from "../utils/verseUtils";

interface SavedProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string) => void;
}

export default function Saved({ state, setState, onStartMemorizing }: SavedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const activePair = getCurrentTranslationPair(state);
  
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  // For demo, we'll show some from MOCK_VERSES if savedVerses is empty
  const savedList = state.savedVerses.length > 0 
    ? MOCK_VERSES.filter(v => state.savedVerses.includes(v.id))
    : MOCK_VERSES.slice(0, 2);

  const filteredList = savedList.filter(v => {
    const { esText, enText } = getValidatedVerse(v, state);
    return v.book.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (esText || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
           (enText || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  const removeSaved = (id: string) => {
    setState(s => ({
      ...s,
      savedVerses: s.savedVerses.filter(vid => vid !== id)
    }));
  };

  const handleShare = (verse: any) => {
    // Placeholder for share functionality
    console.log("Sharing verse:", verse);
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">
            {state.primaryLanguage === 'es' ? 'Mi Tesoro' : 'My Treasure'}
          </h2>
          <p className="text-sm font-medium text-earth-light dark:text-lavender-muted">
            {state.primaryLanguage === 'es' ? 'Versículos guardados y progreso.' : 'Saved verses and progress.'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-playful-purple/10 dark:bg-plum/20 px-3 py-1.5 rounded-full border border-playful-purple/20 dark:border-plum/30">
          <Languages size={14} className="text-playful-purple dark:text-plum" />
          <span className="text-[10px] font-black text-playful-purple dark:text-plum uppercase tracking-widest">
            {esDetail.label} / {enDetail.label}
          </span>
        </div>
      </div>

      {/* Simple Progress Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6 bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 shadow-sm flex flex-col items-center text-center space-y-2">
          <span className="text-4xl font-serif font-black text-playful-purple dark:text-plum">
            {state.progress.totalMemorized}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-earth/40 dark:text-ivory/40">
            {state.primaryLanguage === 'es' ? 'Memorizados' : 'Memorized'}
          </span>
        </div>
        <div className="card p-6 bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 shadow-sm flex flex-col items-center text-center space-y-2">
          <span className="text-4xl font-serif font-black text-golden dark:text-gold">
            {state.progress.currentStreak}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-earth/40 dark:text-ivory/40">
            {state.primaryLanguage === 'es' ? 'Días seguidos' : 'Day streak'}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-earth/40 dark:text-lavender-muted/60" size={18} />
        <input 
          type="text"
          placeholder={state.primaryLanguage === 'es' ? "Buscar versículos..." : "Search verses..."}
          className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white dark:bg-charcoal border-2 border-earth/10 dark:border-white/10 focus:border-playful-purple dark:focus:border-plum outline-none transition-all font-medium text-earth dark:text-ivory placeholder:text-earth/40 dark:placeholder:text-lavender-muted/60 shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredList.map((verse, idx) => {
            const { esText, enText, esError, enError } = getValidatedVerse(verse, state);
            const isMemorized = state.progress.completedVerses.includes(verse.id);
            return (
              <motion.div 
                key={verse.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className="card p-6 space-y-4 border border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal shadow-lg relative overflow-hidden group"
              >
                {isMemorized && (
                  <div className="absolute top-0 right-0 p-2">
                    <div className="bg-teal/10 text-teal px-2 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1 border-l border-b border-teal/20">
                      <Star size={10} fill="currentColor" />
                      <span className="text-[8px] font-black uppercase tracking-widest">
                        {state.primaryLanguage === 'es' ? 'Memorizado' : 'Memorized'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                      {verse.book} {verse.chapter}:{verse.verse}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-playful-purple bg-playful-purple/10 dark:bg-plum/20 px-2 py-0.5 rounded border border-playful-purple/20 dark:border-plum/30">
                        {esDetail.label}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-golden bg-golden/10 dark:bg-gold/20 px-2 py-0.5 rounded border border-golden/20 dark:border-gold/30">
                        {enDetail.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleShare(verse)}
                      className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all"
                    >
                      <Share2 size={18} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeSaved(verse.id)}
                      className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-coral hover:bg-coral/10 transition-all"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {(state.languageMode === 'es' || state.languageMode === 'both') && (
                    <div className="space-y-1">
                      {esText ? (
                        <p className="text-xl font-serif leading-relaxed text-earth dark:text-ivory font-black">
                          {esText}
                        </p>
                      ) : (
                        <div className="p-3 bg-coral/10 rounded-xl flex items-center gap-2 text-coral border border-coral/20">
                          <AlertCircle size={16} />
                          <p className="text-[10px] font-bold">{esError}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(state.languageMode === 'en' || state.languageMode === 'both') && (
                    <div className="space-y-1">
                      {enText ? (
                        <p className="text-lg font-serif leading-relaxed text-earth/80 dark:text-lavender-muted border-l-4 border-playful-purple/30 dark:border-plum/40 pl-4 bg-playful-purple/5 dark:bg-plum/5 py-3 rounded-r-xl font-medium">
                          {enText}
                        </p>
                      ) : (
                        <div className="p-3 bg-coral/10 rounded-xl flex items-center gap-2 text-coral border border-coral/20">
                          <AlertCircle size={16} />
                          <p className="text-[10px] font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (esText || enText) {
                      onStartMemorizing(verse.id);
                    }
                  }}
                  disabled={!esText && !enText}
                  className={`w-full py-4 rounded-2xl bg-playful-purple/10 dark:bg-plum/20 text-playful-purple dark:text-plum font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all border-2 border-playful-purple/20 dark:border-plum/30 shadow-lg shadow-playful-purple/10 dark:shadow-plum/10 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  <BookOpen size={16} />
                  <span>{state.primaryLanguage === 'es' ? 'Repasar ahora' : 'Review Now'}</span>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredList.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center space-y-6"
          >
            <div className="relative w-32 h-32 mx-auto">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-full h-full bg-playful-purple/10 dark:bg-plum/10 rounded-[40px] flex items-center justify-center"
              >
                <Bookmark size={64} className="text-playful-purple dark:text-plum" fill="currentColor" />
              </motion.div>
              <motion.div
                className="absolute -top-2 -right-2"
              >
                <Star size={32} className="text-golden" fill="currentColor" />
              </motion.div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                {state.primaryLanguage === 'es' ? 'Tu tesoro está vacío' : 'Your treasure is empty'}
              </h3>
              <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto">
                {state.primaryLanguage === 'es' 
                  ? 'Guarda tus versículos favoritos para verlos aquí.' 
                  : 'Save your favorite verses to see them here.'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
